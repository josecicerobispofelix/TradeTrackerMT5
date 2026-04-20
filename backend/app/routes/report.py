"""
Relatório mensal completo em PDF.
Endpoint: POST /api/report/monthly
Body: { "month": 1-12, "year": 2024 }
"""

import calendar
import datetime as dt
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import FiscalProfile, FXRate, Trade, User

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
except Exception:
    rl_canvas = None  # type: ignore

router = APIRouter()

# ── Paleta ────────────────────────────────────────────────────────────────────

C_DARK   = (0.07, 0.12, 0.22)   # #121e38
C_MID    = (0.11, 0.18, 0.32)   # #1c2e52
C_ACCENT = (0.05, 0.64, 0.91)   # #0ea4e8
C_GREEN  = (0.13, 0.78, 0.55)   # #21c78c
C_RED    = (0.93, 0.27, 0.36)   # #ee455c
C_TEXT   = (0.93, 0.95, 0.97)   # #edf2f8
C_MUTED  = (0.58, 0.64, 0.72)   # #94a3b8
C_WHITE  = (1.0,  1.0,  1.0)
C_ROW_A  = (0.12, 0.20, 0.35)
C_ROW_B  = (0.09, 0.15, 0.27)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fc(v: float, cur: str = "USD") -> str:
    sym = "R$" if cur == "BRL" else "US$"
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    sign = "-" if v < 0 else ""
    return f"{sign}{sym} {s}"


def _fp(v: float) -> str:
    return f"{v:.1f}%"


def _set(pdf, r, g, b):
    pdf.setFillColorRGB(r, g, b)


def _setstroke(pdf, r, g, b):
    pdf.setStrokeColorRGB(r, g, b)


def _rect(pdf, x, y, w, h, r=0, g=0, b=0, stroke=False):
    _set(pdf, r, g, b)
    if stroke:
        pdf.rect(x, y, w, h, fill=1, stroke=1)
    else:
        pdf.rect(x, y, w, h, fill=1, stroke=0)


# ── Cálculos ──────────────────────────────────────────────────────────────────

async def _get_profile(session: AsyncSession, user_id: int) -> Optional[FiscalProfile]:
    return await session.scalar(
        select(FiscalProfile).where(FiscalProfile.user_id == user_id)
    )


async def _get_fx_rate(session: AsyncSession, month_end: dt.date) -> Optional[float]:
    row = await session.scalar(
        select(FXRate).where(FXRate.date <= month_end).order_by(FXRate.date.desc())
    )
    return float(row.usd_brl_rate) if row else None


async def _get_daily(
    session: AsyncSession,
    user_id: int,
    start: dt.date,
    end: dt.date,
):
    profit_expr = Trade.profit
    net_expr = Trade.profit + Trade.commission + Trade.swap

    stmt = (
        select(
            Trade.close_date.label("day"),
            func.count(Trade.id).label("trades"),
            func.sum(case((profit_expr > 0, 1), else_=0)).label("wins"),
            func.sum(case((profit_expr > 0, profit_expr), else_=0)).label("gp"),
            func.sum(case((profit_expr < 0, profit_expr), else_=0)).label("gl"),
            func.sum(net_expr).label("net"),
        )
        .where(
            Trade.user_id == user_id,
            Trade.close_date >= start,
            Trade.close_date <= end,
        )
        .group_by(Trade.close_date)
        .order_by(Trade.close_date)
    )
    return (await session.execute(stmt)).all()


# ── PDF ───────────────────────────────────────────────────────────────────────

