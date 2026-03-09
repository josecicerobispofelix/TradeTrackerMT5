import calendar
import datetime as dt
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import DarfReport, FiscalProfile, FXRate, Trade, User
from ..schemas import (
    DarfCalcRequest,
    DarfCalcResponse,
    DarfHistoryItem,
    DarfHistoryResponse,
    FiscalProfileIn,
    FiscalProfileOut,
)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
except Exception:  # pragma: no cover - handled by build dependency
    canvas = None

router = APIRouter()


def _month_range(year: int, month: int) -> tuple[dt.date, dt.date]:
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mês inválido")
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="Ano inválido")
    start = dt.date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = dt.date(year, month, last_day)
    return start, end


def _format_currency(value: float, currency: str) -> str:
    symbol = "R$" if currency == "BRL" else "US$"
    return f"{symbol} {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _format_number(value: float) -> str:
    return f"{value:,.4f}".replace(",", "X").replace(".", ",").replace("X", ".")


async def _resolve_fx_rate(
    session: AsyncSession,
    currency: str,
    month_end: dt.date,
    fx_rate: Optional[float],
) -> float:
    if currency.upper() == "BRL":
        return 1.0
    if fx_rate is not None and fx_rate > 0:
        return float(fx_rate)

    latest = await session.scalar(
        select(FXRate).where(FXRate.date <= month_end).order_by(FXRate.date.desc())
    )
    if latest:
        return float(latest.usd_brl_rate)
    raise HTTPException(status_code=400, detail="Informe a cotação USD/BRL do mês")


async def _compute_month_profit(
    session: AsyncSession,
    user_id: int,
    start: dt.date,
    end: dt.date,
) -> tuple[int, float]:
    stmt = (
        select(
            func.count(Trade.id),
            func.coalesce(func.sum(Trade.profit), 0),
            func.coalesce(func.sum(Trade.swap), 0),
            func.coalesce(func.sum(func.abs(Trade.commission)), 0),
        )
        .where(
            Trade.user_id == user_id,
            Trade.close_date >= start,
            Trade.close_date <= end,
        )
    )
    row = (await session.execute(stmt)).one()
    trades_count = int(row[0] or 0)
    profit_sum = float(row[1] or 0)
    swap_sum = float(row[2] or 0)
    commission_abs_sum = float(row[3] or 0)
    profit_usd = profit_sum + swap_sum - commission_abs_sum
    return trades_count, profit_usd


async def _get_profile(session: AsyncSession, user_id: int) -> Optional[FiscalProfile]:
    return await session.scalar(
        select(FiscalProfile).where(FiscalProfile.user_id == user_id)
    )


def _build_pdf(data: DarfCalcResponse, profile: FiscalProfile) -> bytes:
    if canvas is None:
        raise HTTPException(status_code=500, detail="PDF indisponível")
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(50, y, "Relatório de Apuração de Imposto – TradeTracker")
    y -= 30

    pdf.setFont("Helvetica", 11)
    pdf.drawString(50, y, f"Contribuinte: {profile.full_name or ''}")
    y -= 16
    pdf.drawString(50, y, f"CPF: {profile.cpf or ''}")
    y -= 16
    pdf.drawString(50, y, f"Corretora: {profile.broker or ''}")
    y -= 16
    pdf.drawString(50, y, f"Conta: {profile.trading_account or ''}")
    y -= 24

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(50, y, "Dados de Apuração")
    y -= 18
    pdf.setFont("Helvetica", 11)
    pdf.drawString(50, y, f"Mês de apuração: {data.month:02d}/{data.year}")
    y -= 16
    pdf.drawString(50, y, f"Lucro total USD: {_format_currency(data.profit_usd, 'USD')}")
    y -= 16
    pdf.drawString(50, y, f"Cotação USD/BRL: {_format_number(data.fx_rate)}")
    y -= 16
    pdf.drawString(50, y, f"Lucro em BRL: {_format_currency(data.profit_brl, 'BRL')}")
    y -= 16
    pdf.drawString(50, y, f"Alíquota: {data.tax_rate * 100:.2f}%")
    y -= 16
    pdf.drawString(50, y, f"Imposto devido: {_format_currency(data.tax_due, 'BRL')}")
    y -= 24

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(50, y, "Dados da DARF")
    y -= 18
    pdf.setFont("Helvetica", 11)
    pdf.drawString(50, y, "Código da Receita: 8523")
    y -= 16
    pdf.drawString(50, y, "Descrição: Ganhos de capital em operações no exterior")
    y -= 16
    pdf.drawString(50, y, f"Período de apuração: {data.month:02d}/{data.year}")
    y -= 16
    pdf.drawString(50, y, f"Valor do imposto: {_format_currency(data.tax_due, 'BRL')}")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


