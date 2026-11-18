$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pidPath = Join-Path $projectRoot '.local/n8n-process.json'
if (Test-Path -LiteralPath $pidPath) {
    $entry = Get-Content -LiteralPath $pidPath -Raw | ConvertFrom-Json
    $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.started).ToUniversalTime().Ticks) {
        & taskkill.exe /PID $entry.id /T /F | Out-Null
    }
    Remove-Item -LiteralPath $pidPath
}
Write-Host 'n8n arrete. Workflows et identifiants conserves.'
