param([switch]$Install, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
$installRoot = Join-Path $projectRoot '.tools/n8n'
$entry = Join-Path $installRoot 'node_modules/n8n/bin/n8n'
New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
if ($Install -or !(Test-Path -LiteralPath $entry)) {
    & npm.cmd install --prefix $installRoot 'n8n@2.48.5' --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Installation n8n echouee.' }
    & npm.cmd --prefix $installRoot install-scripts approve sqlite3 isolated-vm msgpackr-extract protobufjs vue-demi
    if ($LASTEXITCODE -ne 0) { throw 'Preparation des dependances n8n echouee.' }
}
$env:N8N_USER_FOLDER = Join-Path $localRoot 'n8n'
$env:N8N_LISTEN_ADDRESS = '127.0.0.1'
$env:N8N_HOST = 'localhost'
$env:N8N_PORT = '5678'
$env:N8N_PROTOCOL = 'http'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_PERSONALIZATION_ENABLED = 'false'
$env:N8N_VERSION_NOTIFICATIONS_ENABLED = 'false'
$env:EXECUTIONS_DATA_SAVE_ON_SUCCESS = 'none'
$env:EXECUTIONS_DATA_SAVE_ON_ERROR = 'none'
$env:EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS = 'false'
$env:GENERIC_TIMEZONE = 'Africa/Casablanca'
$pidPath = Join-Path $localRoot 'n8n-process.json'
$listener = Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $owner = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess)
    if ($owner.CommandLine -notlike ('*' + $entry + '*')) { throw 'Port 5678 utilise par une autre application.' }
} else {
    $process = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList ('"' + $entry + '" start') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'n8n.out.log') -RedirectStandardError (Join-Path $localRoot 'n8n.err.log') -PassThru
    [pscustomobject]@{id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $pidPath -Encoding UTF8
}
Write-Host 'n8n : http://localhost:5678 (demarrage en cours si necessaire).'
if (!$NoBrowser) { Start-Process 'http://localhost:5678' }
