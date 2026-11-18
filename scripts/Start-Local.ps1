param([switch]$Install, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if ($Install) { & (Join-Path $PSScriptRoot 'Initialize-Local.ps1') } else { & (Join-Path $PSScriptRoot 'Initialize-Local.ps1') -SkipDependencies }
$localRoot = Join-Path $projectRoot '.local'
$wslRuntimePath = Join-Path $localRoot 'api-runtime.json'
$wslRuntime = if (Test-Path -LiteralPath $wslRuntimePath) { Get-Content -LiteralPath $wslRuntimePath -Raw | ConvertFrom-Json } else { $null }
if ($wslRuntime -and $wslRuntime.mode -eq 'wsl') {
    if ($wslRuntime.distribution -notmatch '^[A-Za-z0-9.-]+$') { throw 'Distribution WSL invalide.' }
    $linuxRoot = (& wsl.exe -d $wslRuntime.distribution --exec wslpath -a $projectRoot).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Ubuntu ne peut pas demarrer.' }
    $linuxRuntime = (& wsl.exe -d $wslRuntime.distribution -u ennour --exec python3 "$linuxRoot/scripts/run-wsl-api.py" --runtime-dir).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Dossier de travail Linux indisponible.' }
}
$settings = Get-Content -LiteralPath (Join-Path $localRoot 'settings.json') -Raw | ConvertFrom-Json
$venvPython = Join-Path $localRoot 'venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $venvPython) -or !(Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/node_modules'))) { throw 'Lancez scripts/Start-Local.ps1 -Install pour installer les dependances.' }
# Optional external-service secrets can be set in this ignored local script.
$integrationSettings = Join-Path $localRoot 'integrations.ps1'
if (Test-Path -LiteralPath $integrationSettings) { . $integrationSettings }
$gmailCredentialPath = Join-Path $localRoot 'gmail-credential.xml'
if (Test-Path -LiteralPath $gmailCredentialPath) {
    $gmailCredential = Import-Clixml -LiteralPath $gmailCredentialPath
    $env:Smtp__Host = 'smtp.gmail.com'
    $env:Smtp__Port = '587'
    $env:Smtp__EnableSsl = 'true'
    $env:Smtp__Username = $gmailCredential.UserName
    $env:Smtp__Password = $gmailCredential.GetNetworkCredential().Password.Replace(' ', '')
    $env:Smtp__From = $gmailCredential.UserName
}

