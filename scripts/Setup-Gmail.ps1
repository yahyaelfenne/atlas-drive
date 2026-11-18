param([string]$Email)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
if (!$Email) { $Email = Read-Host 'Adresse Gmail qui enverra les contrats' }
try { $parsed = New-Object System.Net.Mail.MailAddress($Email) } catch { throw 'Adresse e-mail invalide.' }
if ($parsed.Address -ne $Email -or $Email -match '[\r\n]') { throw 'Adresse e-mail invalide.' }
Write-Host 'Creez un mot de passe d application Google : https://myaccount.google.com/apppasswords'
Write-Host 'Utilisez le mot de passe d application de 16 caracteres, pas votre mot de passe Google habituel.'
$appPassword = Read-Host 'Mot de passe d application (saisie masquee)' -AsSecureString
if ($appPassword.Length -lt 16 -or $appPassword.Length -gt 19) { throw 'Le mot de passe d application doit contenir 16 caracteres (espaces eventuels).' }
$credential = New-Object System.Management.Automation.PSCredential($Email, $appPassword)
$credential | Export-Clixml -LiteralPath (Join-Path $localRoot 'gmail-credential.xml')
Write-Host 'Configuration enregistree et chiffree pour votre compte Windows. Activation de Gmail...'
& (Join-Path $PSScriptRoot 'Stop-Local.ps1')
& (Join-Path $PSScriptRoot 'Start-Local.ps1') -NoBrowser
Write-Host 'Gmail configure. Les contrats en attente de configuration seront repris automatiquement.'
