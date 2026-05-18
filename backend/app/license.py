"""
Gerenciamento de licença do desktop.
- Ativa e valida chaves contra o servidor Render online.
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
    "https://tradetrackermt5.onrender.com",
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
            global _cache_result, _cache_until
            _save({
                "key": key.upper().strip(),
                "machine_code": machine_code,
                "valid": True,
                "last_validated": datetime.now(timezone.utc).isoformat(),
                "expires_at": data.get("expires_at"),
            })
            _cache_result = True
            _cache_until = datetime.now(timezone.utc) + timedelta(minutes=CACHE_MINUTES)
            return True
        return False
    except Exception:
        return False


def save_license(key: str, machine_code: str) -> None:
    """Salva dados de licença localmente (chamado após verify_key)."""
    existing = _load()
    existing.update({"key": key, "machine_code": machine_code})
    _save(existing)


# Cache em memória: evita chamar o Railway em toda requisição
_cache_result: Optional[bool] = None
_cache_until: Optional[datetime] = None
CACHE_MINUTES = int(os.getenv("LICENSE_CACHE_MINUTES", "10"))


def is_activated() -> bool:
    """
    Verifica se a licença está ativa.
    1. Usa cache em memória por CACHE_MINUTES (padrão 10min).
    2. Tenta validar online no servidor Railway.
    3. Se offline, aceita cache local por até GRACE_DAYS dias.
    """
    global _cache_result, _cache_until

    now = datetime.now(timezone.utc)

    # Retorna cache em memória se ainda válido
    if _cache_result is not None and _cache_until and now < _cache_until:
        return _cache_result

    def _set_cache(value: bool) -> bool:
        global _cache_result, _cache_until
        _cache_result = value
        _cache_until = now + timedelta(minutes=CACHE_MINUTES)
        return value

    data = _load()
    if not data.get("key"):
        return _set_cache(False)

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
            data["last_validated"] = now.isoformat()
            _save(data)
            return _set_cache(True)
        else:
            # Chave revogada — limpa cache
            _save({})
            return _set_cache(False)
    except Exception:
        pass

    # Offline — usa cache local com grace period
    last = data.get("last_validated")
    if last and data.get("valid"):
        try:
            last_dt = datetime.fromisoformat(last)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if now - last_dt < timedelta(days=GRACE_DAYS):
                return _set_cache(True)
        except Exception:
            pass

    return _set_cache(False)


def load_license() -> Optional[dict]:
    return _load() or None