$whatsAppConfigPath = Join-Path $localRoot 'whatsapp-runtime.json'
if (Test-Path -LiteralPath $whatsAppConfigPath) {
    $wa = Get-Content -LiteralPath $whatsAppConfigPath -Raw | ConvertFrom-Json
    $env:WhatsApp__DeliveryMode = if ($wa.DeliveryMode) { $wa.DeliveryMode } else { "manual" }
    $env:WhatsApp__WebhookUrl = $wa.WebhookUrl
    $env:WhatsApp__PublicBaseUrl = $wa.PublicBaseUrl
    $keyPath = Join-Path $localRoot 'n8n-webhook-key.txt'
    if (Test-Path -LiteralPath $keyPath) { $env:WhatsApp__WebhookKey = (Get-Content -LiteralPath $keyPath -Raw).Trim() }
}
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
        if ($port -eq 5180 -and $wslRuntime -and $wslRuntime.mode -eq 'wsl') {
            & wsl.exe -d $wslRuntime.distribution -u ennour --exec python3 "$linuxRoot/scripts/run-wsl-api.py" --status
            if ($LASTEXITCODE -eq 0) { $owned = $true }
        }
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
function Test-TrackedProcess([string]$name) {
    foreach ($entry in $processes) {
        if ($entry.name -ne $name) { continue }
        $running = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($running -and $running.StartTime -and $entry.started -and $running.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.started).ToUniversalTime().Ticks) { return $true }
    }
    return $false
}
function Start-ServiceProcess([string]$name,[string]$file,[string]$arguments,[string]$directory) {
    $outLog = Join-Path $localRoot ($name + '.out.log')
    $errLog = Join-Path $localRoot ($name + '.err.log')
    $process = Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    return [pscustomobject]@{name=$name;id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')}
}
$chatRuntimePath = Join-Path $localRoot 'chat-runtime.json'
if (Test-Path -LiteralPath $chatRuntimePath) {
    $chatRuntime = Get-Content -LiteralPath $chatRuntimePath -Raw | ConvertFrom-Json
    $env:OLLAMA_MODEL = $chatRuntime.model
    $env:OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
    if (!(Test-Endpoint 'http://127.0.0.1:11434/api/tags')) {
        $ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs/Ollama/ollama.exe'
        if (!(Test-Path -LiteralPath $ollamaExe)) { throw 'Ollama manquant. Installez Ollama pour le chatbot local.' }
        $env:OLLAMA_HOST = '127.0.0.1:11434'
        $processes += Start-ServiceProcess 'ollama' $ollamaExe 'serve' $projectRoot
    }
}
if (!(Test-Endpoint 'http://127.0.0.1:8101/health') -and !(Test-TrackedProcess 'ai')) { $processes += Start-ServiceProcess 'ai' $venvPython '-m uvicorn main:app --host 127.0.0.1 --port 8101' (Join-Path $projectRoot 'ai') }
if (!(Test-Endpoint 'http://127.0.0.1:5180/api/health') -and !(Test-TrackedProcess 'api')) {
  if ($wslRuntime -and $wslRuntime.mode -eq 'wsl') {
    & wsl.exe -d $wslRuntime.distribution -u ennour --exec dotnet publish "$linuxRoot/backend/AtlasDrive.Api.csproj" -c Release --artifacts-path "$linuxRuntime/build" -o "$linuxRuntime/api" --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Compilation API Linux echouee.' }
    $forwardNames = @(Get-ChildItem Env: | Where-Object { $_.Name -match '^(Cloudinary__|Smtp__|WhatsApp__)' } | ForEach-Object Name)
    $priorWslEnv = $env:WSLENV
    try {
        $env:WSLENV = (@($priorWslEnv) + $forwardNames | Where-Object { $_ }) -join ':'
        $processes += Start-ServiceProcess 'api' (Get-Command wsl.exe).Source ('-d ' + $wslRuntime.distribution + ' -u ennour --exec python3 "' + $linuxRoot + '/scripts/run-wsl-api.py"') $projectRoot
    } finally { $env:WSLENV = $priorWslEnv }
  } else {
    & dotnet build (Join-Path $projectRoot 'backend/AtlasDrive.Api.csproj') --no-restore
    if ($LASTEXITCODE -ne 0) { throw 'Compilation API echouee.' }
    # Use the installed .NET host, consistently with Verify.ps1.
    $processes += Start-ServiceProcess 'api' (Get-Command dotnet.exe).Source 'bin/Debug/net10.0/AtlasDrive.Api.dll' (Join-Path $projectRoot 'backend')
  }
}
if (!(Test-Endpoint 'http://127.0.0.1:5273') -and !(Test-TrackedProcess 'frontend')) {
    $nodePath = (Get-Command node.exe).Source
    $viteEntry = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
    $processes += Start-ServiceProcess 'frontend' $nodePath ('"' + $viteEntry + '" --host 127.0.0.1 --port 5273 --strictPort') (Join-Path $projectRoot 'frontend')
}
foreach ($service in @(@{port=8101;name='ai'}, @{port=5273;name='frontend'})) {
    if (!(Test-TrackedProcess $service.name)) {
        $listener = Get-NetTCPConnection -LocalPort $service.port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            $owner = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess) -ErrorAction SilentlyContinue
            $running = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
            if ($owner -and $running -and $owner.CommandLine -like ('*' + $projectRoot + '*')) {
                $processes += [pscustomobject]@{name=$service.name;id=$running.Id;started=$running.StartTime.ToUniversalTime().ToString('o')}
            }
        }
    }
}
$processes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $processFile -Encoding UTF8
$deadline = (Get-Date).AddSeconds(55)
do {
    $ready = (Test-Endpoint 'http://127.0.0.1:5180/api/health') -and (Test-Endpoint 'http://127.0.0.1:5273')
    if (!$ready) { Start-Sleep -Milliseconds 700 }
} while (!$ready -and (Get-Date) -lt $deadline)
if (!$ready) { throw "Un service ne repond pas. Logs : $localRoot" }
Write-Host 'Location Ennour : http://127.0.0.1:5273'
Write-Host 'API Swagger : http://127.0.0.1:5180/swagger'
if (Test-Endpoint 'http://127.0.0.1:8101/health') { Write-Host 'AI API : http://127.0.0.1:8101/docs' }
else { Write-Host 'AI en demarrage. Les reponses locales de secours restent disponibles dans API.' }
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:5273' }
