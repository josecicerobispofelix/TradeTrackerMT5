import base64
import os
import sys
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
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


def _log_path() -> Path:
    base_dir = _data_base()
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / "app.log"


def _log(message: str, exc: Optional[BaseException] = None) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    if exc:
        line = f"{line}: {exc}"
    try:
        with _log_path().open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except Exception:
        pass


def _log_trace(prefix: str) -> None:
    _log(prefix)
    for line in traceback.format_exc().splitlines():
        _log(line)


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
    base_dir = _data_base()
    data_dir = base_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "tradetracker.db"

    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("sqlite"):
        marker = ":///"
        if marker in db_url:
            path_part = db_url.split(marker, 1)[1]
            if not Path(path_part).is_absolute():
                fixed = base_dir / Path(path_part)
                os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{fixed.as_posix()}"
                return
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")


def _ensure_backend_on_path():
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        backend_dir = _resource_base() / "backend"
    else:
        backend_dir = Path(__file__).resolve().parents[1]
    if backend_dir.exists():
        sys.path.insert(0, str(backend_dir))


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
    host = os.environ.get("APP_HOST", "127.0.0.1")
    port = int(os.environ.get("APP_PORT", "18100"))
    try:
        import importlib

        importlib.import_module("app.main")
    except Exception:
        _log_trace("Falha ao importar app.main")
        return
    config = uvicorn.Config(
        "app.main:app",
        host=host,
        port=port,
        log_level="info",
        reload=False,
    )
    server = uvicorn.Server(config)
    try:
        server.run()
    except Exception:
        _log_trace("Erro ao iniciar servidor")


