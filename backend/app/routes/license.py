from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..license import get_machine_code, is_activated, save_license, verify_key

router = APIRouter()


class LicenseStatus(BaseModel):
    activated: bool
    machine_code: str


class LicenseActivate(BaseModel):
    key: str


@router.get("/license/status", response_model=LicenseStatus)
async def license_status():
    return LicenseStatus(
        activated=is_activated(),
        machine_code=get_machine_code(),
    )


@router.post("/license/activate", response_model=LicenseStatus)
async def license_activate(payload: LicenseActivate):
    machine_code = get_machine_code()
    if not verify_key(payload.key, machine_code):
        raise HTTPException(status_code=400, detail="Chave inválida")
    save_license(payload.key, machine_code)
    return LicenseStatus(
        activated=True,
        machine_code=machine_code,
    )

