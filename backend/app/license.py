"""
Gerenciamento de licença do desktop.
- Ativa e valida chaves contra o servidor Railway online.
- Cache local com grace period de 7 dias para uso offline.
"""
import hashlib
import json
import os
import platform
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import httpx

LICENSE_SERVER = os.getenv(
    "LICENSE_SERVER_URL",
    "https://cheerful-heart-production.up.railway.app",
)
GRACE_DAYS = int(os.getenv("LICENSE_GRACE_DAYS", "7"))


# ── Caminhos ─────────────────────────────────────────────────────────────────

def _license_dir() -> Path:
    custom = os.getenv("LICENSE_PATH")
    if custom:
        p = Path(custom)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p.parent
    base = os.getenv("APPDATA")
    if base:
        return Path(base) / "TradersTrackerMT5"
    return Path.home() / ".tradetracker"


def license_path() -> Path:
    folder = _license_dir()
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "license.json"


# ── Machine code ──────────────────────────────────────────────────────────────

def get_machine_code() -> str:
    """Fingerprint de 16 chars desta máquina (estável entre reinicializações)."""
    raw = f"{uuid.getnode()}-{platform.node()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest().upper()[:16]


# ── Persistência local ────────────────────────────────────────────────────────

def _load() -> dict:
    p = license_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict) -> None:
    license_path().write_text(
        json.dumps(data, default=str), encoding="utf-8"
    )


# ── API pública ───────────────────────────────────────────────────────────────

def verify_key(key: str, machine_code: str) -> bool:
    """
    Ativa a chave no servidor Railway e salva o cache local.
    Retorna True se a ativação foi bem-sucedida.
    """
    try:
        resp = httpx.post(
            f"{LICENSE_SERVER}/licenses/activate",
            json={"key": key.upper().strip(), "machine_id": machine_code},
            timeout=10.0,
        )
        data = resp.json()
        if resp.status_code == 200 and data.get("valid"):
            _save({
                "key": key.upper().strip(),
                "machine_code": machine_code,
                "valid": True,
                "last_validated": datetime.now(timezone.utc).isoformat(),
                "expires_at": data.get("expires_at"),
            })
            return True
        return False
    except Exception:
        return False


def save_license(key: str, machine_code: str) -> None:
    """Salva dados de licença localmente (chamado após verify_key)."""
    existing = _load()
    existing.update({"key": key, "machine_code": machine_code})
    _save(existing)


def is_activated() -> bool:
    """
    Verifica se a licença está ativa.
    1. Tenta validar online no servidor Railway.
    2. Se offline, aceita cache local por até GRACE_DAYS dias.
    """
    data = _load()
    if not data.get("key"):
        return False

    machine_code = get_machine_code()

    # Tenta validar online
    try:
        resp = httpx.post(
            f"{LICENSE_SERVER}/licenses/validate",
            json={"key": data["key"], "machine_id": machine_code},
            timeout=5.0,
        )
        result = resp.json()
        if result.get("valid"):
            data["valid"] = True
            data["last_validated"] = datetime.now(timezone.utc).isoformat()
            _save(data)
            return True
        else:
            # Chave revogada ou invalida — limpa cache
            _save({})
            return False
    except Exception:
        pass

    # Offline — usa cache com grace period
    last = data.get("last_validated")
    if last and data.get("valid"):
        try:
            last_dt = datetime.fromisoformat(last)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - last_dt < timedelta(days=GRACE_DAYS):
                return True
        except Exception:
            pass

    return False


def load_license() -> Optional[dict]:
    return _load() or None
