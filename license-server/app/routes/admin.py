import os
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import License
from ..schemas import GenerateRequest, RevokeRequest, LicenseResponse
from ..utils import generate_key

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me-in-production")


def require_admin(x_admin_token: str = Header(...)):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Token de admin inválido.")


@router.post("/licenses/generate", response_model=List[LicenseResponse])
def generate(
    req: GenerateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Gera uma ou mais chaves de licença (use após venda no Hotmart)."""
    if req.quantity < 1 or req.quantity > 100:
        raise HTTPException(status_code=400, detail="quantity deve ser entre 1 e 100.")

    created = []
    for _ in range(req.quantity):
        key = generate_key()
        # garante unicidade (colisão extremamente improvável mas tratada)
        while db.query(License).filter(License.key == key).first():
            key = generate_key()

        lic = License(
            key=key,
            status="inactive",
            email=req.email,
            transaction_id=req.transaction_id,
            expires_at=req.expires_at,
            max_machines=str(req.max_machines),
        )
        db.add(lic)
        created.append(lic)

    db.commit()
    for lic in created:
        db.refresh(lic)

    return created


@router.post("/licenses/revoke", response_model=LicenseResponse)
def revoke(
    req: RevokeRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Revoga uma licença (chargeback, fraude, etc)."""
    lic = db.query(License).filter(License.key == req.key.upper()).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Chave não encontrada.")

    lic.status = "revoked"
    db.commit()
    db.refresh(lic)
    return lic


@router.post("/licenses/reset-machine", response_model=LicenseResponse)
def reset_machine(
    key: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Reseta o machine_id de uma licença.
    Use quando o cliente trocar de computador.
    """
    lic = db.query(License).filter(License.key == key.upper()).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Chave não encontrada.")

    lic.machine_id = None
    lic.status = "inactive"
    lic.activated_at = None
    db.commit()
    db.refresh(lic)
    return lic


@router.get("/licenses", response_model=List[LicenseResponse])
def list_licenses(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Lista todas as licenças, com filtro opcional por status."""
    q = db.query(License)
    if status:
        q = q.filter(License.status == status)
    return q.order_by(License.created_at.desc()).all()


@router.get("/licenses/{key}", response_model=LicenseResponse)
def get_license(
    key: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Busca uma licença pelo key."""
    lic = db.query(License).filter(License.key == key.upper()).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Chave não encontrada.")
    return lic
