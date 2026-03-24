from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..database import get_db
from ..models import License
from ..schemas import ActivateRequest, ValidateRequest, ValidateResponse

router = APIRouter(prefix="/licenses", tags=["licenses"])


def _check_expired(license: License) -> bool:
    if license.expires_at is None:
        return False
    return datetime.now(timezone.utc) > license.expires_at.replace(tzinfo=timezone.utc)


@router.post("/activate", response_model=ValidateResponse)
def activate(req: ActivateRequest, db: Session = Depends(get_db)):
    """
    Primeira ativação de uma chave.
    Vincula a chave ao machine_id e muda status para 'active'.
    """
    lic = db.query(License).filter(License.key == req.key.upper()).first()

    if not lic:
        raise HTTPException(status_code=404, detail="Chave não encontrada.")

    if lic.status == "revoked":
        raise HTTPException(status_code=403, detail="Chave revogada.")

    if _check_expired(lic):
        raise HTTPException(status_code=403, detail="Chave expirada.")

    # Já ativa nesta mesma máquina → ok
    if lic.status == "active" and lic.machine_id == req.machine_id:
        return ValidateResponse(
            valid=True,
            status="active",
            message="Licença já ativa neste dispositivo.",
            expires_at=lic.expires_at,
        )

    # Já ativa em outra máquina
    if lic.status == "active" and lic.machine_id != req.machine_id:
        raise HTTPException(
            status_code=409,
            detail="Esta chave já está ativa em outro dispositivo. Entre em contato com o suporte para transferir.",
        )

    # Primeira ativação
    lic.status = "active"
    lic.machine_id = req.machine_id
    lic.activated_at = datetime.now(timezone.utc)
    db.commit()

    return ValidateResponse(
        valid=True,
        status="active",
        message="Licença ativada com sucesso!",
        expires_at=lic.expires_at,
    )


@router.post("/validate", response_model=ValidateResponse)
def validate(req: ValidateRequest, db: Session = Depends(get_db)):
    """
    Validação periódica (checagem no startup do app).
    Verifica se a chave ainda é válida para o machine_id informado.
    """
    lic = db.query(License).filter(License.key == req.key.upper()).first()

    if not lic:
        return ValidateResponse(valid=False, status="not_found", message="Chave não encontrada.")

    if lic.status == "revoked":
        return ValidateResponse(valid=False, status="revoked", message="Licença revogada.")

    if lic.status != "active":
        return ValidateResponse(valid=False, status="inactive", message="Licença não ativada.")

    if _check_expired(lic):
        return ValidateResponse(valid=False, status="expired", message="Licença expirada.")

    if lic.machine_id != req.machine_id:
        return ValidateResponse(
            valid=False,
            status="machine_mismatch",
            message="Dispositivo não autorizado para esta licença.",
        )

    return ValidateResponse(
        valid=True,
        status="active",
        message="Licença válida.",
        expires_at=lic.expires_at,
    )
