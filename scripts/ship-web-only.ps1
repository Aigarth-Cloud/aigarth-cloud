# ship-web-only.ps1
# One-shot ship of dist\aigarth-web-latest.tar to the VPS, then
# docker load + compose up --no-deps web so the only thing that
# changes is the aigarth/web image. The 12 services keep running.
#
# Note: this is a custom, smaller variant of ship-to-vps.ps1 for the
# web-only deploy. The full script is Caddy-oriented; this VPS uses
# Traefik (see infrastructure/docker-compose.production.yml) and
# has no Caddy installed, so we skip the Caddy steps entirely.

$ErrorActionPreference = 'Stop'

$VpsHost = "187.124.35.93"
$VpsPort = 22
$VpsUser = "root"
$Key = Join-Path $env:USERPROFILE ".ssh\aigarth-deploy"
$Tarball = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "..\dist\aigarth-web-latest.tar"
$RepoRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "..") | Select-Object -ExpandProperty Path
$ComposeSource = Join-Path $RepoRoot "infrastructure\docker-compose.production.yml"
$Tarball = Resolve-Path $Tarball | Select-Object -ExpandProperty Path
$TarballName = Split-Path -Leaf $Tarball

$Ssh = (Get-Command ssh.exe -ErrorAction SilentlyContinue).Source
if (-not $Ssh) { $Ssh = "$env:SystemRoot\System32\OpenSSH\ssh.exe" }
$Scp = (Get-Command scp.exe -ErrorAction SilentlyContinue).Source
if (-not $Scp) { $Scp = "$env:SystemRoot\System32\OpenSSH\scp.exe" }

$sshBase = @("-i", $Key, "-p", "$VpsPort", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new")
$scpBase = @("-i", $Key, "-P", "$VpsPort", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new")

function Invoke-Ssh([string]$Cmd) {
    $args = $sshBase + @("${VpsUser}@${VpsHost}", $Cmd)
    $output = & $Ssh @args 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SSH failed (exit $LASTEXITCODE): $Cmd`n$($output -join "`n")" }
    return $output
}

function Invoke-Scp([string]$Local, [string]$Remote) {
    $args = $scpBase + @($Local, "${VpsUser}@${VpsHost}:$Remote")
    & $Scp @args
    if ($LASTEXITCODE -ne 0) { throw "SCP failed (exit $LASTEXITCODE): $Local -> $Remote" }
}

Write-Host "==> Pre-flight: SSH" -ForegroundColor Cyan
$whoami = Invoke-Ssh "whoami"
Write-Host "    Logged in as: $($whoami -join '')" -ForegroundColor Green

Write-Host ""
Write-Host "==> Uploading $TarballName" -ForegroundColor Yellow
Invoke-Scp -Local $Tarball -Remote "/opt/aigarth/"

Write-Host ""
Write-Host "==> Uploading docker-compose.production.yml" -ForegroundColor Yellow
Invoke-Scp -Local $ComposeSource -Remote "/opt/aigarth/infrastructure/"

Write-Host ""
Write-Host "==> docker load" -ForegroundColor Yellow
Invoke-Ssh "docker load -i /opt/aigarth/$TarballName" | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" }

Write-Host ""
Write-Host "==> Verifying .env.production" -ForegroundColor Cyan
$envStat = Invoke-Ssh "test -f /opt/aigarth/.env.production && stat -c '%s bytes' /opt/aigarth/.env.production || echo MISSING"
Write-Host "    .env.production: $envStat"

Write-Host ""
Write-Host "==> Recreating only the aigarth/web container" -ForegroundColor Yellow
# --no-deps: don't touch the 12 services or the infra. --force-recreate
# because the image tag (aigarth/web:latest) is the same; compose won't
# restart it otherwise.
Invoke-Ssh "cd /opt/aigarth && docker compose --env-file /opt/aigarth/.env.production -f infrastructure/docker-compose.production.yml up -d --no-deps --force-recreate web"

Write-Host ""
Write-Host "==> Final state for the web service" -ForegroundColor Cyan
Invoke-Ssh "cd /opt/aigarth && docker compose --env-file /opt/aigarth/.env.production -f infrastructure/docker-compose.production.yml ps web"

Write-Host ""
Write-Host "==> Done." -ForegroundColor Green
Write-Host "    The 12 services + dashboard + infra continue running untouched."
Write-Host "    Only aigarth/web was recreated with the new image."
Write-Host "    Next: curl -I https://aigarth.cloud/  (after Let's Encrypt warms up, ~30s)"
