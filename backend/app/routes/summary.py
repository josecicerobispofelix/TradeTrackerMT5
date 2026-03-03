import calendar
import datetime as dt
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..fx_provider import FxProviderError, fetch_usd_brl_rate
from ..models import FXRate, Trade
from ..schemas import DailySummary, SummaryResponse

router = APIRouter()


def _parse_month(month: str) -> dt.date:
    try:
        year, month_num = month.split("-")
        return dt.date(int(year), int(month_num), 1)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Formato do mês inválido") from exc


def _compute_rate_map(
    rates: List[FXRate], start: dt.date, end: dt.date
) -> Dict[dt.date, float]:
    rates_sorted = sorted(rates, key=lambda r: r.date)
    latest_rate = rates_sorted[-1].usd_brl_rate if rates_sorted else None
    rate_map: Dict[dt.date, float] = {}
    current_rate = latest_rate
    idx = 0
    for n in range((end - start).days + 1):
        day = start + dt.timedelta(days=n)
        while idx < len(rates_sorted) and rates_sorted[idx].date <= day:
            current_rate = rates_sorted[idx].usd_brl_rate
            idx += 1
        if current_rate is not None:
            rate_map[day] = float(current_rate)
    return rate_map


async def _ensure_fx_rate(session: AsyncSession) -> None:
    existing = await session.scalar(select(func.count(FXRate.id)))
    if existing and existing > 0:
        return

    today = dt.date.today()
    try:
        rate_value = await fetch_usd_brl_rate(today)
        session.add(FXRate(date=today, usd_brl_rate=rate_value))
        await session.commit()
    except (FxProviderError, Exception):
        # Falha silenciosa: mantém comportamento sem BRL
        return


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    month: str = Query(..., description="YYYY-MM"),
    session: AsyncSession = Depends(get_session),
):
    month_start = _parse_month(month)
    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    month_end = dt.date(month_start.year, month_start.month, last_day)

    net_expr = Trade.profit + Trade.commission + Trade.swap

    stmt = (
        select(
            Trade.close_date.label("day"),
            func.count(Trade.id).label("trades"),
            func.sum(case((net_expr > 0, 1), else_=0)).label("wins"),
            func.sum(case((net_expr < 0, 1), else_=0)).label("losses"),
            func.sum(case((net_expr > 0, net_expr), else_=0)).label("gross_profit"),
            func.sum(case((net_expr < 0, net_expr), else_=0)).label("gross_loss"),
            func.sum(net_expr).label("net_profit"),
        )
        .where(Trade.close_date >= month_start, Trade.close_date <= month_end)
        .group_by(Trade.close_date)
        .order_by(Trade.close_date)
    )

    rows = (await session.execute(stmt)).all()
    by_day = {row.day: row for row in rows}

    await _ensure_fx_rate(session)
    rates = (await session.execute(select(FXRate))).scalars().all()
    rate_map = _compute_rate_map(rates, month_start, month_end)

    daily: List[DailySummary] = []
    total_trades = 0
    total_net_profit = 0.0
    total_net_profit_brl = 0.0
    has_rate = False

    for n in range((month_end - month_start).days + 1):
        day = month_start + dt.timedelta(days=n)
        row = by_day.get(day)

        trades = int(row.trades) if row else 0
        wins = int(row.wins) if row else 0
        losses = int(row.losses) if row else 0
        gross_profit = float(row.gross_profit or 0) if row else 0.0
        gross_loss = float(row.gross_loss or 0) if row else 0.0
        net_profit = float(row.net_profit or 0) if row else 0.0

        win_rate = (wins / trades) * 100 if trades else 0.0
        profit_factor = None
        if gross_loss != 0:
            profit_factor = round(gross_profit / abs(gross_loss), 4)

        fx_rate = rate_map.get(day)
        net_profit_brl = net_profit * fx_rate if fx_rate else None

        daily.append(
            DailySummary(
                date=day,
                trades=trades,
                wins=wins,
                losses=losses,
                win_rate=win_rate,
                gross_profit=gross_profit,
                gross_loss=gross_loss,
                net_profit=net_profit,
                profit_factor=profit_factor,
                fx_rate=fx_rate,
                net_profit_brl=net_profit_brl,
            )
        )

        total_trades += trades
        total_net_profit += net_profit
        if net_profit_brl is not None:
            total_net_profit_brl += net_profit_brl
            has_rate = True

    return SummaryResponse(
        month=month,
        total_trades=total_trades,
        total_net_profit=total_net_profit,
        total_net_profit_brl=total_net_profit_brl if has_rate else None,
        daily=daily,
    )
