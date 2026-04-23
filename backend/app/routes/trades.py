import csv
import datetime as dt
import io
from pathlib import Path
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    _RL_OK = True
except Exception:
    _RL_OK = False

from ..auth import get_current_user
from ..db import get_session
from ..models import FXRate, Trade, User, Import
from ..schemas import (
    TradeChartDay,
    TradeChartResponse,
    TradeListResponse,
    TradeMetaResponse,
    TradeNoteUpdate,
    TradeTotalsResponse,
    TradeOut,
)

router = APIRouter()

SORT_COLUMNS = {
    "close_time": Trade.close_time,
    "symbol": Trade.symbol,
    "side": Trade.side,
    "volume": Trade.volume,
    "open_price": Trade.open_price,
    "close_price": Trade.close_price,
    "profit": Trade.profit,
    "commission": Trade.commission,
    "swap": Trade.swap,
    "net_profit": Trade.profit + Trade.commission + Trade.swap,
}


def _build_rate_map(rates: List[FXRate]) -> Dict[dt.date, float]:
    rates_sorted = sorted(rates, key=lambda r: r.date)
    rate_map: Dict[dt.date, float] = {}
    current_rate = None
    idx = 0
    if not rates_sorted:
        return rate_map

    start = rates_sorted[0].date
    end = rates_sorted[-1].date
    for n in range((end - start).days + 1):
        day = start + dt.timedelta(days=n)
        while idx < len(rates_sorted) and rates_sorted[idx].date <= day:
            current_rate = rates_sorted[idx].usd_brl_rate
            idx += 1
        if current_rate is not None:
            rate_map[day] = float(current_rate)
    return rate_map


def _build_trade_out(trade: Trade, rate_map: Dict[dt.date, float], latest_rate: Optional[float]) -> TradeOut:
    net_profit = float(trade.profit) + float(trade.commission) + float(trade.swap)
    currency = (trade.currency or "USD").upper()
    if currency == "BRL":
        fx_rate = 1.0
        net_profit_brl = net_profit
    else:
        fx_rate = rate_map.get(trade.close_date) or latest_rate
        net_profit_brl = net_profit * fx_rate if fx_rate else None
    return TradeOut(
        id=trade.id,
        account=trade.account,
        symbol=trade.symbol,
        side=trade.side,
        volume=float(trade.volume),
        open_time=trade.open_time,
        close_time=trade.close_time,
        open_price=float(trade.open_price),
        close_price=float(trade.close_price),
        profit=float(trade.profit),
        commission=float(trade.commission),
        swap=float(trade.swap),
        net_profit=net_profit,
        net_profit_brl=net_profit_brl,
        fx_rate=fx_rate,
        currency=trade.currency,
        deal_id=trade.deal_id,
        note=trade.note,
    )


def _apply_filters(stmt, user_id: int, from_: Optional[dt.date], to: Optional[dt.date], symbol: Optional[str], account: Optional[str]):
    stmt = stmt.where(Trade.user_id == user_id)
    if from_:
        stmt = stmt.where(Trade.close_date >= from_)
    if to:
        stmt = stmt.where(Trade.close_date <= to)
    if symbol:
        stmt = stmt.where(Trade.symbol == symbol)
    if account:
        stmt = stmt.where(Trade.account == account)
    return stmt


