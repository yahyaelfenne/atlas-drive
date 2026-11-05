param([switch]$SkipDependencies)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
$settingsPath = Join-Path $localRoot 'settings.json'
if (!(Test-Path -LiteralPath $settingsPath)) {
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 48
    $random.GetBytes($bytes)
    $jwtKey = [Convert]::ToBase64String($bytes)
    $random.GetBytes($bytes)
    $dbPassword = [Convert]::ToBase64String($bytes).Replace('/','a').Replace('+','b').TrimEnd('=')
    $random.Dispose()
    [ordered]@{ DatabasePassword=$dbPassword; JwtKey=$jwtKey; PostgreSqlBin=''; Python='' } | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
}
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
if (!$settings.PostgreSqlBin -or !(Test-Path -LiteralPath (Join-Path $settings.PostgreSqlBin 'initdb.exe'))) {
    $pgCommand = Get-Command initdb.exe -ErrorAction SilentlyContinue
    if ($pgCommand) { $pgBin = Split-Path $pgCommand.Source -Parent }
    else {
        $pgInstall = Get-ChildItem -LiteralPath 'C:/Program Files/PostgreSQL' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if (!$pgInstall) { throw 'PostgreSQL introuvable. Installez PostgreSQL 18, puis relancez ce script.' }
        $pgBin = Join-Path $pgInstall.FullName 'bin'
    }
    $settings.PostgreSqlBin = $pgBin
    $settings | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
}
$pgBin = $settings.PostgreSqlBin
$pgData = Join-Path $localRoot 'postgres-data'
if (!(Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))) {
    $passwordFile = Join-Path $localRoot 'init-password.tmp'
    [IO.File]::WriteAllText($passwordFile, $settings.DatabasePassword, [Text.UTF8Encoding]::new($false))
    try {
        & (Join-Path $pgBin 'initdb.exe') -D $pgData -U atlas --encoding=UTF8 --locale=C --auth=scram-sha-256 --pwfile=$passwordFile
        if ($LASTEXITCODE -ne 0) { throw 'Initialisation PostgreSQL impossible.' }
    } finally { Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue }
}
& (Join-Path $pgBin 'pg_ctl.exe') status -D $pgData *> $null
if ($LASTEXITCODE -ne 0) {
    $pgLog = Join-Path $localRoot 'postgres.log'
    $pgArguments = '-D "' + $pgData + '" -l "' + $pgLog + '" -o "-p 5433 -h 127.0.0.1" -w start'
    $pgProcess = Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -ArgumentList $pgArguments -WindowStyle Hidden -PassThru
    $pgProcess.WaitForExit()
    if ($pgProcess.ExitCode -ne 0) { throw "PostgreSQL ne demarre pas. Consultez $pgLog" }
}
$priorPassword = $env:PGPASSWORD
$env:PGPASSWORD = $settings.DatabasePassword
try {
    $dbExists = & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p 5433 -U atlas -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='atlas_drive'"
    if ($LASTEXITCODE -ne 0) { throw 'Connexion PostgreSQL impossible.' }
    if ($dbExists -ne '1') {
        & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p 5433 -U atlas -E UTF8 atlas_drive
        if ($LASTEXITCODE -ne 0) { throw 'Creation de la base impossible.' }
    }
} finally { $env:PGPASSWORD = $priorPassword }
if (!$SkipDependencies) {
    if (!$settings.Python -or !(Test-Path -LiteralPath $settings.Python)) {
        $python313 = Join-Path $env:LOCALAPPDATA 'Programs/Python/Python313/python.exe'
        if (Test-Path -LiteralPath $python313) { $settings.Python = $python313 }
        else { $settings.Python = (Get-Command python.exe -ErrorAction Stop).Source }
        $settings | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
    }
    $venvPython = Join-Path $localRoot 'venv/Scripts/python.exe'
    if (!(Test-Path -LiteralPath $venvPython)) { & $settings.Python -m venv (Join-Path $localRoot 'venv'); if ($LASTEXITCODE -ne 0) { throw 'Creation venv impossible.' } }
    & $venvPython -m pip install -r (Join-Path $projectRoot 'ai/requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Installation Python impossible.' }
    Push-Location (Join-Path $projectRoot 'frontend')
    try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Installation frontend impossible.' } } finally { Pop-Location }
    & dotnet restore (Join-Path $projectRoot 'backend/AtlasDrive.Api.csproj')
    if ($LASTEXITCODE -ne 0) { throw 'Restauration .NET impossible.' }
}
Write-Host 'PostgreSQL pret : 127.0.0.1:5433 / atlas_drive'
