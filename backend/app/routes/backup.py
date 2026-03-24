import datetime as dt
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..auth import get_current_user
from ..models import User

router = APIRouter()


@router.get("/backup/db")
async def download_backup(user: User = Depends(get_current_user)):
    db_url = os.getenv("DATABASE_URL", "")
    if "sqlite" not in db_url:
        raise HTTPException(status_code=400, detail="Backup disponível apenas para SQLite.")

    path_part = db_url.split("///")[-1]
    db_path = Path(path_part)
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path

    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Banco de dados não encontrado.")

    filename = f"backup_{dt.date.today().isoformat()}.db"
    return FileResponse(
        str(db_path),
        filename=filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