@router.get("/trades", response_model=TradeListResponse)
async def list_trades(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("close_time"),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = _apply_filters(select(Trade), user.id, from_, to, symbol, account)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    sort_col = SORT_COLUMNS.get(sort_by, Trade.close_time)
    order_fn = asc if sort_dir == "asc" else desc
    stmt = stmt.order_by(order_fn(sort_col))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    trades = (await session.execute(stmt)).scalars().all()

    rates = (await session.execute(select(FXRate))).scalars().all()
    rate_map = _build_rate_map(rates)
    latest_rate = float(max(rates, key=lambda r: r.date).usd_brl_rate) if rates else None

    results = [_build_trade_out(trade, rate_map, latest_rate) for trade in trades]
    return TradeListResponse(trades=results, total=total, page=page, page_size=page_size)


@router.get("/trades/totals", response_model=TradeTotalsResponse)
async def get_trade_totals(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = _apply_filters(select(Trade), user.id, from_, to, symbol, account)
    trades = (await session.execute(stmt)).scalars().all()

    if not trades:
        return TradeTotalsResponse(total_usd=0.0, total_brl=None, count=0)

    rates = (await session.execute(select(FXRate))).scalars().all()
    rate_map = _build_rate_map(rates)
    latest_rate = float(max(rates, key=lambda r: r.date).usd_brl_rate) if rates else None

    total_usd = 0.0
    total_brl = 0.0
    has_brl = False

    for trade in trades:
        net = float(trade.profit) + float(trade.commission) + float(trade.swap)
        total_usd += net
        currency = (trade.currency or "USD").upper()
        if currency == "BRL":
            total_brl += net
            has_brl = True
        else:
            fx = rate_map.get(trade.close_date) or latest_rate
            if fx:
                total_brl += net * fx
                has_brl = True

    return TradeTotalsResponse(
        total_usd=total_usd,
        total_brl=total_brl if has_brl else None,
        count=len(trades),
    )


@router.get("/trades/chart", response_model=TradeChartResponse)
async def get_trade_chart(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = _apply_filters(select(Trade), user.id, from_, to, symbol, account)
    stmt = stmt.order_by(asc(Trade.close_date), asc(Trade.close_time))
    trades = (await session.execute(stmt)).scalars().all()

    daily: Dict[dt.date, dict] = {}
    for trade in trades:
        net = float(trade.profit) + float(trade.commission) + float(trade.swap)
        d = trade.close_date
        if d not in daily:
            daily[d] = {"profit_usd": 0.0, "trades_count": 0}
        daily[d]["profit_usd"] += net
        daily[d]["trades_count"] += 1

    result = []
    cumulative = 0.0
    for date in sorted(daily.keys()):
        day = daily[date]
        cumulative += day["profit_usd"]
        result.append(TradeChartDay(
            date=date,
            profit_usd=day["profit_usd"],
            cumulative_usd=cumulative,
            trades_count=day["trades_count"],
        ))

    return TradeChartResponse(daily=result)


@router.get("/trades/export")
async def export_trades_csv(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = _apply_filters(select(Trade), user.id, from_, to, symbol, account)
    stmt = stmt.order_by(desc(Trade.close_time))
    trades = (await session.execute(stmt)).scalars().all()

    rates = (await session.execute(select(FXRate))).scalars().all()
    rate_map = _build_rate_map(rates)
    latest_rate = float(max(rates, key=lambda r: r.date).usd_brl_rate) if rates else None

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Fechamento", "Abertura", "Ativo", "Tipo", "Volume",
        "Preco Abertura", "Preco Fechamento",
        "Lucro (USD)", "Comissao", "Swap",
        "Liquido (USD)", "Liquido (BRL)", "Taxa FX", "Moeda", "Deal ID", "Conta", "Nota"
    ])
    for trade in trades:
        net_profit = float(trade.profit) + float(trade.commission) + float(trade.swap)
        currency = (trade.currency or "USD").upper()
        if currency == "BRL":
            fx_rate: Optional[float] = 1.0
            net_profit_brl: Optional[float] = net_profit
        else:
            fx_rate = rate_map.get(trade.close_date) or latest_rate
            net_profit_brl = net_profit * fx_rate if fx_rate else None
        writer.writerow([
            trade.close_time.strftime("%Y-%m-%d %H:%M:%S"),
            trade.open_time.strftime("%Y-%m-%d %H:%M:%S"),
            trade.symbol,
            trade.side,
            float(trade.volume),
            float(trade.open_price),
            float(trade.close_price),
            float(trade.profit),
            float(trade.commission),
            float(trade.swap),
            net_profit,
            net_profit_brl if net_profit_brl is not None else "",
            fx_rate if fx_rate is not None else "",
            trade.currency or "",
            trade.deal_id or "",
            trade.account,
            trade.note or "",
        ])

    output.seek(0)
    filename = f"trades_{dt.date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/trades/export/save")
async def export_trades_csv_save(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Salva o CSV de trades direto em Downloads (para app desktop)."""
    stmt = _apply_filters(select(Trade), user.id, from_, to, symbol, account)
    stmt = stmt.order_by(desc(Trade.close_time))
    trades = (await session.execute(stmt)).scalars().all()

    rates = (await session.execute(select(FXRate))).scalars().all()
    rate_map = _build_rate_map(rates)
    latest_rate = float(max(rates, key=lambda r: r.date).usd_brl_rate) if rates else None

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Fechamento", "Abertura", "Ativo", "Tipo", "Volume",
        "Preco Abertura", "Preco Fechamento",
        "Lucro (USD)", "Comissao", "Swap",
        "Liquido (USD)", "Liquido (BRL)", "Taxa FX", "Moeda", "Deal ID", "Conta", "Nota"
    ])
    for trade in trades:
        net_profit = float(trade.profit) + float(trade.commission) + float(trade.swap)
        currency = (trade.currency or "USD").upper()
        if currency == "BRL":
            fx_rate: Optional[float] = 1.0
            net_profit_brl: Optional[float] = net_profit
        else:
            fx_rate = rate_map.get(trade.close_date) or latest_rate
            net_profit_brl = net_profit * fx_rate if fx_rate else None
        writer.writerow([
            trade.close_time.strftime("%Y-%m-%d %H:%M:%S"),
            trade.open_time.strftime("%Y-%m-%d %H:%M:%S"),
            trade.symbol, trade.side,
            float(trade.volume), float(trade.open_price), float(trade.close_price),
            float(trade.profit), float(trade.commission), float(trade.swap),
            net_profit,
            net_profit_brl if net_profit_brl is not None else "",
            fx_rate if fx_rate is not None else "",
            trade.currency or "", trade.deal_id or "", trade.account, trade.note or "",
        ])

    filename = f"trades_{dt.date.today().isoformat()}.csv"
    target_dir = Path.home() / "Downloads"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    target_path.write_text(output.getvalue(), encoding="utf-8-sig")
    return {"path": str(target_path), "filename": filename}


def _build_trades_pdf(
    trades: list,
    rate_map: Dict[dt.date, float],
    latest_rate: Optional[float],
    from_: Optional[dt.date] = None,
    to: Optional[dt.date] = None,
    symbol: Optional[str] = None,
    account: Optional[str] = None,
) -> bytes:
    if not _RL_OK:
        raise HTTPException(status_code=500, detail="PDF indisponível (reportlab não instalado)")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=1 * cm, leftMargin=1 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    story = []

    # ── Cabeçalho ──────────────────────────────────────────────────────────
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=14, spaceAfter=4)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748b"), spaceAfter=2)

    story.append(Paragraph("Relatório de Trades – TradersTrackerMT5", title_style))
    generated = f"Gerado em: {dt.datetime.now().strftime('%d/%m/%Y %H:%M')}"
    parts = []
    if from_:
        parts.append(f"De: {from_.strftime('%d/%m/%Y')}")
    if to:
        parts.append(f"Até: {to.strftime('%d/%m/%Y')}")
    if symbol:
        parts.append(f"Ativo: {symbol}")
    if account:
        parts.append(f"Conta: {account}")
    story.append(Paragraph(generated + ("   |   " + "   |   ".join(parts) if parts else ""), sub_style))

    # ── Resumo ─────────────────────────────────────────────────────────────
    total_net_usd = 0.0
    total_net_brl = 0.0
    has_brl = False
    winners = 0

    rows_data = []
    for t in trades:
        net = float(t.profit) + float(t.commission) + float(t.swap)
        total_net_usd += net
        if net >= 0:
            winners += 1
        currency = (t.currency or "USD").upper()
        if currency == "BRL":
            fx = 1.0
            net_brl: Optional[float] = net
            has_brl = True
        else:
            fx = rate_map.get(t.close_date) or latest_rate
            net_brl = net * fx if fx else None
            if net_brl is not None:
                has_brl = True
        if net_brl is not None:
            total_net_brl += net_brl
        rows_data.append((t, net, net_brl))

    wr = (winners / len(trades) * 100) if trades else 0.0
    net_color = "#16a34a" if total_net_usd >= 0 else "#dc2626"
    summary_style = ParagraphStyle("sum", parent=styles["Normal"], fontSize=8, spaceAfter=6)
    brl_str = f"   |   Líquido BRL: R$ {total_net_brl:,.2f}" if has_brl else ""
    story.append(Paragraph(
        f"Total de operações: {len(trades)}   |   Taxa de acerto: {wr:.1f}%   |   "
        f"Líquido USD: <font color='{net_color}'>${total_net_usd:,.2f}</font>{brl_str}",
        summary_style,
    ))
    story.append(Spacer(1, 0.2 * cm))

    # ── Tabela ─────────────────────────────────────────────────────────────
    header = ["Fechamento", "Ativo", "Tipo", "Volume", "Abertura", "Fechamento", "Lucro", "Comissão", "Swap", "Líq. USD", "Líq. BRL", "Nota"]
    col_widths = [3.8*cm, 1.8*cm, 1.5*cm, 1.6*cm, 2.4*cm, 2.4*cm, 2.0*cm, 2.0*cm, 1.6*cm, 2.2*cm, 2.2*cm, 3.5*cm]

    table_data = [header]
    row_colors = []  # (row_index, color)

    for idx, (t, net, net_brl) in enumerate(rows_data):
        bg = colors.HexColor("#f0fdf4") if net >= 0 else colors.HexColor("#fff1f2")
        row_colors.append((idx + 1, bg))
        table_data.append([
            t.close_time.strftime("%d/%m/%Y %H:%M"),
            t.symbol,
            t.side.upper(),
            f"{float(t.volume):.2f}",
            f"{float(t.open_price):.5f}",
            f"{float(t.close_price):.5f}",
            f"{float(t.profit):+.2f}",
            f"{float(t.commission):+.2f}",
            f"{float(t.swap):+.2f}",
            f"{net:+.2f}",
            f"{net_brl:+.2f}" if net_brl is not None else "-",
            (t.note or "")[:30],
        ])

    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a5c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (2, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    # Color profit/loss rows
    for row_idx, bg in row_colors:
        style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), bg))
    # Color net USD column values
    for idx, (_, net, _) in enumerate(rows_data):
        tc = colors.HexColor("#16a34a") if net >= 0 else colors.HexColor("#dc2626")
        style_cmds.append(("TEXTCOLOR", (9, idx + 1), (9, idx + 1), tc))

    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


@router.get("/trades/export/pdf")
async def export_trades_pdf(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = _apply_filters(select(Trade), user.id, from_, to, symbol, account)
    stmt = stmt.order_by(desc(Trade.close_time))
    trades = (await session.execute(stmt)).scalars().all()
    if not trades:
        raise HTTPException(status_code=400, detail="Nenhuma operação encontrada.")

    rates = (await session.execute(select(FXRate))).scalars().all()
    rate_map = _build_rate_map(rates)
    latest_rate = float(max(rates, key=lambda r: r.date).usd_brl_rate) if rates else None

    pdf_bytes = _build_trades_pdf(trades, rate_map, latest_rate, from_, to, symbol, account)
    filename = f"trades_{dt.date.today().isoformat()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/trades/export/pdf/save")
async def export_trades_pdf_save(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Salva o PDF de trades direto em Downloads (para app desktop)."""
    stmt = _apply_filters(select(Trade), user.id, from_, to, symbol, account)
    stmt = stmt.order_by(desc(Trade.close_time))
    trades = (await session.execute(stmt)).scalars().all()
    if not trades:
        raise HTTPException(status_code=400, detail="Nenhuma operação encontrada.")

    rates = (await session.execute(select(FXRate))).scalars().all()
    rate_map = _build_rate_map(rates)
    latest_rate = float(max(rates, key=lambda r: r.date).usd_brl_rate) if rates else None

    pdf_bytes = _build_trades_pdf(trades, rate_map, latest_rate, from_, to, symbol, account)
    filename = f"trades_{dt.date.today().isoformat()}.pdf"
    target_dir = Path.home() / "Downloads"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    target_path.write_bytes(pdf_bytes)
    return {"path": str(target_path), "filename": filename}


@router.patch("/trades/{trade_id}/note")
async def update_trade_note(
    trade_id: int,
    payload: TradeNoteUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    trade = (
        await session.execute(
            select(Trade).where(Trade.id == trade_id, Trade.user_id == user.id)
        )
    ).scalars().first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade não encontrado.")
    trade.note = payload.note
    await session.commit()
    return {"ok": True}


@router.get("/trades/meta", response_model=TradeMetaResponse)
async def list_trade_meta(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    symbol_stmt = (
        select(Trade.symbol)
        .where(Trade.user_id == user.id)
        .distinct()
        .order_by(Trade.symbol)
    )
    account_stmt = (
        select(Trade.account)
        .where(Trade.user_id == user.id)
        .distinct()
        .order_by(Trade.account)
    )

    if from_:
        symbol_stmt = symbol_stmt.where(Trade.close_date >= from_)
        account_stmt = account_stmt.where(Trade.close_date >= from_)
    if to:
        symbol_stmt = symbol_stmt.where(Trade.close_date <= to)
        account_stmt = account_stmt.where(Trade.close_date <= to)

    symbols = (await session.execute(symbol_stmt)).scalars().all()
    accounts = (await session.execute(account_stmt)).scalars().all()

    suggested_account = accounts[0] if accounts else None
    suggested_broker = None

    latest_import = (
        await session.execute(
            select(Import)
                .where(Import.user_id == user.id)
                .order_by(Import.created_at.desc())
                .limit(1)
        )
    ).scalars().first()

    if latest_import:
        suggested_account = latest_import.account or suggested_account
        meta_json = latest_import.meta_json or {}
        suggested_broker = latest_import.server or meta_json.get("server") or suggested_broker

    return TradeMetaResponse(
        symbols=[s for s in symbols if s],
        accounts=[a for a in accounts if a],
        suggested_account=suggested_account,
        suggested_broker=suggested_broker,
    )
