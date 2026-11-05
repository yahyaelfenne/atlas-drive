param([switch]$Install, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if ($Install) { & (Join-Path $PSScriptRoot 'Initialize-Local.ps1') } else { & (Join-Path $PSScriptRoot 'Initialize-Local.ps1') -SkipDependencies }
$localRoot = Join-Path $projectRoot '.local'
$settings = Get-Content -LiteralPath (Join-Path $localRoot 'settings.json') -Raw | ConvertFrom-Json
$venvPython = Join-Path $localRoot 'venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $venvPython) -or !(Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/node_modules'))) { throw 'Lancez scripts/Start-Local.ps1 -Install pour installer les dependances.' }
# Optional external-service secrets can be set in this ignored local script.
$integrationSettings = Join-Path $localRoot 'integrations.ps1'
if (Test-Path -LiteralPath $integrationSettings) { . $integrationSettings }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5180'
$env:ConnectionStrings__DefaultConnection = 'Host=127.0.0.1;Port=5433;Database=atlas_drive;Username=atlas;Password=' + $settings.DatabasePassword
$env:Jwt__Key = $settings.JwtKey
$env:Ai__BaseUrl = 'http://127.0.0.1:8101'
$env:Seed__AdminEmail = 'admin@atlasdrive.ma'
$env:Seed__AdminPassword = 'AtlasAdmin2026!'
$env:Seed__CustomerEmail = 'client@atlasdrive.ma'
$env:Seed__CustomerPassword = 'AtlasClient2026!'
if (!$env:OPENBLAS_NUM_THREADS) { $env:OPENBLAS_NUM_THREADS = '1' }
if (!$env:OMP_NUM_THREADS) { $env:OMP_NUM_THREADS = '1' }
if (!$env:MKL_NUM_THREADS) { $env:MKL_NUM_THREADS = '1' }
function Test-Endpoint([string]$url) {
    try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; return $response.StatusCode -eq 200 } catch { return $false }
}
foreach ($port in @(5180,5273,8101)) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        $owned = $false
        $ownerProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess) -ErrorAction SilentlyContinue
        if ($ownerProcess -and $ownerProcess.CommandLine -like ('*' + $projectRoot + '*')) { $owned = $true }
        $priorProcessFile = Join-Path $localRoot 'processes.json'
        if (!$owned -and (Test-Path -LiteralPath $priorProcessFile)) {
            $tracked = @(Get-Content -LiteralPath $priorProcessFile -Raw | ConvertFrom-Json | ForEach-Object { $_ })
            $matching = @($tracked | Where-Object { $_.id -eq $listener.OwningProcess })
            $running = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
            if ($running -and $matching.Count -gt 0 -and ([datetime]$matching[0].started).ToUniversalTime().Ticks -eq $running.StartTime.ToUniversalTime().Ticks) { $owned = $true }
        }
        if (!$owned) { throw "Port $port deja utilise par une autre application. Aucun processus n'a ete arrete." }
    }
}
$processFile = Join-Path $localRoot 'processes.json'
$processes = @()
if (Test-Path -LiteralPath $processFile) { $processes = @(Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json | ForEach-Object { $_ }) }
function Start-ServiceProcess([string]$name,[string]$file,[string]$arguments,[string]$directory) {
    $outLog = Join-Path $localRoot ($name + '.out.log')
    $errLog = Join-Path $localRoot ($name + '.err.log')
    $process = Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    return [pscustomobject]@{name=$name;id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')}
}
if (!(Test-Endpoint 'http://127.0.0.1:8101/health')) { $processes += Start-ServiceProcess 'ai' $venvPython '-m uvicorn main:app --host 127.0.0.1 --port 8101' (Join-Path $projectRoot 'ai') }
if (!(Test-Endpoint 'http://127.0.0.1:5180/api/health')) { $processes += Start-ServiceProcess 'api' (Get-Command dotnet.exe).Source 'run --no-launch-profile --project AtlasDrive.Api.csproj' (Join-Path $projectRoot 'backend') }
if (!(Test-Endpoint 'http://127.0.0.1:5273')) {
    $nodePath = (Get-Command node.exe).Source
    $viteEntry = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
    $processes += Start-ServiceProcess 'frontend' $nodePath ('"' + $viteEntry + '" --host 127.0.0.1 --port 5273 --strictPort') (Join-Path $projectRoot 'frontend')
}
$processes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $processFile -Encoding UTF8
$deadline = (Get-Date).AddSeconds(55)
do {
    $ready = (Test-Endpoint 'http://127.0.0.1:5180/api/health') -and (Test-Endpoint 'http://127.0.0.1:5273') -and (Test-Endpoint 'http://127.0.0.1:8101/health')
    if (!$ready) { Start-Sleep -Milliseconds 700 }
} while (!$ready -and (Get-Date) -lt $deadline)
if (!$ready) { throw "Un service ne repond pas. Logs : $localRoot" }
Write-Host 'Atlas Drive : http://127.0.0.1:5273'
Write-Host 'API Swagger : http://127.0.0.1:5180/swagger'
Write-Host 'AI API : http://127.0.0.1:8101/docs'
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:5273' }
