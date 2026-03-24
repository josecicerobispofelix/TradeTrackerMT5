from sqlalchemy import Column, String, DateTime
from datetime import datetime, timezone
from .database import Base


class License(Base):
    __tablename__ = "licenses"

    key = Column(String(20), primary_key=True, index=True)
    # inactive → active → revoked
    status = Column(String(10), nullable=False, default="inactive")
    # SHA-256 fingerprint da máquina, definido na primeira ativação
    machine_id = Column(String(64), nullable=True)
    email = Column(String(200), nullable=True)
    # ID da transação no Hotmart/Kiwify (para suporte)
    transaction_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    activated_at = Column(DateTime, nullable=True)
    # None = vitalício
    expires_at = Column(DateTime, nullable=True)
    # Quantas máquinas diferentes podem ativar esta chave
    max_machines = Column(String(5), nullable=False, default="1")
