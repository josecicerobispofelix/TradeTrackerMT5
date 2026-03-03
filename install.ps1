$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

$envFile = Join-Path $root "TradeTrackerMT5.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or ($line -notmatch "=")) { return }
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($key) { Set-Item -Path Env:$key -Value $value }
    }
}

Write-Host "Instalando backend (Python)..." -ForegroundColor Cyan

$pythonCmd = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py -3"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} else {
    Write-Host "Python nao encontrado. Instale Python 3.11+ e tente novamente." -ForegroundColor Red
    exit 1
}

$venvPath = Join-Path $backend ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"

if (-Not (Test-Path $venvPython)) {
    & $pythonCmd -m venv $venvPath
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $backend "requirements.txt")

Push-Location $backend
if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "sqlite+aiosqlite:///./data/tradetracker.db"
}
& $venvPython -m alembic upgrade head
Pop-Location

Write-Host "Instalando frontend (Node)..." -ForegroundColor Cyan
if (-Not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js nao encontrado. Instale Node 20+ e tente novamente." -ForegroundColor Red
    exit 1
}

Push-Location $frontend
npm install
Pop-Location

Write-Host "Instalacao concluida." -ForegroundColor Green
