import hashlib
from datetime import date
from typing import Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import insert, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Import, Trade
from ..parser_mt5_xlsx import parse_mt5_xlsx
from ..schemas import UploadResponse

router = APIRouter()


def build_trade_hash(account: str, trade: Dict) -> str:
    raw = "|".join(
        [
            account,
            trade.get("symbol", ""),
            trade.get("open_time").isoformat(),
            trade.get("close_time").isoformat(),
            trade.get("side", ""),
            f"{trade.get('volume', 0):.6f}",
            f"{trade.get('open_price', 0):.6f}",
            f"{trade.get('close_price', 0):.6f}",
            f"{trade.get('profit', 0):.6f}",
            f"{trade.get('commission', 0):.6f}",
            f"{trade.get('swap', 0):.6f}",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@router.post("/upload", response_model=UploadResponse)
async def upload_report(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Arquivo inválido. Use .xlsx")

    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    existing_import = await session.scalar(
        select(Import).where(Import.file_hash == file_hash)
    )
    if existing_import:
        return UploadResponse(
            file_already_imported=True,
            total_rows=existing_import.total_rows,
            inserted_rows=existing_import.inserted_rows,
            skipped_rows=existing_import.skipped_rows,
            account=existing_import.account,
            message="Arquivo já importado",
        )

    try:
        meta, trades = parse_mt5_xlsx(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Falha ao ler XLSX: {exc}")

    account = meta.get("account") or "unknown"
    currency = meta.get("currency") or "USD"
    report_start = meta.get("report_start")
    report_end = meta.get("report_end")

    values = []
    for trade in trades:
        deal_id = trade.get("deal_id")
        if deal_id:
            trade_uid = f"{account}:{deal_id}"
        else:
            trade_uid = build_trade_hash(account, trade)
        close_date = trade["close_time"].date()
        values.append(
            {
                "account": account,
                "symbol": trade.get("symbol"),
                "side": trade.get("side"),
                "volume": trade.get("volume"),
                "open_time": trade.get("open_time"),
                "close_time": trade.get("close_time"),
                "open_price": trade.get("open_price"),
                "close_price": trade.get("close_price"),
                "profit": trade.get("profit"),
                "commission": trade.get("commission"),
                "swap": trade.get("swap"),
                "currency": currency,
                "deal_id": deal_id,
                "trade_uid": trade_uid,
                "close_date": close_date,
            }
        )

    inserted_rows = 0
    if values:
        bind = session.get_bind()
        dialect = bind.dialect.name if bind else "sqlite"
        if dialect == "sqlite":
            stmt = (
                sqlite_insert(Trade)
                .values(values)
                .on_conflict_do_nothing(index_elements=["trade_uid"])
            )
        elif dialect == "mysql":
            stmt = mysql_insert(Trade).values(values).prefix_with("IGNORE")
        elif dialect == "postgresql":
            stmt = (
                postgres_insert(Trade)
                .values(values)
                .on_conflict_do_nothing(index_elements=["trade_uid"])
            )
        else:
            stmt = insert(Trade).values(values)
        result = await session.execute(stmt)
        inserted_rows = result.rowcount or 0

    total_rows = len(values)
    skipped_rows = total_rows - inserted_rows

    import_record = Import(
        file_hash=file_hash,
        file_name=file.filename,
        account=account,
        server=meta.get("server"),
        currency=currency,
        report_start=date.fromisoformat(report_start) if report_start else None,
        report_end=date.fromisoformat(report_end) if report_end else None,
        total_rows=total_rows,
        inserted_rows=inserted_rows,
        skipped_rows=skipped_rows,
        meta_json=meta,
    )
    session.add(import_record)
    await session.commit()

    return UploadResponse(
        file_already_imported=False,
        total_rows=total_rows,
        inserted_rows=inserted_rows,
        skipped_rows=skipped_rows,
        account=account,
        message="Importação concluída",
    )
