import hashlib


import os


from datetime import datetime, timedelta, timezone


from email.message import EmailMessage


from typing import Optional





import smtplib


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


from ..models import Import, PasswordReset, Session, Trade, User





router = APIRouter()








class RegisterPayload(BaseModel):


    email: str


    password: str = Field(..., min_length=6)








class LoginPayload(BaseModel):


    email: str


    password: str








class UserOut(BaseModel):
    id: int
    email: str


class UserWithTokenOut(BaseModel):
    id: int
    email: str
    token: str
    expires_at: str








class ResetRequestPayload(BaseModel):


    email: str








class ResetPasswordPayload(BaseModel):


    token: str


    new_password: str = Field(..., min_length=6)








def _now() -> datetime:


    return datetime.now(timezone.utc)








def _reset_ttl_hours() -> int:


    try:


        return int(os.getenv("RESET_TTL_HOURS", "2"))


    except Exception:


        return 2








def _smtp_configured() -> bool:


    host = os.getenv("SMTP_HOST")


    return bool(host and host.strip())








def _send_reset_email(to_email: str, token: str) -> None:


    host = os.getenv("SMTP_HOST")


    port = int(os.getenv("SMTP_PORT", "587"))


    user = os.getenv("SMTP_USER")


    password = os.getenv("SMTP_PASSWORD")


    sender = os.getenv("SMTP_FROM") or user or "no-reply@local"





    if not host:


        return





    msg = EmailMessage()


    msg["Subject"] = "Redefinição de senha - TradersTrackerMT5"


    msg["From"] = sender


    msg["To"] = to_email


    msg.set_content(


        "Use o código abaixo para redefinir sua senha no TradersTrackerMT5:\n\n"


        f"{token}\n\n"


        "Se você não solicitou, ignore este e-mail."


    )





    with smtplib.SMTP(host, port, timeout=10) as server:


        server.starttls()


        if user and password:


            server.login(user, password)


        server.send_message(msg)








@router.post("/auth/register")
async def register(
    payload: RegisterPayload,
    response: Response,
    session: AsyncSession = Depends(get_session),
    x_return_token: Optional[str] = Header(None, alias="X-Return-Token"),
):
    email = payload.email.lower().strip()


    existing = await session.scalar(select(User).where(User.email == email))


    if existing:


        raise HTTPException(status_code=400, detail="E-mail já cadastrado")





    user = User(email=email, password_hash=hash_password(payload.password))


    session.add(user)


    await session.commit()


    await session.refresh(user)





    # Se for o primeiro usuário, vincula dados existentes sem usuário


    total_users = await session.scalar(select(func.count(User.id)))


    if total_users == 1:


        await session.execute(


            update(Trade).where(Trade.user_id.is_(None)).values(user_id=user.id)


        )


        await session.execute(


            update(Import).where(Import.user_id.is_(None)).values(user_id=user.id)


        )


        await session.commit()





    token, expires_at = await create_session(session, user.id)
    if (x_return_token or "").lower() == "true":
        return UserWithTokenOut(
            id=user.id,
            email=user.email,
            token=token,
            expires_at=expires_at.isoformat(),
        )
    set_session_cookie(response, token, expires_at)
    return UserOut(id=user.id, email=user.email)


@router.post("/auth/login")
async def login(
    payload: LoginPayload,
    response: Response,
    session: AsyncSession = Depends(get_session),
    x_return_token: Optional[str] = Header(None, alias="X-Return-Token"),
):
    email = payload.email.lower().strip()


    user = await session.scalar(select(User).where(User.email == email))


    if not user:


        total_users = await session.scalar(select(func.count(User.id)))


        if total_users == 0:


            user = User(email=email, password_hash=hash_password(payload.password))


            session.add(user)


            await session.commit()


            await session.refresh(user)





    if not user or not verify_password(payload.password, user.password_hash):


        raise HTTPException(status_code=400, detail="E-mail ou senha inválidos")





    token, expires_at = await create_session(session, user.id)
    if (x_return_token or "").lower() == "true":
        return UserWithTokenOut(
            id=user.id,
            email=user.email,
            token=token,
            expires_at=expires_at.isoformat(),
        )
    set_session_cookie(response, token, expires_at)
    return UserOut(id=user.id, email=user.email)


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








@router.get("/auth/me", response_model=UserOut)


async def me(


    session: AsyncSession = Depends(get_session),


    token: Optional[str] = Cookie(default=None, alias="ttmt5_session"),


):


    if not token:


        raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")


    record = await session.scalar(select(Session).where(Session.token == token))


    if not record:


        raise HTTPException(status_code=401, detail="SESSION_EXPIRED")





    expires_at = record.expires_at


    if expires_at.tzinfo is None:


        expires_at = expires_at.replace(tzinfo=timezone.utc)


    else:


        expires_at = expires_at.astimezone(timezone.utc)





    if expires_at < _now():


        raise HTTPException(status_code=401, detail="SESSION_EXPIRED")


    user = await session.get(User, record.user_id)


    if not user:


        raise HTTPException(status_code=401, detail="USER_NOT_FOUND")


    return UserOut(id=user.id, email=user.email)








@router.post("/auth/request-reset")


async def request_reset(


    payload: ResetRequestPayload,


    session: AsyncSession = Depends(get_session),


):


    email = payload.email.lower().strip()


    user = await session.scalar(select(User).where(User.email == email))


    if not user:


        return {"message": "Se o e-mail existir, enviaremos as instruções."}





    raw_token = hashlib.sha256(os.urandom(32)).hexdigest().upper()[:20]


    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


    expires_at = _now() + timedelta(hours=_reset_ttl_hours())





    reset = PasswordReset(


        user_id=user.id,


        token_hash=token_hash,


        expires_at=expires_at,


    )


    session.add(reset)


    await session.commit()





    if _smtp_configured():


        try:


            _send_reset_email(user.email, raw_token)


        except Exception:


            # Falha de envio: ainda permite reset manual


            pass


        return {"message": "Se o e-mail existir, enviaremos as instruções."}





    return {


        "message": "Reset gerado. Configure SMTP para envio automático.",


        "reset_token": raw_token,


    }








@router.post("/auth/reset")


async def reset_password(


    payload: ResetPasswordPayload,


    session: AsyncSession = Depends(get_session),


):


    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()


    record = await session.scalar(


        select(PasswordReset).where(PasswordReset.token_hash == token_hash)


    )


    if not record or record.used_at is not None:


        raise HTTPException(status_code=400, detail="Token inválido ou expirado")





    expires_at = record.expires_at


    if expires_at.tzinfo is None:


        expires_at = expires_at.replace(tzinfo=timezone.utc)


    else:


        expires_at = expires_at.astimezone(timezone.utc)





    if expires_at < _now():


        raise HTTPException(status_code=400, detail="Token inválido ou expirado")





    await session.execute(


        update(User)


        .where(User.id == record.user_id)


        .values(password_hash=hash_password(payload.new_password))


    )


    await session.execute(


        update(PasswordReset)


        .where(PasswordReset.id == record.id)


        .values(used_at=_now())


    )


    await session.commit()


    return {"ok": True}


