Param(
    [string]$AppDataPath = "$env:LOCALAPPDATA\TradersTrackerMT5\_internal\frontend\dist",
    [string]$SourcePath  = "$PSScriptRoot\..\frontend\dist"
)

Write-Host "Patch frontend dist"
Write-Host "Source     : $SourcePath"
Write-Host "Destination: $AppDataPath"

if (-not (Test-Path $SourcePath)) {
    Write-Error "Source dist folder not found. Build the frontend first (npm run build)."
    exit 1
}

if (-not (Test-Path $AppDataPath)) {
    Write-Host "Destination does not exist, creating..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $AppDataPath | Out-Null
}

# Sync files (mirror) to keep hashes identical.
# Robocopy exit codes: 0=nothing, 1=copy ok, 2=extra files, 3=copy+extra. Treat <8 as sucesso.
robocopy $SourcePath $AppDataPath /MIR /NFL /NDL /NJH /NJS /NP
$code = $LASTEXITCODE
if ($code -lt 8) {
    if ($code -ge 2) {
        Write-Warning "Robocopy retornou código $code (arquivos extras ou em uso). Se algo não atualizar, feche o app/EBWebView e rode de novo."
    }
    Write-Host "Frontend patched successfully."
    exit 0
}

Write-Error "Robocopy failed with code $code. Feche o TradersTrackerMT5 (e processos WebView2) e tente novamente."
exit $code
