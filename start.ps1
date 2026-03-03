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

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "sqlite+aiosqlite:///./data/tradetracker.db"
}
if (-not $env:CORS_ORIGINS) {
    $env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
}

$backendCmd = @"
..\backend\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"@

$frontendCmd = @"
npm run dev
"@

Start-Process powershell -WorkingDirectory $backend -ArgumentList "-NoExit","-Command",$backendCmd
Start-Process powershell -WorkingDirectory $frontend -ArgumentList "-NoExit","-Command",$frontendCmd

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
