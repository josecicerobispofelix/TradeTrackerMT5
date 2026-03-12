"""Dashboard stats for mobile app."""
import calendar
import datetime as dt
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import FXRate, Trade, User

router = APIRouter()


class DailyStatItem(BaseModel):
    date: str
    trades: int
    wins: int
    losses: int
    net_profit: float
    net_profit_brl: Optional[float] = None


class DashboardStatsResponse(BaseModel):
    month: str
    total_trades: int
    total_wins: int
    total_losses: int
    win_rate_pct: float
    net_profit: float
    net_profit_brl: Optional[float] = None
    gross_profit: float
    gross_loss: float
    profit_factor: Optional[float] = None
    daily: List[DailyStatItem]


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    month: str = Query(..., description="YYYY-MM"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Aggregated stats for the given month (mobile dashboard)."""
    try:
        year, month_num = month.split("-")
        month_start = dt.date(int(year), int(month_num), 1)
    except Exception:
        month_start = dt.date.today().replace(day=1)
    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    month_end = dt.date(month_start.year, month_start.month, last_day)

    profit_expr = Trade.profit
    net_expr = Trade.profit + Trade.commission + Trade.swap

    stmt = (
        select(
            Trade.close_date.label("day"),
            func.count(Trade.id).label("trades"),
            func.sum(case((profit_expr > 0, 1), else_=0)).label("wins"),
            func.sum(case((profit_expr < 0, 1), else_=0)).label("losses"),
            func.sum(case((profit_expr > 0, profit_expr), else_=0)).label("gross_profit"),
            func.sum(case((profit_expr < 0, profit_expr), else_=0)).label("gross_loss"),
            func.sum(net_expr).label("net_profit"),
        )
        .where(
            Trade.user_id == user.id,
            Trade.close_date >= month_start,
            Trade.close_date <= month_end,
        )
        .group_by(Trade.close_date)
        .order_by(Trade.close_date)
    )
    rows = (await session.execute(stmt)).all()
    by_day = {row.day: row for row in rows}

    rates = (await session.execute(select(FXRate).where(FXRate.date <= month_end).order_by(FXRate.date.desc()))).scalars().all()
    rate_map = {}
    if rates:
        sorted_rates = sorted(rates, key=lambda r: r.date)
        idx = 0
        for n in range((month_end - month_start).days + 1):
            day = month_start + dt.timedelta(days=n)
            while idx < len(sorted_rates) and sorted_rates[idx].date <= day:
                rate_map[day] = float(sorted_rates[idx].usd_brl_rate)
                idx += 1
            if day not in rate_map and sorted_rates:
                rate_map[day] = float(sorted_rates[-1].usd_brl_rate)

    total_trades = 0
    total_wins = 0
    total_losses = 0
    total_net = 0.0
    total_net_brl = 0.0
    gross_profit = 0.0
    gross_loss = 0.0
    daily: List[DailyStatItem] = []

    for n in range((month_end - month_start).days + 1):
        day = month_start + dt.timedelta(days=n)
        row = by_day.get(day)
        trades = int(row.trades) if row else 0
        wins = int(row.wins) if row else 0
        losses = int(row.losses) if row else 0
        net = float(row.net_profit or 0) if row else 0.0
        gp = float(row.gross_profit or 0) if row else 0.0
        gl = float(row.gross_loss or 0) if row else 0.0
        fx = rate_map.get(day)
        net_brl = net * fx if fx else None

        daily.append(
            DailyStatItem(
                date=day.isoformat(),
                trades=trades,
                wins=wins,
                losses=losses,
                net_profit=net,
                net_profit_brl=net_brl,
            )
        )
        total_trades += trades
        total_wins += wins
        total_losses += losses
        total_net += net
        if net_brl is not None:
            total_net_brl += net_brl
        gross_profit += gp
        gross_loss += gl

    win_rate = (total_wins / total_trades * 100) if total_trades else 0.0
    profit_factor = (gross_profit / abs(gross_loss)) if gross_loss else None

    return DashboardStatsResponse(
        month=month_start.strftime("%Y-%m"),
        total_trades=total_trades,
        total_wins=total_wins,
        total_losses=total_losses,
        win_rate_pct=round(win_rate, 2),
        net_profit=round(total_net, 2),
        net_profit_brl=round(total_net_brl, 2) if total_net_brl else None,
        gross_profit=round(gross_profit, 2),
        gross_loss=round(gross_loss, 2),
        profit_factor=round(profit_factor, 4) if profit_factor is not None else None,
        daily=daily,
    )
