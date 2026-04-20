"""
Webhook Hotmart — gera chave automaticamente após compra aprovada
e envia por e-mail ao cliente.

Configure no painel Hotmart:
  URL: https://<seu-servidor>/webhook/hotmart?hottok=<HOTMART_HOTTOK>
  Eventos: PURCHASE_APPROVED, PURCHASE_COMPLETE

Variáveis de ambiente:
  HOTMART_HOTTOK  — token secreto definido por você no painel Hotmart
  SMTP_*          — configurações de e-mail (ver email_sender.py)
"""

import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..email_sender import send_license_key
from ..models import License
from ..utils import generate_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhook"])

HOTMART_HOTTOK = os.getenv("HOTMART_HOTTOK", "")

# Eventos que disparam geração de chave
APPROVED_EVENTS = {"PURCHASE_APPROVED", "PURCHASE_COMPLETE"}


def _extract_buyer(data: dict) -> tuple[str, str]:
    """Retorna (email, nome) do comprador a partir do payload Hotmart."""
    buyer = data.get("buyer") or data.get("purchase", {}).get("buyer") or {}
    email = buyer.get("email", "").strip()
    name  = buyer.get("name", "").strip() or email.split("@")[0]
    return email, name


def _extract_transaction(data: dict) -> str | None:
    purchase = data.get("purchase") or {}
    return purchase.get("transaction") or purchase.get("order_key") or None


@router.post("/webhook/hotmart", status_code=200)
async def hotmart_webhook(
    request: Request,
    hottok: str = Query(default=""),
    db: Session = Depends(get_db),
):
    """
    Recebe eventos da Hotmart. Gera e envia a chave de licença
    automaticamente quando uma compra é aprovada.
    """
    # ── 1. Validar token ──────────────────────────────────────────────────────
    if HOTMART_HOTTOK and hottok != HOTMART_HOTTOK:
        logger.warning("Webhook Hotmart: hottok inválido.")
        raise HTTPException(status_code=401, detail="Token inválido.")

    # ── 2. Ler payload ────────────────────────────────────────────────────────
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload inválido.")

    event = (payload.get("event") or "").upper()
    data  = payload.get("data") or {}

    logger.info("Webhook Hotmart recebido: event=%s", event)

    # ── 3. Ignorar eventos que não geram chave ────────────────────────────────
    if event not in APPROVED_EVENTS:
        return {"ok": True, "action": "ignored", "event": event}

    # ── 4. Extrair dados do comprador ─────────────────────────────────────────
    email, name = _extract_buyer(data)
    if not email:
        logger.error("Webhook Hotmart: e-mail do comprador não encontrado. payload=%s", payload)
        raise HTTPException(status_code=422, detail="E-mail do comprador não encontrado no payload.")

    transaction_id = _extract_transaction(data)

    # ── 5. Gerar chave (garante unicidade) ────────────────────────────────────
    key = generate_key()
    while db.query(License).filter(License.key == key).first():
        key = generate_key()

    lic = License(
        key=key,
        status="inactive",
        email=email,
        transaction_id=transaction_id,
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)

    logger.info("Chave gerada: key=%s email=%s txn=%s", key, email, transaction_id)

    # ── 6. Enviar e-mail ──────────────────────────────────────────────────────
    try:
        send_license_key(
            to_email=email,
            to_name=name,
            key=key,
            transaction_id=transaction_id,
        )
        logger.info("E-mail enviado para %s", email)
    except Exception as exc:
        # Chave já foi salva — não falha o webhook, apenas loga
        logger.error("Falha ao enviar e-mail para %s: %s", email, exc)

    return {"ok": True, "action": "key_generated", "key": key, "email": email}