def _wait_for_server(url: str, timeout: float = 15.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            with httpx.Client(timeout=1.0) as client:
                res = client.get(url)
                if res.status_code < 500:
                    return True
        except Exception:
            time.sleep(0.25)
    return False


def _show_error_window(title: str, message: str) -> None:
    log_file = _log_path()
    html = f"""
    <html>
    <head>
      <meta charset=\"utf-8\" />
      <title>{title}</title>
      <style>
        body {{ font-family: Arial, sans-serif; background:#0b1220; color:#e6edf3; padding:24px; }}
        .card {{ background:#111a2b; border-radius:12px; padding:20px; max-width:700px; }}
        h1 {{ margin:0 0 12px; font-size:20px; }}
        p {{ margin:8px 0; }}
        code {{ background:#0d1626; padding:2px 6px; border-radius:6px; }}
      </style>
    </head>
    <body>
      <div class=\"card\">
        <h1>{title}</h1>
        <p>{message}</p>
        <p>Arquivo de log:</p>
        <p><code>{log_file.as_posix()}</code></p>
      </div>
    </body>
    </html>
    """
    webview.create_window(title, html=html)
    webview.start()



class _JsBridge:
    """
    Métodos expostos ao front-end via window.pywebview.api.
    Usamos para salvar o PDF localmente (evita popup de blob no WebView2).
    """

    def save_pdf(self, base64_data: str, filename: str) -> dict:
        try:
            data = base64.b64decode(base64_data)
            target_dir = Path.home() / "Downloads"
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / filename
            with target_path.open("wb") as fp:
                fp.write(data)
            _log(f"PDF salvo via bridge em {target_path}")
            return {"success": True, "path": str(target_path)}
        except Exception as exc:
            _log_trace(f"Falha ao salvar PDF: {exc}")
            return {"success": False, "error": str(exc)}

    def save_pdf_prompt(self, base64_data: str, filename: str, initial_dir: Optional[str] = None) -> dict:
        """
        Abre diálogo para o usuário escolher onde salvar.
        Retorna {"success": True, "path": "..."} ou {"success": False, "error": "..."}.
        """
        try:
            win = webview.windows[0] if webview.windows else None
            if not win:
                raise RuntimeError("Janela WebView não encontrada")

            file_types = [("PDF (*.pdf)", "*.pdf")]
            suggested = filename
            if initial_dir:
                try:
                    initial_path = Path(initial_dir)
                    if initial_path.exists() and initial_path.is_dir():
                        suggested = (initial_path / filename).as_posix()
                except Exception:
                    pass

            path = win.create_file_dialog(webview.SAVE_DIALOG, save_filename=suggested, file_types=file_types)
            if not path:
                return {"success": False, "error": "Operação cancelada pelo usuário"}

            # pywebview retorna lista quando múltiplas seleções são permitidas
            if isinstance(path, (list, tuple)):
                path = path[0]

            data = base64.b64decode(base64_data)
            target_path = Path(path)
            target_path.write_bytes(data)
            _log(f"PDF salvo via dialogo em {target_path}")
            return {"success": True, "path": str(target_path)}
        except Exception as exc:
            _log_trace(f"Falha no save_pdf_prompt: {exc}")
            return {"success": False, "error": str(exc)}

    def ping(self, message: str = "ping") -> dict:
        _log(f"Ping JS -> Python: {message}")
        return {"ok": True, "echo": message}

    def open_path(self, path: str) -> dict:
        """
        Abre o explorador no diretório informado ou seleciona o arquivo.
        """
        try:
            target = Path(path)
            if target.is_file():
                target = target.parent
            if not target.exists():
                raise FileNotFoundError(f"Caminho não encontrado: {path}")
            os.startfile(target)  # type: ignore[attr-defined]
            return {"success": True, "path": str(target)}
        except Exception as exc:
            _log_trace(f"Falha ao abrir caminho {path}: {exc}")
            return {"success": False, "error": str(exc)}


def main():
    os.environ.setdefault("CORS_ORIGINS", "http://localhost,http://127.0.0.1")
    os.environ.setdefault("PYWEBVIEW_GUI", "edgechromium")
    _log("Iniciando TradeTrackerMT5")
    try:
        _load_env_file()
        _log("Env carregado")
        _ensure_backend_on_path()
        _log("Backend preparado")
        _ensure_db()
        _log("Banco preparado")
        _ensure_frontend_env()
        _log("Frontend preparado")

        migration_error: list[BaseException] = []

        def _migration_worker() -> None:
            try:
                _run_migrations()
            except Exception as exc:
                migration_error.append(exc)

        _log("Rodando migracoes")
        migration_thread = threading.Thread(target=_migration_worker, daemon=True)
        migration_thread.start()
        migration_thread.join(timeout=30.0)
        if migration_thread.is_alive():
            raise TimeoutError("Migracoes demoraram demais")
        if migration_error:
            raise migration_error[0]
        _log("Migracoes ok")
    except Exception as exc:
        _log("Erro na inicializacao", exc)
        _show_error_window("ERRO AO INICIAR", "Falha ao preparar o banco ou configuracoes.")
        return

    try:
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()
        _log("Thread do servidor iniciada")
        host = os.environ.get("APP_HOST", "127.0.0.1")
        port = int(os.environ.get("APP_PORT", "18100"))
        url = f"http://{host}:{port}"
        if not _wait_for_server(url, timeout=20.0):
            _log("Servidor nao iniciou a tempo")
            _show_error_window("ERRO AO INICIAR", "O servidor local nao respondeu.")
            return
        _log("Servidor respondeu")

        _log("Criando janela")
        storage_dir = _data_base() / "webview"
        storage_dir.mkdir(parents=True, exist_ok=True)
        # create_window não aceita storage_path; usa webview.start(storage_path=...)
        bridge = _JsBridge()
        webview.create_window("TradeTrackerMT5", url, confirm_close=True, js_api=bridge)
        # storage_path + private_mode=False para persistir localStorage/cookies entre execuções
        webview.start(storage_path=storage_dir.as_posix(), private_mode=False)
    except Exception:
        _log_trace("Erro ao iniciar interface")
        _show_error_window("ERRO AO INICIAR", "Falha ao iniciar a interface do aplicativo.")


if __name__ == "__main__":
    main()
