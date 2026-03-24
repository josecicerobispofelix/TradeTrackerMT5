from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routes import licenses, admin

# Cria tabelas na primeira execução
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TradeTracker License Server",
    version="1.0.0",
    docs_url="/docs",   # swagger UI — proteja em produção se quiser
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(licenses.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
