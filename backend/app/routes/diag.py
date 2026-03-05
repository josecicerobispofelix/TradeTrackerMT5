from fastapi import APIRouter
from pydantic import BaseModel

from ..desktop import _log  # reuse existing logger

router = APIRouter()


class FrontLogPayload(BaseModel):
    message: str
    stack: str | None = None
    level: str | None = "info"


@router.post("/diag/log")
async def frontend_log(payload: FrontLogPayload):
    level = (payload.level or "info").upper()
    _log(f"[FRONTEND {level}] {payload.message}")
    if payload.stack:
        _log(payload.stack)
    return {"ok": True}

