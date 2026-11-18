$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
$wslRuntimePath = Join-Path $localRoot 'api-runtime.json'
if (Test-Path -LiteralPath $wslRuntimePath) {
    $runtime = Get-Content -LiteralPath $wslRuntimePath -Raw | ConvertFrom-Json
    if ($runtime.mode -eq 'wsl' -and $runtime.distribution -match '^[A-Za-z0-9.-]+$') {
        $linuxRoot = (& wsl.exe -d $runtime.distribution --exec wslpath -a $projectRoot).Trim()
        & wsl.exe -d $runtime.distribution -u ennour --exec python3 "$linuxRoot/scripts/run-wsl-api.py" --stop
    }
}
$processFile = Join-Path $localRoot 'processes.json'
if (Test-Path -LiteralPath $processFile) {
    $processes = @(Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json | ForEach-Object { $_ })
    foreach ($entry in $processes) {
        $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime -and $entry.started -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.started).ToUniversalTime().Ticks) {
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
Write-Host 'Services Location Ennour arretes. Les donnees sont conservees.'
