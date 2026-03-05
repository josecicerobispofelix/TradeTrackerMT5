import datetime as dt

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Import(Base):
    __tablename__ = "imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=True
    )
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account: Mapped[str | None] = mapped_column(String(64), nullable=True)
    server: Mapped[str | None] = mapped_column(String(128), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    report_start: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    report_end: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    inserted_rows: Mapped[int] = mapped_column(Integer, default=0)
    skipped_rows: Mapped[int] = mapped_column(Integer, default=0)
    meta_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=True
    )
    account: Mapped[str] = mapped_column(String(64), index=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    side: Mapped[str] = mapped_column(String(8))
    volume: Mapped[float] = mapped_column(Numeric(18, 6))
    open_time: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    close_time: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    open_price: Mapped[float] = mapped_column(Numeric(18, 6))
    close_price: Mapped[float] = mapped_column(Numeric(18, 6))
    profit: Mapped[float] = mapped_column(Numeric(18, 6))
    commission: Mapped[float] = mapped_column(Numeric(18, 6))
    swap: Mapped[float] = mapped_column(Numeric(18, 6))
    currency: Mapped[str | None] = mapped_column(String(8), default="USD")
    deal_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trade_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    close_date: Mapped[dt.date] = mapped_column(Date, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FXRate(Base):
    __tablename__ = "fx_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, unique=True, index=True)
    usd_brl_rate: Mapped[float] = mapped_column(Numeric(18, 6))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FiscalProfile(Base):
    __tablename__ = "fiscal_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cpf: Mapped[str | None] = mapped_column(String(14), nullable=True)
    birth_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    cep: Mapped[str | None] = mapped_column(String(16), nullable=True)
    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    complement: Mapped[str | None] = mapped_column(String(128), nullable=True)
    neighborhood: Mapped[str | None] = mapped_column(String(128), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    state: Mapped[str | None] = mapped_column(String(32), nullable=True)
    broker: Mapped[str | None] = mapped_column(String(128), nullable=True)
    trading_account: Mapped[str | None] = mapped_column(String(64), nullable=True)
    account_currency: Mapped[str] = mapped_column(String(8), default="USD")
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 4), default=0.15)
    fx_source: Mapped[str | None] = mapped_column(String(16), default="manual")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DarfReport(Base):
    __tablename__ = "darf_reports"
    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_darf_user_month"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    trades_count: Mapped[int] = mapped_column(Integer, default=0)
    profit_usd: Mapped[float] = mapped_column(Numeric(18, 6), default=0)
    profit_brl: Mapped[float] = mapped_column(Numeric(18, 6), default=0)
    fx_rate: Mapped[float] = mapped_column(Numeric(18, 6), default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 4), default=0.15)
    tax_due: Mapped[float] = mapped_column(Numeric(18, 6), default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
