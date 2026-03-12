$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvPython = Join-Path $backend ".venv\Scripts\python.exe"
$icon = Join-Path $root "assets\app.generated.ico"
$iconArgs = @()
if (Test-Path $icon) {
    $iconArgs = @("--icon", $icon)
}

if (-Not (Test-Path $venvPython)) {
    Write-Host "Ambiente Python nao encontrado. Execute install.ps1 primeiro." -ForegroundColor Red
    exit 1
}

Write-Host "Build do frontend..." -ForegroundColor Cyan
Push-Location $frontend
npm install
npm run build
Pop-Location

Write-Host "Build do app desktop..." -ForegroundColor Cyan
Push-Location $root
& $venvPython -m pip install -r (Join-Path $backend "requirements.txt")
& $venvPython -m pip install pillow
& $venvPython -m pip install reportlab
& $venvPython (Join-Path $root "tools\ensure_icon.py")

$pyiArgs = @(
    "--name", "TradersTrackerMT5",
    "--noconsole",
    "--onedir",
    "--noconfirm",
    "--clean",
    "--collect-all", "fastapi",
    "--collect-all", "starlette",
    "--collect-all", "pydantic",
    "--collect-all", "sqlalchemy",
    "--collect-all", "httpx",
    "--collect-all", "uvicorn",
    "--collect-all", "websockets",
    "--collect-all", "openpyxl",
    "--collect-all", "reportlab",
    "--collect-submodules", "fastapi",
    "--collect-submodules", "starlette",
    "--hidden-import", "fastapi.middleware",
    "--hidden-import", "fastapi.middleware.cors",
    "--hidden-import", "fastapi.routing",
    "--hidden-import", "fastapi.params",
    "--hidden-import", "fastapi.applications",
    "--hidden-import", "aiosqlite",
    "--hidden-import", "openpyxl",
    "--exclude-module", "tkinter",
    "--exclude-module", "_tkinter",
    "--exclude-module", "PyQt5",
    "--exclude-module", "PyQt6",
    "--exclude-module", "PySide2",
    "--exclude-module", "PySide6",
    "--exclude-module", "asyncpg",
    "--exclude-module", "aiomysql",
    "--exclude-module", "pymysql",
    "--exclude-module", "MySQLdb",
    "--add-data", "$frontend\dist;frontend\dist",
    "--add-data", "$backend\alembic.ini;backend",
    "--add-data", "$backend\alembic;backend\alembic",
    "--add-data", "$backend\app;backend\app"
)

& $venvPython -m PyInstaller @pyiArgs @iconArgs "$backend\app\desktop.py"
Pop-Location

Write-Host "Build concluido em dist\TradersTrackerMT5" -ForegroundColor Green
