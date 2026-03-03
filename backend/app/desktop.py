import os
import sys
import threading
import time
from pathlib import Path

import uvicorn
import webview


def _resource_base() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parents[2]


def _data_base() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parents[2]


def _load_env_file():
    base_dir = _data_base()
    env_file = base_dir / "TradeTrackerMT5.env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#") or "=" not in clean:
            continue
        key, value = clean.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _ensure_db():
    if os.environ.get("DATABASE_URL"):
        return
    base_dir = _data_base()
    data_dir = base_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "tradetracker.db"
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")


def _ensure_frontend_env():
    base = _resource_base()
    static_dir = base / "frontend" / "dist"
    if static_dir.exists():
        os.environ.setdefault("STATIC_DIR", static_dir.as_posix())


def _run_migrations():
    from alembic import command
    from alembic.config import Config

    base = _resource_base()
    alembic_ini = base / "backend" / "alembic.ini"
    alembic_dir = base / "backend" / "alembic"

    if not alembic_ini.exists():
        return

    config = Config(alembic_ini.as_posix())
    config.set_main_option("script_location", alembic_dir.as_posix())
    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(config, "head")


def _run_server():
    config = uvicorn.Config(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        log_level="info",
        reload=False,
    )
    server = uvicorn.Server(config)
    server.run()


def main():
    os.environ.setdefault(
        "CORS_ORIGINS", "http://localhost,http://127.0.0.1"
    )
    _load_env_file()
    _ensure_db()
    _ensure_frontend_env()
    _run_migrations()

    thread = threading.Thread(target=_run_server, daemon=True)
    thread.start()
    time.sleep(0.8)

    webview.create_window("TradeTrackerMT5", "http://127.0.0.1:8000")
    webview.start()


if __name__ == "__main__":
    main()
