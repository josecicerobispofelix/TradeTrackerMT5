$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$iss = Join-Path $root "TradersTrackerMT5.iss"

$inno = Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\\ISCC.exe"
if (-Not (Test-Path $inno)) {
    $inno = Join-Path $env:ProgramFiles "Inno Setup 6\\ISCC.exe"
}
if (-Not (Test-Path $inno)) {
    $inno = Join-Path $env:LOCALAPPDATA "Programs\\Inno Setup 6\\ISCC.exe"
}
if (-Not (Test-Path $inno)) {
    $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $inno = $cmd.Path
    }
}

if (-Not (Test-Path $inno)) {
    Write-Host "Inno Setup nao encontrado. Instale e tente novamente." -ForegroundColor Red
    exit 1
}

& $inno $iss
Write-Host "Installer gerado em dist-installer\\TradersTrackerMT5-Setup.exe" -ForegroundColor Green
