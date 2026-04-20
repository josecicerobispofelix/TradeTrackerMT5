from typing import Optional

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import (
    clear_session_cookie,
    create_session,
    hash_password,
    set_session_cookie,
    verify_password,
)
from ..db import get_session
from ..models import Import, Session, Trade, User

router = APIRouter()

ADMIN_USERNAME = "admin"


class LoginPayload(BaseModel):
    password: str


class SetPasswordPayload(BaseModel):
    password: str = Field(..., min_length=4)
    confirm_password: str


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=4)


class UserOut(BaseModel):
    id: int
    username: str


class UserWithTokenOut(BaseModel):
    id: int
    username: str
    token: str
    expires_at: str


class StatusOut(BaseModel):
    configured: bool


async def _get_admin(session: AsyncSession) -> Optional[User]:
    return await session.scalar(select(User).where(User.email == ADMIN_USERNAME))


@router.get("/auth/status", response_model=StatusOut)
async def auth_status(session: AsyncSession = Depends(get_session)):
    user = await _get_admin(session)
    return StatusOut(configured=user is not None)


@router.post("/auth/setup")
async def setup(
    payload: SetPasswordPayload,
    response: Response,
    session: AsyncSession = Depends(get_session),
    x_return_token: Optional[str] = Header(None, alias="X-Return-Token"),
):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="As senhas não conferem")

    existing = await _get_admin(session)
    if existing:
        raise HTTPException(status_code=400, detail="Senha já configurada. Use 'Alterar senha'.")

    user = User(email=ADMIN_USERNAME, password_hash=hash_password(payload.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Vincula dados existentes sem dono
    await session.execute(update(Trade).where(Trade.user_id.is_(None)).values(user_id=user.id))
    await session.execute(update(Import).where(Import.user_id.is_(None)).values(user_id=user.id))
    await session.commit()

    token, expires_at = await create_session(session, user.id)
    if (x_return_token or "").lower() == "true":
        return UserWithTokenOut(id=user.id, username=ADMIN_USERNAME, token=token, expires_at=expires_at.isoformat())
    set_session_cookie(response, token, expires_at)
    return UserOut(id=user.id, username=ADMIN_USERNAME)


@router.post("/auth/login")
async def login(
    payload: LoginPayload,
    response: Response,
    session: AsyncSession = Depends(get_session),
    x_return_token: Optional[str] = Header(None, alias="X-Return-Token"),
):

    user = await _get_admin(session)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Usuário ou senha inválidos")

    token, expires_at = await create_session(session, user.id)
    if (x_return_token or "").lower() == "true":
        return UserWithTokenOut(id=user.id, username=ADMIN_USERNAME, token=token, expires_at=expires_at.isoformat())
    set_session_cookie(response, token, expires_at)
    return UserOut(id=user.id, username=ADMIN_USERNAME)


@router.post("/auth/logout")
async def logout(
    response: Response,
    session: AsyncSession = Depends(get_session),
    token: Optional[str] = Cookie(default=None, alias="ttmt5_session"),
):
    if token:
        await session.execute(delete(Session).where(Session.token == token))
        await session.commit()
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/auth/me")
async def me(
    session: AsyncSession = Depends(get_session),
    token: Optional[str] = Cookie(default=None, alias="ttmt5_session"),
):
    from datetime import timezone as tz
    if not token:
        raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")
    record = await session.scalar(select(Session).where(Session.token == token))
    if not record:
        raise HTTPException(status_code=401, detail="SESSION_EXPIRED")

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=tz.utc)
    else:
        expires_at = expires_at.astimezone(tz.utc)

    from datetime import datetime
    if expires_at < datetime.now(tz.utc):
        raise HTTPException(status_code=401, detail="SESSION_EXPIRED")

    user = await session.get(User, record.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="USER_NOT_FOUND")
    return UserOut(id=user.id, username=ADMIN_USERNAME)


@router.post("/auth/change-password")
async def change_password(
    payload: ChangePasswordPayload,
    session: AsyncSession = Depends(get_session),
    token: Optional[str] = Cookie(default=None, alias="ttmt5_session"),
):
    if not token:
        raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")
    record = await session.scalar(select(Session).where(Session.token == token))
    if not record:
        raise HTTPException(status_code=401, detail="SESSION_EXPIRED")

    user = await session.get(User, record.user_id)
    if not user or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")

    await session.execute(
        update(User).where(User.id == user.id).values(password_hash=hash_password(payload.new_password))
    )
    await session.commit()
    return {"ok": True}
