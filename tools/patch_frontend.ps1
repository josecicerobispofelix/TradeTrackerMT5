Param(
    [string]$AppDataPath = "$env:LOCALAPPDATA\TradeTrackerMT5\_internal\frontend\dist",
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

# Sync files (mirror) to keep hashes identical; robocopy returns 1 on copy success, so treat 0 or 1 as success.
robocopy $SourcePath $AppDataPath /MIR /NFL /NDL /NJH /NJS /NP
$code = $LASTEXITCODE
if ($code -le 1) {
    Write-Host "Frontend patched successfully."
    exit 0
} else {
    Write-Error "Robocopy failed with code $code"
    exit $code
}
