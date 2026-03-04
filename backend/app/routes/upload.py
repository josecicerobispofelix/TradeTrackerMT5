import hashlib
from datetime import date
from typing import Dict
import os
import traceback
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import insert, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import Import, Trade, User
from ..parser_mt5_xlsx import normalize_deal_id, parse_mt5_xlsx
from ..schemas import UploadResponse

router = APIRouter()


def _log_path() -> Path:
    base_dir = os.getenv("LOCALAPPDATA")
    if base_dir:
        return Path(base_dir) / "TradeTrackerMT5" / "app.log"
    return Path.cwd() / "app.log"


def _log(message: str) -> None:
    try:
        log_file = _log_path()
        log_file.parent.mkdir(parents=True, exist_ok=True)
        with log_file.open("a", encoding="utf-8") as handle:
            handle.write(message.rstrip() + "\n")
    except Exception:
        pass


def _log_trace(prefix: str) -> None:
    _log(prefix)
    for line in traceback.format_exc().splitlines():
        _log(line)


def build_trade_hash(user_id: int, account: str, trade: Dict) -> str:
    raw = "|".join(
        [
            str(user_id),
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
    user: User = Depends(get_current_user),
    ):
    try:
        if not file.filename or not file.filename.lower().endswith(".xlsx"):
            raise HTTPException(status_code=400, detail="Arquivo inválido. Use .xlsx")

        content = await file.read()
        file_hash = hashlib.sha256(f"{user.id}|".encode("utf-8") + content).hexdigest()

        existing_import = await session.scalar(
            select(Import).where(
                Import.user_id == user.id,
                Import.file_hash == file_hash,
            )
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
        currency = (meta.get("currency") or "USD").upper()
        report_start = meta.get("report_start")
        report_end = meta.get("report_end")

        values = []
        for trade in trades:
            deal_id = trade.get("deal_id")
            if deal_id:
                trade_uid = f"{user.id}:{account}:{deal_id}"
            else:
                trade_uid = build_trade_hash(user.id, account, trade)
            close_date = trade["close_time"].date()
            values.append(
                {
                    "account": account,
                    "user_id": user.id,
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

        total_rows = len(values)
        values_to_insert = values
        if values:
            deal_ids = {v.get("deal_id") for v in values if v.get("deal_id")}
            if deal_ids:
                expanded_ids = set()
                for deal_id in deal_ids:
                    expanded_ids.add(deal_id)
                    if deal_id.isdigit():
                        expanded_ids.add(f"{deal_id}.0")
                    elif deal_id.endswith(".0") and deal_id[:-2].isdigit():
                        expanded_ids.add(deal_id[:-2])

                existing_ids = (
                    await session.execute(
                        select(Trade.deal_id).where(
                            Trade.user_id == user.id,
                            Trade.account == account,
                            Trade.deal_id.in_(expanded_ids),
                        )
                    )
                ).scalars().all()
                existing_norm = {
                    normalize_deal_id(value)
                    for value in existing_ids
                    if value is not None
                }
                if existing_norm:
                    values_to_insert = [
                        v
                        for v in values
                        if normalize_deal_id(v.get("deal_id")) not in existing_norm
                    ]

        inserted_rows = 0
        if values_to_insert:
            bind = session.get_bind()
            dialect = bind.dialect.name if bind else "sqlite"
            if dialect == "sqlite":
                stmt = (
                    sqlite_insert(Trade)
                    .values(values_to_insert)
                    .on_conflict_do_nothing(index_elements=["trade_uid"])
                )
            elif dialect == "mysql":
                stmt = mysql_insert(Trade).values(values_to_insert).prefix_with("IGNORE")
            elif dialect == "postgresql":
                stmt = (
                    postgres_insert(Trade)
                    .values(values_to_insert)
                    .on_conflict_do_nothing(index_elements=["trade_uid"])
                )
            else:
                stmt = insert(Trade).values(values_to_insert)
            result = await session.execute(stmt)
            inserted_rows = result.rowcount or 0

        skipped_rows = total_rows - inserted_rows

        import_record = Import(
            user_id=user.id,
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
    except HTTPException:
        raise
    except Exception:
        _log_trace("Erro no upload do XLSX")
        raise HTTPException(
            status_code=500,
            detail="Falha interna ao processar o arquivo. Veja o log.",
        )
