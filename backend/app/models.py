import datetime as dt

from sqlalchemy import Date, DateTime, Integer, JSON, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Import(Base):
    __tablename__ = "imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
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
