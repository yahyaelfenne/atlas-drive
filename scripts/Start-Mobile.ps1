param([switch]$Install, [switch]$Web)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$mobileRoot = Join-Path $projectRoot 'mobile'
$localRoot = Join-Path $projectRoot '.local'
& (Join-Path $PSScriptRoot 'Start-Local.ps1') -NoBrowser
if ($Install -or !(Test-Path -LiteralPath (Join-Path $mobileRoot 'node_modules'))) {
    Push-Location $mobileRoot
    try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Installation mobile echouee.' } } finally { Pop-Location }
}
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$proxyScript = Join-Path $mobileRoot 'scripts/dev-proxy.mjs'
try { $health = Invoke-RestMethod 'http://127.0.0.1:5182/mobile-health' -TimeoutSec 2 } catch { $health = $null }
if ($health -and $health.service -ne 'Location Ennour Mobile Proxy') { throw 'Port 5182 utilise par une autre application.' }
if (!$health) {
    if (Get-NetTCPConnection -LocalPort 5182 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 5182 deja utilise.' }
    $process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $proxyScript + '"') -WorkingDirectory $mobileRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'mobile-proxy.out.log') -RedirectStandardError (Join-Path $localRoot 'mobile-proxy.err.log') -PassThru
    [pscustomobject]@{id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $localRoot 'mobile-proxy.json') -Encoding UTF8
}
$network = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
$address = $network.IPv4Address.IPAddress | Select-Object -First 1
if (!$address) { $address = '127.0.0.1' }
if (!$env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL = 'http://' + $address + ':5182' }
Write-Host ('API mobile sur le reseau local : ' + $env:EXPO_PUBLIC_API_URL)
Write-Host 'Ouvrez Expo Go sur Android ou iPhone et scannez le QR code ci-dessous.'
Push-Location $mobileRoot
try {
    if ($Web) { & $nodePath 'node_modules/expo/bin/cli' start --web --port 8081 }
    else { & $nodePath 'node_modules/expo/bin/cli' start --port 8081 }
} finally { Pop-Location }
