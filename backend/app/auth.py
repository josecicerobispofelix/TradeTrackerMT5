import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import Session, User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _session_ttl_days() -> int:
    try:
        return int(os.getenv("SESSION_TTL_DAYS", "30"))
    except Exception:
        return 30


def _hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt_bytes = salt or secrets.token_bytes(16)
    iterations = 200_000
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, iterations)
    return (
        "pbkdf2_sha256$"
        f"{iterations}$"
        f"{base64.b64encode(salt_bytes).decode('utf-8')}$"
        f"{base64.b64encode(dk).decode('utf-8')}"
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iter_str, salt_b64, hash_b64 = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iter_str)
        salt = base64.b64decode(salt_b64.encode("utf-8"))
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return base64.b64encode(dk).decode("utf-8") == hash_b64
    except Exception:
        return False


def hash_password(password: str) -> str:
    return _hash_password(password)


async def create_session(
    session: AsyncSession, user_id: int
) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = _now() + timedelta(days=_session_ttl_days())
    session.add(Session(user_id=user_id, token=token, expires_at=expires_at))
    await session.commit()
    return token, expires_at


def set_session_cookie(response: Response, token: str, expires_at: datetime) -> None:
    expires_at = _as_utc(expires_at)
    response.set_cookie(
        key="ttmt5_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        expires=int(expires_at.timestamp()),
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie("ttmt5_session")


async def get_current_user(
    session: AsyncSession = Depends(get_session),
    token: Optional[str] = Cookie(default=None, alias="ttmt5_session"),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")

    record = await session.scalar(select(Session).where(Session.token == token))
    if not record or _as_utc(record.expires_at) < _now():
        raise HTTPException(status_code=401, detail="SESSION_EXPIRED")

    user = await session.get(User, record.user_id)
    if not user:
        await session.execute(delete(Session).where(Session.token == token))
        await session.commit()
        raise HTTPException(status_code=401, detail="USER_NOT_FOUND")

    return user
