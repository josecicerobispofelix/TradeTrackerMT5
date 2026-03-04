import datetime as dt
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import FXRate, Trade, User
from ..schemas import TradeListResponse, TradeMetaResponse, TradeOut

router = APIRouter()


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


@router.get("/trades", response_model=TradeListResponse)
async def list_trades(
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    symbol: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Trade).where(Trade.user_id == user.id)
    if from_:
        stmt = stmt.where(Trade.close_date >= from_)
    if to:
        stmt = stmt.where(Trade.close_date <= to)
    if symbol:
        stmt = stmt.where(Trade.symbol == symbol)
    if account:
        stmt = stmt.where(Trade.account == account)

    stmt = stmt.order_by(Trade.close_time.desc())

    trades = (await session.execute(stmt)).scalars().all()

    rates_stmt = select(FXRate)
    rates = (await session.execute(rates_stmt)).scalars().all()
    rate_map = _build_rate_map(rates)
    latest_rate = (
        float(max(rates, key=lambda r: r.date).usd_brl_rate) if rates else None
    )

    results: List[TradeOut] = []
    for trade in trades:
        net_profit = float(trade.profit) + float(trade.commission) + float(trade.swap)
        currency = (trade.currency or "USD").upper()
        if currency == "BRL":
            fx_rate = 1.0
            net_profit_brl = net_profit
        else:
            fx_rate = rate_map.get(trade.close_date) or latest_rate
            net_profit_brl = net_profit * fx_rate if fx_rate else None
        results.append(
            TradeOut(
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
            )
        )

    return TradeListResponse(trades=results, total=len(results))


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

    return TradeMetaResponse(
        symbols=[s for s in symbols if s],
        accounts=[a for a in accounts if a],
    )
