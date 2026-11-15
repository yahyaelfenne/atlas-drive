$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$metadataPath = Join-Path $projectRoot '.local/mobile-proxy.json'
if (Test-Path -LiteralPath $metadataPath) {
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    $process = Get-Process -Id $metadata.id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$metadata.started).ToUniversalTime().Ticks) { Stop-Process -Id $process.Id -Force }
    Remove-Item -LiteralPath $metadataPath -Force
}
Write-Host 'Proxy mobile arrete. Dans le terminal Expo, utilisez Ctrl+C pour arreter Metro.'
