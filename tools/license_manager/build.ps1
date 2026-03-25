$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
$ico    = Join-Path $root "assets\app.generated.ico"
$script = Join-Path $root "tools\license_manager\app.py"
$out    = Join-Path $root "dist-admin"

Write-Host "Instalando dependencias..." -ForegroundColor Cyan
& $python -m pip install httpx --quiet

Write-Host "Compilando LicenseManager..." -ForegroundColor Cyan
& $python -m PyInstaller `
    --name "LicenseManager" `
    --noconsole `
    --onefile `
    --noconfirm `
    --icon $ico `
    --distpath $out `
    $script

Write-Host "Pronto: $out\LicenseManager.exe" -ForegroundColor Green
