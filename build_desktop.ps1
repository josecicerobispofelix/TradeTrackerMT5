$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvPython = Join-Path $backend ".venv\\Scripts\\python.exe"

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
& $venvPython -m PyInstaller `
  --name TradeTrackerMT5 `
  --noconsole `
  --onedir `
  --clean `
  --add-data "$frontend\\dist;frontend\\dist" `
  --add-data "$backend\\alembic.ini;backend" `
  --add-data "$backend\\alembic;backend\\alembic" `
  "$backend\\app\\desktop.py"
Pop-Location

Write-Host "Build concluido em dist\\TradeTrackerMT5" -ForegroundColor Green