@router.get("/fiscal-profile", response_model=FiscalProfileOut)
async def get_fiscal_profile(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = await _get_profile(session, user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil fiscal não cadastrado")
    return profile


@router.post("/fiscal-profile", response_model=FiscalProfileOut)
async def save_fiscal_profile(
    payload: FiscalProfileIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = await _get_profile(session, user.id)
    data = payload.model_dump()
    if profile:
        for key, value in data.items():
            setattr(profile, key, value)
    else:
        profile = FiscalProfile(user_id=user.id, **data)
        session.add(profile)

    await session.commit()
    await session.refresh(profile)
    return profile


@router.post("/darf/calculate", response_model=DarfCalcResponse)
async def calculate_darf(
    payload: DarfCalcRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    start, end = _month_range(payload.year, payload.month)
    profile = await _get_profile(session, user.id)
    currency = (profile.account_currency if profile else "USD") or "USD"
    fx_rate = await _resolve_fx_rate(session, currency, end, payload.fx_rate)
    tax_rate = float(payload.tax_rate or (profile.tax_rate if profile else 0.15) or 0.15)

    trades_count, profit_usd = await _compute_month_profit(session, user.id, start, end)
    profit_brl = profit_usd if currency.upper() == "BRL" else profit_usd * fx_rate
    tax_due = max(0.0, profit_brl * tax_rate)
    message = None
    if profit_brl <= 0:
        message = "Não há imposto a pagar neste mês."

    existing = await session.scalar(
        select(DarfReport).where(
            DarfReport.user_id == user.id,
            DarfReport.year == payload.year,
            DarfReport.month == payload.month,
        )
    )
    if existing:
        existing.trades_count = trades_count
        existing.profit_usd = profit_usd
        existing.profit_brl = profit_brl
        existing.fx_rate = fx_rate
        existing.tax_rate = tax_rate
        existing.tax_due = tax_due
        existing.currency = currency.upper()
    else:
        report = DarfReport(
            user_id=user.id,
            year=payload.year,
            month=payload.month,
            trades_count=trades_count,
            profit_usd=profit_usd,
            profit_brl=profit_brl,
            fx_rate=fx_rate,
            tax_rate=tax_rate,
            tax_due=tax_due,
            currency=currency.upper(),
        )
        session.add(report)

    await session.commit()

    return DarfCalcResponse(
        month=payload.month,
        year=payload.year,
        trades_count=trades_count,
        profit_usd=profit_usd,
        profit_brl=profit_brl,
        fx_rate=fx_rate,
        tax_rate=tax_rate,
        tax_due=tax_due,
        currency=currency.upper(),
        message=message,
    )


@router.get("/darf/history", response_model=DarfHistoryResponse)
async def darf_history(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    rows = (
        await session.execute(
            select(DarfReport)
            .where(DarfReport.user_id == user.id)
            .order_by(DarfReport.year.desc(), DarfReport.month.desc())
        )
    ).scalars().all()

    items = [
        DarfHistoryItem(
            month=row.month,
            year=row.year,
            trades_count=row.trades_count,
            profit_usd=float(row.profit_usd or 0),
            profit_brl=float(row.profit_brl or 0),
            fx_rate=float(row.fx_rate or 0),
            tax_rate=float(row.tax_rate or 0),
            tax_due=float(row.tax_due or 0),
            currency=row.currency or "USD",
        )
        for row in rows
    ]
    return DarfHistoryResponse(items=items)


@router.post("/darf/pdf")
async def generate_darf_pdf(
    payload: DarfCalcRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = await _get_profile(session, user.id)
    if not profile or not profile.full_name or not profile.cpf:
        raise HTTPException(status_code=400, detail="Preencha o Perfil Fiscal para gerar o PDF.")

    result = await calculate_darf(payload, session=session, user=user)
    pdf_bytes = _build_pdf(result, profile)

    filename = f"DARF_{payload.month:02d}_{payload.year}.pdf"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)


@router.post("/darf/pdf/save")
async def save_darf_pdf(
    payload: DarfCalcRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = await _get_profile(session, user.id)
    if not profile or not profile.full_name or not profile.cpf:
        raise HTTPException(status_code=400, detail="Preencha o Perfil Fiscal para gerar o PDF.")

    result = await calculate_darf(payload, session=session, user=user)
    pdf_bytes = _build_pdf(result, profile)

    filename = f"DARF_{payload.month:02d}_{payload.year}.pdf"
    target_dir = Path.home() / "Downloads"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    target_path.write_bytes(pdf_bytes)
    return {"path": str(target_path), "filename": filename}
