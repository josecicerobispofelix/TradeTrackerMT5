import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .routes import fx_rate, summary, trades, upload

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

app = FastAPI(title="TradeTrackerMT5 API", version="1.0.0")

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost",
)
origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(summary.router, prefix="/api", tags=["summary"])
app.include_router(trades.router, prefix="/api", tags=["trades"])
app.include_router(fx_rate.router, prefix="/api", tags=["fx-rate"])

static_dir = os.getenv("STATIC_DIR")
if static_dir:
    static_path = Path(static_dir)
    index_file = static_path / "index.html"

    @app.get("/")
    async def serve_index():
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Frontend nao encontrado"}

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Frontend nao encontrado"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
