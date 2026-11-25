param([switch]$Install, [switch]$Web, [string]$LanAddress)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$mobileRoot = Join-Path $projectRoot 'mobile'
if (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Expo ne peut pas utiliser le port 8081. Arretez le serveur qui utilise ce port avant de relancer.'
}
& (Join-Path $PSScriptRoot 'Start-Local.ps1') -NoBrowser
if ($Install -or !(Test-Path -LiteralPath (Join-Path $mobileRoot 'node_modules'))) {
    Push-Location $mobileRoot
    try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Installation mobile echouee.' } } finally { Pop-Location }
}
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$health = Invoke-RestMethod 'http://127.0.0.1:5180/api/health' -TimeoutSec 5
if ($health.database -ne 'connected') { throw 'La base de donnees Location Ennour est indisponible.' }
if (!$LanAddress) {
    $route = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
        Sort-Object { $_.RouteMetric + $_.InterfaceMetric } | Select-Object -First 1
    if ($route) {
        $LanAddress = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 |
            Where-Object { $_.AddressState -eq 'Preferred' -and !$_.SkipAsSource } |
            Select-Object -ExpandProperty IPAddress -First 1
    }
}
if (!$LanAddress -or !(Get-NetIPAddress -AddressFamily IPv4 -IPAddress $LanAddress -ErrorAction SilentlyContinue) -or $LanAddress -like '127.*' -or $LanAddress -like '169.254.*') {
    throw 'Aucune adresse LAN utilisable. Connectez le PC au Wi-Fi ou passez son adresse IPv4 locale avec -LanAddress.'
}
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $LanAddress
Write-Host ('Expo Go sur le meme Wi-Fi : exp://' + $LanAddress + ':8081')
Write-Host ('Test depuis le navigateur du telephone : http://' + $LanAddress + ':8081/api/health')
Push-Location $mobileRoot
try {
    $expoArgs = @('node_modules/expo/bin/cli', 'start', '--go', '--lan', '--port', '8081')
    if ($Web) { $expoArgs += '--web' }
    & $nodePath @expoArgs
    if ($LASTEXITCODE -ne 0) { throw 'Expo a quitte avec une erreur.' }
} finally { Pop-Location }
