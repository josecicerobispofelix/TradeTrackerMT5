import base64
import hashlib
import hmac
import json
import os
import platform
import uuid
from pathlib import Path
from typing import Optional


def _secret() -> str:
    return os.getenv("LICENSE_SECRET", "TTMT5-LOCAL-SECRET")


def _license_dir() -> Path:
    custom = os.getenv("LICENSE_PATH")
    if custom:
        path = Path(custom)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path.parent

    base = os.getenv("APPDATA")
    if base:
        return Path(base) / "TradeTrackerMT5"
    return Path.home() / ".tradetracker"


def license_path() -> Path:
    folder = _license_dir()
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "license.json"


def get_machine_code() -> str:
    raw = f"{uuid.getnode()}-{platform.node()}".encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest().upper()
    return digest[:16]


def _normalize_key(value: str) -> str:
    return "".join(ch for ch in value.upper() if ch.isalnum())


def generate_key(machine_code: str, secret: Optional[str] = None) -> str:
    secret_value = secret or _secret()
    msg = _normalize_key(machine_code).encode("utf-8")
    digest = hmac.new(secret_value.encode("utf-8"), msg, hashlib.sha256).digest()
    token = base64.b32encode(digest).decode("utf-8").replace("=", "")
    short = token[:24]
    return "-".join(short[i : i + 4] for i in range(0, len(short), 4))


def verify_key(key: str, machine_code: str) -> bool:
    expected = _normalize_key(generate_key(machine_code))
    provided = _normalize_key(key)
    return hmac.compare_digest(expected, provided)


def load_license() -> Optional[dict]:
    path = license_path()
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_license(key: str, machine_code: str) -> None:
    data = {"key": key, "machine_code": machine_code}
    license_path().write_text(json.dumps(data), encoding="utf-8")


def is_activated() -> bool:
    data = load_license()
    if not data:
        return False
    key = data.get("key", "")
    machine_code = data.get("machine_code", "")
    if not key or not machine_code:
        return False
    return verify_key(key, machine_code)
