$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist\\TradeTrackerMT5"

if (-Not (Test-Path $dist)) {
    Write-Host "Build nao encontrado. Executando build_desktop.ps1..." -ForegroundColor Yellow
    & (Join-Path $root "build_desktop.ps1")
}

if (-Not (Test-Path $dist)) {
    Write-Host "Falha ao gerar build." -ForegroundColor Red
    exit 1
}

$target = Join-Path $env:LOCALAPPDATA "TradeTrackerMT5"
if (Test-Path $target) {
    Remove-Item -Recurse -Force $target
}
Copy-Item -Recurse $dist $target

$envSource = Join-Path $root "TradeTrackerMT5.env"
if (Test-Path $envSource) {
    Copy-Item $envSource (Join-Path $target "TradeTrackerMT5.env") -Force
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "TradeTrackerMT5.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $target "TradeTrackerMT5.exe"
$shortcut.WorkingDirectory = $target
$shortcut.Save()

Write-Host "App instalado em $target" -ForegroundColor Green
Write-Host "Atalho criado na area de trabalho." -ForegroundColor Green
