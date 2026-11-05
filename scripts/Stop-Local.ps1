$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
$processFile = Join-Path $localRoot 'processes.json'
if (Test-Path -LiteralPath $processFile) {
    $processes = @(Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json | ForEach-Object { $_ })
    foreach ($entry in $processes) {
        $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.started).ToUniversalTime().Ticks) {
            & taskkill.exe /PID $entry.id /T /F | Out-Null
        }
    }
    Remove-Item -LiteralPath $processFile -Force
}
$settingsPath = Join-Path $localRoot 'settings.json'
if (Test-Path -LiteralPath $settingsPath) {
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    & (Join-Path $settings.PostgreSqlBin 'pg_ctl.exe') -D (Join-Path $localRoot 'postgres-data') -m fast -w stop
}
Write-Host 'Services Atlas Drive arretes. Les donnees sont conservees.'
