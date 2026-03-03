import datetime as dt

import httpx


class FxProviderError(RuntimeError):
    pass


async def _fetch_from_frankfurter(target: dt.date | None) -> float | None:
    path = target.isoformat() if target else "latest"
    url = f"https://api.frankfurter.app/{path}?from=USD&to=BRL"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        rates = data.get("rates") or {}
        if "BRL" in rates:
            return float(rates["BRL"])
    except Exception:
        return None
    return None


async def _fetch_from_exchangerate_host(target: dt.date | None) -> float | None:
    if not target:
        target = dt.date.today()
    url = f"https://api.exchangerate.host/{target.isoformat()}?base=USD&symbols=BRL"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        rates = data.get("rates") or {}
        if "BRL" in rates:
            return float(rates["BRL"])
    except Exception:
        return None
    return None


async def _fetch_from_open_er_api() -> float | None:
    url = "https://open.er-api.com/v6/latest/USD"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        rates = data.get("rates") or {}
        if "BRL" in rates:
            return float(rates["BRL"])
    except Exception:
        return None
    return None


async def fetch_usd_brl_rate(target: dt.date | None = None) -> float:
    providers = [
        _fetch_from_frankfurter,
        _fetch_from_exchangerate_host,
        _fetch_from_open_er_api,
    ]
    for provider in providers:
        rate = await provider(target)
        if rate is not None:
            return rate
    raise FxProviderError("Falha ao buscar taxa USD/BRL")
