from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ── Requests ─────────────────────────────────────────────────────────────────

class ActivateRequest(BaseModel):
    key: str
    machine_id: str  # fingerprint SHA-256 gerado no desktop


class ValidateRequest(BaseModel):
    key: str
    machine_id: str


class GenerateRequest(BaseModel):
    email: Optional[str] = None
    transaction_id: Optional[str] = None
    expires_at: Optional[datetime] = None  # None = vitalício
    max_machines: int = 1
    quantity: int = 1  # gerar N chaves de uma vez


class RevokeRequest(BaseModel):
    key: str
    reason: Optional[str] = None


# ── Responses ────────────────────────────────────────────────────────────────

class LicenseResponse(BaseModel):
    key: str
    status: str
    email: Optional[str]
    transaction_id: Optional[str]
    machine_id: Optional[str]
    max_machines: str
    created_at: datetime
    activated_at: Optional[datetime]
    expires_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ValidateResponse(BaseModel):
    valid: bool
    status: str
    message: str
    expires_at: Optional[datetime] = None
