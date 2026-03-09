import logging
import os
import traceback
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from fastapi.responses import JSONResponse

from .license import is_activated
from .routes import (
    auth,
    darf,
    fx_rate,
    license as license_routes,
    summary,
    trades,
    upload,
    diag,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

app = FastAPI(title="TradeTrackerMT5 API", version="1.0.0")

def _log_path() -> Path:
    base_dir = os.getenv("LOCALAPPDATA")
    if base_dir:
        return Path(base_dir) / "TradeTrackerMT5" / "app.log"
    return Path.cwd() / "app.log"


def _log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    try:
        log_file = _log_path()
        log_file.parent.mkdir(parents=True, exist_ok=True)
        with log_file.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except Exception:
        pass


def _log_trace(prefix: str) -> None:
    _log(prefix)
    for line in traceback.format_exc().splitlines():
        _log(line)

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost,http://localhost:8000,http://127.0.0.1:8000",
)
origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def api_health():
    return {"status": "ok"}


@app.middleware("http")
async def request_logger(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
        elapsed = int((time.time() - start) * 1000)
        _log(f"REQ {request.method} {request.url.path} -> {response.status_code} {elapsed}ms")
        return response
    except Exception:
        _log_trace(f"REQ_ERR {request.method} {request.url.path}")
        raise


@app.middleware("http")
async def error_logger(request: Request, call_next):
    try:
        return await call_next(request)
    except HTTPException:
        raise
    except Exception:
        _log_trace(f"Erro na API {request.method} {request.url.path}")
        return JSONResponse(status_code=500, content={"detail": "INTERNAL_SERVER_ERROR"})

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(summary.router, prefix="/api", tags=["summary"])
app.include_router(trades.router, prefix="/api", tags=["trades"])
app.include_router(fx_rate.router, prefix="/api", tags=["fx-rate"])
app.include_router(darf.router, prefix="/api", tags=["darf"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(license_routes.router, prefix="/api", tags=["license"])
app.include_router(diag.router, prefix="/api", tags=["diag"])


@app.middleware("http")
async def license_guard(request, call_next):
    path = request.url.path
    if path.startswith("/api") and not path.startswith("/api/license"):
        if not is_activated():
            return JSONResponse(status_code=403, content={"detail": "LICENSE_REQUIRED"})
    return await call_next(request)

static_dir = os.getenv("STATIC_DIR")
if static_dir:
    static_path = Path(static_dir)
    _log(f"STATIC_DIR={static_path}")
    index_file = static_path / "index.html"
    assets_dir = static_path / "assets"
    _log(f"INDEX_EXISTS={index_file.exists()} ASSETS_EXISTS={assets_dir.exists()}")

    # Serve SPA at root with index.html fallback
    app.mount("/", StaticFiles(directory=static_path, html=True), name="frontend")



@app.get("/health")
async def health_check():
    return {"status": "ok"}
