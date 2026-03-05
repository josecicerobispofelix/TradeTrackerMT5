import datetime as dt
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class UploadResponse(BaseModel):
    file_already_imported: bool
    total_rows: int
    inserted_rows: int
    skipped_rows: int
    account: Optional[str] = None
    message: str


class TradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account: str
    symbol: str
    side: str
    volume: float
    open_time: dt.datetime
    close_time: dt.datetime
    open_price: float
    close_price: float
    profit: float
    commission: float
    swap: float
    net_profit: float
    net_profit_brl: Optional[float] = None
    fx_rate: Optional[float] = None
    currency: Optional[str] = None
    deal_id: Optional[str] = None


class TradeListResponse(BaseModel):
    trades: List[TradeOut]
    total: int


class TradeMetaResponse(BaseModel):
    symbols: List[str]
    accounts: List[str]


class DailySummary(BaseModel):
    date: dt.date
    trades: int
    wins: int
    losses: int
    win_rate: float
    gross_profit: float
    gross_loss: float
    net_profit: float
    profit_factor: Optional[float] = None
    fx_rate: Optional[float] = None
    net_profit_brl: Optional[float] = None


class SummaryResponse(BaseModel):
    month: str
    total_trades: int
    total_net_profit: float
    total_net_profit_brl: Optional[float] = None
    daily: List[DailySummary]


class FXRateIn(BaseModel):
    date: dt.date
    usd_brl_rate: float = Field(..., gt=0)


class FXRateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: dt.date
    usd_brl_rate: float


class FXRateListResponse(BaseModel):
    rates: List[FXRateOut]


class FiscalProfileIn(BaseModel):
    full_name: Optional[str] = None
    cpf: Optional[str] = None
    birth_date: Optional[dt.date] = None
    cep: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    broker: Optional[str] = None
    trading_account: Optional[str] = None
    account_currency: Optional[str] = "USD"
    tax_rate: Optional[float] = 0.15
    fx_source: Optional[str] = "manual"


class FiscalProfileOut(FiscalProfileIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int


class DarfCalcRequest(BaseModel):
    month: int
    year: int
    fx_rate: Optional[float] = None
    tax_rate: Optional[float] = None


class DarfCalcResponse(BaseModel):
    month: int
    year: int
    trades_count: int
    profit_usd: float
    profit_brl: float
    fx_rate: float
    tax_rate: float
    tax_due: float
    currency: str
    message: Optional[str] = None


class DarfHistoryItem(BaseModel):
    month: int
    year: int
    trades_count: int
    profit_usd: float
    profit_brl: float
    fx_rate: float
    tax_rate: float
    tax_due: float
    currency: str


class DarfHistoryResponse(BaseModel):
    items: List[DarfHistoryItem]
