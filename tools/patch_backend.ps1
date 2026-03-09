Param(
    [string]$AppDataPath = "$env:LOCALAPPDATA\TradeTrackerMT5",
    [string]$SourcePath  = "$PSScriptRoot\..\dist\TradeTrackerMT5"
)

Write-Host "Patch backend/binary"
Write-Host "Source     : $SourcePath"
Write-Host "Destination: $AppDataPath"

if (-not (Test-Path $SourcePath)) {
    Write-Error "Source dist\TradeTrackerMT5 not found. Build desktop first (build_desktop.ps1)."
    exit 1
}

if (-not (Test-Path $AppDataPath)) {
    Write-Host "Destination does not exist, creating..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $AppDataPath | Out-Null
}

# Copy everything (includes TradeTrackerMT5.exe and _internal)
robocopy $SourcePath $AppDataPath /MIR /NFL /NDL /NJH /NJS /NP
$code = $LASTEXITCODE
# Robocopy: <8 é sucesso (0 nada, 1 copiou, 2 extra, 3 copiou+extra).
if ($code -lt 8) {
    if ($code -ge 2) {
        Write-Warning "Robocopy retornou código $code (arquivos extras ou em uso). Se algo não atualizar, feche o app/EBWebView e rode de novo."
    }
    Write-Host "Backend/binary patched successfully."
    exit 0
}

Write-Error "Robocopy failed with code $code. Feche o TradeTrackerMT5 (e processos WebView2) e tente novamente."
exit $code
