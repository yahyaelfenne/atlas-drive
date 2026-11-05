$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
if (Get-NetTCPConnection -LocalPort 5181 -State Listen -ErrorAction SilentlyContinue) { throw 'Le port 5181 est occupe. Arretez le service de test existant avant de continuer.' }
try { $aiHealth = Invoke-WebRequest 'http://127.0.0.1:8101/health' -UseBasicParsing -TimeoutSec 3 } catch { throw 'Demarrez Atlas Drive avant la verification (scripts/Start-Local.ps1).' }
& (Join-Path $PSScriptRoot 'Initialize-Local.ps1') -SkipDependencies
$settings = Get-Content -LiteralPath (Join-Path $localRoot 'settings.json') -Raw | ConvertFrom-Json
$pythonPath = Join-Path $localRoot 'venv/Scripts/python.exe'
Push-Location (Join-Path $projectRoot 'frontend')
try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build frontend echoue.' } } finally { Pop-Location }
& dotnet build (Join-Path $projectRoot 'backend/AtlasDrive.Api.csproj') --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Build backend echoue.' }
Push-Location (Join-Path $projectRoot 'ai')
try { & $pythonPath -m pytest -q; if ($LASTEXITCODE -ne 0) { throw 'Tests IA echoues.' } } finally { Pop-Location }
# Unique database; never modify the application's atlas_drive database.
$testDatabase = 'atlas_test_' + [guid]::NewGuid().ToString('N').Substring(0,12)
$savedEnvironment = @{}
$environmentKeys = @('PGPASSWORD','ATLAS_TEST_API','ASPNETCORE_ENVIRONMENT','ASPNETCORE_URLS','ConnectionStrings__DefaultConnection','Jwt__Key','Ai__BaseUrl','Seed__AdminEmail','Seed__AdminPassword','Seed__CustomerEmail','Seed__CustomerPassword')
foreach ($key in $environmentKeys) { $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key,'Process') }
$env:PGPASSWORD = $settings.DatabasePassword
$pgBin = $settings.PostgreSqlBin
& (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p 5433 -U atlas $testDatabase
if ($LASTEXITCODE -ne 0) { throw 'Creation base de test echouee.' }
$testApi = $null
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = 'http://127.0.0.1:5181'
    $env:ConnectionStrings__DefaultConnection = 'Host=127.0.0.1;Port=5433;Database=' + $testDatabase + ';Username=atlas;Password=' + $settings.DatabasePassword
    $env:Jwt__Key = $settings.JwtKey
    $env:Ai__BaseUrl = 'http://127.0.0.1:8101'
    $env:Seed__AdminEmail = 'admin@atlasdrive.ma'
    $env:Seed__AdminPassword = 'AtlasAdmin2026!'
    $env:Seed__CustomerEmail = 'client@atlasdrive.ma'
    $env:Seed__CustomerPassword = 'AtlasClient2026!'
    $testApi = Start-Process -FilePath (Get-Command dotnet.exe).Source -ArgumentList 'bin/Debug/net10.0/AtlasDrive.Api.dll' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'test-api.out.log') -RedirectStandardError (Join-Path $localRoot 'test-api.err.log') -PassThru
    $deadline = (Get-Date).AddSeconds(45)
    $ready = $false
    do {
        try { $ready = (Invoke-WebRequest 'http://127.0.0.1:5181/api/health' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { Start-Sleep -Milliseconds 500 }
    } while (!$ready -and (Get-Date) -lt $deadline)
    if (!$ready) { throw 'API de test indisponible. Consultez .local/test-api.err.log' }
    $env:ATLAS_TEST_API = 'http://127.0.0.1:5181'
    & $pythonPath (Join-Path $PSScriptRoot 'test-integration.py')
    if ($LASTEXITCODE -ne 0) { throw 'Tests integration echoues.' }
} finally {
    if ($testApi -and !$testApi.HasExited) { Stop-Process -Id $testApi.Id -Force; $testApi.WaitForExit() }
    & (Join-Path $pgBin 'dropdb.exe') -h 127.0.0.1 -p 5433 -U atlas --force $testDatabase
    foreach ($key in $environmentKeys) { [Environment]::SetEnvironmentVariable($key,$savedEnvironment[$key],'Process') }
}
Write-Host 'Builds, tests IA et tests integration valides.'
