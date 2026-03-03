import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..fx_provider import FxProviderError, fetch_usd_brl_rate
from ..models import FXRate
from ..schemas import FXRateIn, FXRateListResponse, FXRateOut

router = APIRouter()


@router.get("/fx-rate", response_model=FXRateOut)
async def get_fx_rate(
    date: dt.date | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    if date:
        rate = await session.scalar(select(FXRate).where(FXRate.date == date))
    else:
        rate = await session.scalar(select(FXRate).order_by(FXRate.date.desc()))

    if not rate:
        raise HTTPException(status_code=404, detail="Nenhuma taxa cadastrada")

    return FXRateOut(date=rate.date, usd_brl_rate=float(rate.usd_brl_rate))


@router.get("/fx-rate/list", response_model=FXRateListResponse)
async def list_fx_rates(
    from_: dt.date | None = Query(None, alias="from"),
    to: dt.date | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(FXRate)
    if from_:
        stmt = stmt.where(FXRate.date >= from_)
    if to:
        stmt = stmt.where(FXRate.date <= to)
    stmt = stmt.order_by(FXRate.date)
    rates = (await session.execute(stmt)).scalars().all()
    return FXRateListResponse(
        rates=[FXRateOut(date=r.date, usd_brl_rate=float(r.usd_brl_rate)) for r in rates]
    )


@router.post("/fx-rate", response_model=FXRateOut)
async def set_fx_rate(
    payload: FXRateIn,
    session: AsyncSession = Depends(get_session),
):
    existing = await session.scalar(select(FXRate).where(FXRate.date == payload.date))
    if existing:
        existing.usd_brl_rate = payload.usd_brl_rate
        await session.commit()
        return FXRateOut(date=existing.date, usd_brl_rate=float(existing.usd_brl_rate))

    rate = FXRate(date=payload.date, usd_brl_rate=payload.usd_brl_rate)
    session.add(rate)
    await session.commit()
    return FXRateOut(date=rate.date, usd_brl_rate=float(rate.usd_brl_rate))


@router.get("/fx-rate/auto", response_model=FXRateOut)
async def fetch_fx_rate_auto(
    date: dt.date | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    target = date or dt.date.today()
    try:
        rate_value = await fetch_usd_brl_rate(target)
    except FxProviderError as exc:
        raise HTTPException(status_code=502, detail="Falha ao buscar taxa") from exc

    existing = await session.scalar(select(FXRate).where(FXRate.date == target))
    if existing:
        existing.usd_brl_rate = rate_value
        await session.commit()
        return FXRateOut(date=existing.date, usd_brl_rate=float(existing.usd_brl_rate))

    rate = FXRate(date=target, usd_brl_rate=rate_value)
    session.add(rate)
    await session.commit()
    return FXRateOut(date=rate.date, usd_brl_rate=float(rate.usd_brl_rate))
