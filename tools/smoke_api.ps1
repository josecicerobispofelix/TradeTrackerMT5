Param(
    [string]$BaseUrl = "http://127.0.0.1:18100"
)

Write-Host "Smoke test - API health ($BaseUrl/health)"

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5
    Write-Host "Health OK:" ($response | ConvertTo-Json -Compress)
    exit 0
} catch {
    Write-Error "Falha no health check. Certifique-se que o TradeTrackerMT5 está aberto. Erro: $($_.Exception.Message)"
    exit 1
}