def _build_report(
    year: int,
    month: int,
    profile: Optional[FiscalProfile],
    daily_rows,
    fx_rate: Optional[float],
) -> bytes:
    if rl_canvas is None:
        raise RuntimeError("reportlab não instalado")

    buffer = BytesIO()
    pdf = rl_canvas.Canvas(buffer, pagesize=A4)
    W, H = A4
    MARGIN = 18 * mm

    month_names = [
        "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ]

    # ── Agregar totais ────────────────────────────────────────────────────────
    total_trades = 0
    total_wins   = 0
    total_gp     = 0.0
    total_gl     = 0.0
    total_net    = 0.0
    days_with_trades = []

    for row in daily_rows:
        t = int(row.trades or 0)
        if t == 0:
            continue
        total_trades += t
        total_wins   += int(row.wins or 0)
        total_gp     += float(row.gp or 0)
        total_gl     += float(row.gl or 0)
        total_net    += float(row.net or 0)
        days_with_trades.append(row)

    win_rate    = (total_wins / total_trades * 100) if total_trades else 0.0
    total_net_brl = total_net * fx_rate if fx_rate else None
    profit_factor = (total_gp / abs(total_gl)) if total_gl else None

    # ── Página 1 ──────────────────────────────────────────────────────────────
    def page_background():
        _rect(pdf, 0, 0, W, H, *C_DARK)

    page_background()

    # Faixa de cabeçalho
    header_h = 52 * mm
    _rect(pdf, 0, H - header_h, W, header_h, *C_MID)

    # Linha de destaque no topo do cabeçalho
    _rect(pdf, 0, H - 2, W, 2, *C_ACCENT)

    # Título
    pdf.setFont("Helvetica-Bold", 20)
    _set(pdf, *C_WHITE)
    pdf.drawString(MARGIN, H - 18 * mm, "Relatório Mensal de Operações")

    pdf.setFont("Helvetica", 11)
    _set(pdf, *C_MUTED)
    pdf.drawString(MARGIN, H - 26 * mm, f"{month_names[month]} de {year}")

    # Info do trader (direita do cabeçalho)
    rx = W - MARGIN
    pdf.setFont("Helvetica-Bold", 10)
    _set(pdf, *C_TEXT)
    name = (profile.full_name or "—") if profile else "—"
    cpf  = (profile.cpf or "—")       if profile else "—"
    pdf.drawRightString(rx, H - 18 * mm, name)
    pdf.setFont("Helvetica", 9)
    _set(pdf, *C_MUTED)
    pdf.drawRightString(rx, H - 24 * mm, f"CPF: {cpf}")
    broker  = (profile.broker or "—")         if profile else "—"
    account = (profile.trading_account or "—") if profile else "—"
    pdf.drawRightString(rx, H - 30 * mm, f"Corretora: {broker}  |  Conta: {account}")

    # Linha separadora
    y_after_header = H - header_h - 6 * mm

    # ── Cards de resumo ───────────────────────────────────────────────────────
    cards = [
        ("Operações",      str(total_trades),               C_ACCENT),
        ("Win Rate",       _fp(win_rate),                   C_GREEN if win_rate >= 50 else C_RED),
        ("Lucro Líq. USD", _fc(total_net, "USD"),           C_GREEN if total_net >= 0 else C_RED),
        ("Lucro Líq. BRL", _fc(total_net_brl, "BRL") if total_net_brl is not None else "—",
                                                            C_GREEN if (total_net_brl or 0) >= 0 else C_RED),
    ]

    card_w = (W - 2 * MARGIN - 3 * 4 * mm) / 4
    card_h = 22 * mm
    cx = MARGIN
    cy = y_after_header - card_h

    for label, value, vcolor in cards:
        _rect(pdf, cx, cy, card_w, card_h, *C_MID)
        # borda superior colorida
        _rect(pdf, cx, cy + card_h - 1.5, card_w, 1.5, *vcolor)
        pdf.setFont("Helvetica", 8)
        _set(pdf, *C_MUTED)
        pdf.drawString(cx + 4 * mm, cy + card_h - 7 * mm, label.upper())
        pdf.setFont("Helvetica-Bold", 13)
        _set(pdf, *vcolor)
        pdf.drawString(cx + 4 * mm, cy + 5 * mm, value)
        cx += card_w + 4 * mm

    # ── Segunda linha de métricas ─────────────────────────────────────────────
    cy2 = cy - 5 * mm - 14 * mm
    metrics = [
        ("Lucro Bruto",   _fc(total_gp, "USD")),
        ("Perda Bruta",   _fc(total_gl, "USD")),
        ("Profit Factor", f"{profit_factor:.2f}" if profit_factor else "—"),
        ("Cotação USD/BRL", f"R$ {fx_rate:,.4f}".replace(",", "X").replace(".", ",").replace("X", ".") if fx_rate else "—"),
    ]

    mw = (W - 2 * MARGIN - 3 * 3 * mm) / 4
    mx = MARGIN
    for label, value in metrics:
        pdf.setFont("Helvetica", 8)
        _set(pdf, *C_MUTED)
        pdf.drawString(mx, cy2 + 10 * mm, label.upper())
        pdf.setFont("Helvetica-Bold", 10)
        _set(pdf, *C_TEXT)
        pdf.drawString(mx, cy2 + 4 * mm, value)
        mx += mw + 3 * mm

    # Linha divisória
    y_div = cy2 - 4 * mm
    _setstroke(pdf, *C_MID)
    pdf.setLineWidth(0.5)
    pdf.line(MARGIN, y_div, W - MARGIN, y_div)

    # ── Curva de capital (equity curve) ───────────────────────────────────────
    chart_y = y_div - 4 * mm - 45 * mm
    chart_h = 45 * mm
    chart_w = W - 2 * MARGIN

    _rect(pdf, MARGIN, chart_y, chart_w, chart_h, *C_MID)

    pdf.setFont("Helvetica-Bold", 8)
    _set(pdf, *C_MUTED)
    pdf.drawString(MARGIN + 3 * mm, chart_y + chart_h - 5 * mm, "CURVA DE CAPITAL (USD)")

    if days_with_trades:
        cumulative = []
        acc = 0.0
        for row in days_with_trades:
            acc += float(row.net or 0)
            cumulative.append(acc)

        min_v = min(cumulative)
        max_v = max(cumulative)
        span  = max_v - min_v or 1

        pad_x = 8 * mm
        pad_y = 8 * mm
        cw = chart_w - 2 * pad_x
        ch = chart_h - 2 * pad_y - 4 * mm

        def to_xy(i, v):
            x = MARGIN + pad_x + (i / max(len(cumulative) - 1, 1)) * cw
            y = chart_y + pad_y + ((v - min_v) / span) * ch
            return x, y

        # Zero line
        if min_v < 0 < max_v:
            zx1, zy = to_xy(0, 0)
            zx2, _  = to_xy(len(cumulative) - 1, 0)
            _setstroke(pdf, *C_MUTED)
            pdf.setLineWidth(0.4)
            pdf.setDash(3, 3)
            pdf.line(zx1, zy, zx2, zy)
            pdf.setDash()

        # Fill under curve
        pts_fill = [(MARGIN + pad_x, chart_y + pad_y)]
        for i, v in enumerate(cumulative):
            pts_fill.append(to_xy(i, v))
        pts_fill.append((MARGIN + pad_x + cw, chart_y + pad_y))

        path = pdf.beginPath()
        path.moveTo(*pts_fill[0])
        for pt in pts_fill[1:]:
            path.lineTo(*pt)
        path.close()
        _set(pdf, 0.05, 0.64, 0.91)
        pdf.setFillAlpha(0.15)
        pdf.drawPath(path, fill=1, stroke=0)
        pdf.setFillAlpha(1.0)

        # Line
        _setstroke(pdf, *C_ACCENT)
        pdf.setLineWidth(1.8)
        path2 = pdf.beginPath()
        for i, v in enumerate(cumulative):
            x, y = to_xy(i, v)
            if i == 0:
                path2.moveTo(x, y)
            else:
                path2.lineTo(x, y)
        pdf.drawPath(path2, fill=0, stroke=1)

        # Dot no último ponto
        lx, ly = to_xy(len(cumulative) - 1, cumulative[-1])
        _set(pdf, *C_ACCENT)
        pdf.circle(lx, ly, 2.5 * mm, fill=1, stroke=0)
        pdf.setFont("Helvetica-Bold", 8)
        label_color = C_GREEN if cumulative[-1] >= 0 else C_RED
        _set(pdf, *label_color)
        pdf.drawString(lx + 3 * mm, ly - 1 * mm, _fc(cumulative[-1], "USD"))
    else:
        pdf.setFont("Helvetica", 10)
        _set(pdf, *C_MUTED)
        pdf.drawCentredString(W / 2, chart_y + chart_h / 2, "Sem operações no período")

    # ── DARF estimado ─────────────────────────────────────────────────────────
    darf_y = chart_y - 5 * mm - 16 * mm
    if total_net_brl and total_net_brl > 0:
        tax_rate = float(getattr(profile, "tax_rate", 0.15) or 0.15) if profile else 0.15
        tax_due  = total_net_brl * tax_rate

        _rect(pdf, MARGIN, darf_y, (W - 2 * MARGIN) * 0.48, 16 * mm, *C_ROW_A)
        pdf.setFont("Helvetica-Bold", 8)
        _set(pdf, *C_MUTED)
        pdf.drawString(MARGIN + 4 * mm, darf_y + 11 * mm, "DARF ESTIMADO  (cód. 8523)")
        pdf.setFont("Helvetica", 9)
        _set(pdf, *C_TEXT)
        pdf.drawString(MARGIN + 4 * mm, darf_y + 6 * mm,
                       f"Alíquota {tax_rate*100:.0f}%  |  "
                       f"Base: {_fc(total_net_brl, 'BRL')}  |  "
                       f"Imposto: {_fc(tax_due, 'BRL')}")

    # ── Rodapé ────────────────────────────────────────────────────────────────
    _rect(pdf, 0, 0, W, 10 * mm, *C_MID)
    pdf.setFont("Helvetica", 7)
    _set(pdf, *C_MUTED)
    pdf.drawString(MARGIN, 3.5 * mm, "TradersTrackerMT5 — TecnoHuby")
    pdf.drawRightString(W - MARGIN, 3.5 * mm,
                        f"Gerado em {dt.date.today().strftime('%d/%m/%Y')}")

    pdf.showPage()

    # ── Página 2: tabela diária ───────────────────────────────────────────────
    if days_with_trades:
        page_background()
        _rect(pdf, 0, H - 16 * mm, W, 16 * mm, *C_MID)
        _rect(pdf, 0, H - 2, W, 2, *C_ACCENT)
        pdf.setFont("Helvetica-Bold", 13)
        _set(pdf, *C_WHITE)
        pdf.drawString(MARGIN, H - 11 * mm, "Breakdown Diário")
        pdf.setFont("Helvetica", 9)
        _set(pdf, *C_MUTED)
        pdf.drawRightString(W - MARGIN, H - 11 * mm, f"{month_names[month]} / {year}")

        cols     = ["Data", "Trades", "Vitórias", "Win%", "Lucro Bruto", "Perda Bruta", "Líquido USD", "Líquido BRL"]
        col_x    = [MARGIN, MARGIN+22*mm, MARGIN+38*mm, MARGIN+55*mm,
                    MARGIN+68*mm, MARGIN+90*mm, MARGIN+112*mm, MARGIN+134*mm]
        col_align = ["L", "C", "C", "C", "R", "R", "R", "R"]
        row_h = 7 * mm

        # Cabeçalho da tabela
        ty = H - 24 * mm
        _rect(pdf, MARGIN, ty - row_h, W - 2 * MARGIN, row_h, *C_MID)
        pdf.setFont("Helvetica-Bold", 7)
        _set(pdf, *C_ACCENT)
        for i, (col, cx) in enumerate(zip(cols, col_x)):
            if col_align[i] == "R":
                next_x = col_x[i+1] if i+1 < len(col_x) else W - MARGIN
                pdf.drawRightString(next_x - 1*mm, ty - row_h + 2.5*mm, col)
            else:
                pdf.drawString(cx + 1*mm, ty - row_h + 2.5*mm, col)
        ty -= row_h

        pdf.setFont("Helvetica", 7.5)
        for idx, row in enumerate(days_with_trades):
            net   = float(row.net or 0)
            wins  = int(row.wins or 0)
            t     = int(row.trades or 0)
            gp    = float(row.gp or 0)
            gl    = float(row.gl or 0)
            wr    = (wins / t * 100) if t else 0.0
            net_brl = net * fx_rate if fx_rate else None

            bg = C_ROW_A if idx % 2 == 0 else C_ROW_B
            _rect(pdf, MARGIN, ty - row_h, W - 2 * MARGIN, row_h, *bg)

            net_color = C_GREEN if net >= 0 else C_RED
            wr_color  = C_GREEN if wr >= 50 else C_RED

            day_str = row.day.strftime("%d/%m/%Y") if hasattr(row.day, "strftime") else str(row.day)

            cells = [
                (day_str, C_TEXT, "L"),
                (str(t),  C_TEXT, "C"),
                (str(wins), C_TEXT, "C"),
                (_fp(wr),   wr_color, "C"),
                (_fc(gp, "USD"),  C_GREEN, "R"),
                (_fc(gl, "USD"),  C_RED,   "R"),
                (_fc(net, "USD"), net_color, "R"),
                (_fc(net_brl, "BRL") if net_brl is not None else "—", net_color, "R"),
            ]

            for i, (val, col, align) in enumerate(cells):
                _set(pdf, *col)
                cx = col_x[i]
                if align == "R":
                    next_x = col_x[i+1] if i+1 < len(col_x) else W - MARGIN
                    pdf.drawRightString(next_x - 1*mm, ty - row_h + 2.5*mm, val)
                elif align == "C":
                    next_x = col_x[i+1] if i+1 < len(col_x) else W - MARGIN
                    pdf.drawCentredString((cx + next_x) / 2, ty - row_h + 2.5*mm, val)
                else:
                    pdf.drawString(cx + 1*mm, ty - row_h + 2.5*mm, val)

            ty -= row_h

            # Nova página se necessário
            if ty - row_h < 15 * mm:
                _rect(pdf, 0, 0, W, 10 * mm, *C_MID)
                pdf.setFont("Helvetica", 7)
                _set(pdf, *C_MUTED)
                pdf.drawString(MARGIN, 3.5 * mm, "TradersTrackerMT5 — TecnoHuby")
                pdf.showPage()
                page_background()
                ty = H - 12 * mm
                pdf.setFont("Helvetica", 7.5)

        # Linha de total
        _rect(pdf, MARGIN, ty - row_h, W - 2 * MARGIN, row_h, *C_MID)
        _setstroke(pdf, *C_ACCENT)
        pdf.setLineWidth(0.8)
        pdf.line(MARGIN, ty, W - MARGIN, ty)
        pdf.setFont("Helvetica-Bold", 8)
        _set(pdf, *C_ACCENT)
        pdf.drawString(MARGIN + 1*mm, ty - row_h + 2.5*mm, "TOTAL")
        _set(pdf, *C_TEXT)
        pdf.drawCentredString((col_x[1]+col_x[2])/2, ty - row_h + 2.5*mm, str(total_trades))
        tc = C_GREEN if total_net >= 0 else C_RED
        pdf.drawRightString(col_x[6] + (col_x[7]-col_x[6]) - 1*mm, ty - row_h + 2.5*mm, _fc(total_gp, "USD"))
        _set(pdf, *C_RED)
        pdf.drawRightString(col_x[7] - 1*mm, ty - row_h + 2.5*mm, _fc(total_gl, "USD"))
        _set(pdf, *tc)
        next_x7 = W - MARGIN
        pdf.drawRightString(next_x7 - 1*mm, ty - row_h + 2.5*mm,
                            _fc(total_net_brl, "BRL") if total_net_brl is not None else "—")

        # Rodapé pág 2
        _rect(pdf, 0, 0, W, 10 * mm, *C_MID)
        pdf.setFont("Helvetica", 7)
        _set(pdf, *C_MUTED)
        pdf.drawString(MARGIN, 3.5 * mm, "TradersTrackerMT5 — TecnoHuby")
        pdf.drawRightString(W - MARGIN, 3.5 * mm,
                            f"Gerado em {dt.date.today().strftime('%d/%m/%Y')}")
        pdf.showPage()

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


# ── Schema e endpoint ─────────────────────────────────────────────────────────

class MonthlyReportRequest(BaseModel):
    month: int
    year: int


@router.post("/report/monthly")
async def monthly_report(
    req: MonthlyReportRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not (1 <= req.month <= 12):
        raise HTTPException(status_code=400, detail="Mês inválido")
    if not (2000 <= req.year <= 2100):
        raise HTTPException(status_code=400, detail="Ano inválido")

    start = dt.date(req.year, req.month, 1)
    end   = dt.date(req.year, req.month, calendar.monthrange(req.year, req.month)[1])

    profile, daily_rows, fx_rate = (
        await _get_profile(session, user.id),
        await _get_daily(session, user.id, start, end),
        await _get_fx_rate(session, end),
    )

    try:
        pdf_bytes = _build_report(req.year, req.month, profile, daily_rows, fx_rate)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    month_names = [
        "", "jan", "fev", "mar", "abr", "mai", "jun",
        "jul", "ago", "set", "out", "nov", "dez",
    ]
    filename = f"relatorio_{month_names[req.month]}_{req.year}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
