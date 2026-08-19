# ship-to-vps.ps1
#
# Ship the built image tarball to the Hostinger VPS, load the images into
# the host's Docker daemon, drop the Caddyfile snippet, and bring up the
# production stack in the right order.
#
# Prereqs:
#   - Run build-prod-images.ps1 first (or pass -Tarball to an existing one)
#   - The VPS host fingerprint must be in $HOME\.ssh\known_hosts
#     (run .\scripts\trust-host.ps1 -Once to add it)
#   - /opt/aigarth/.env.production must already be on the VPS
#
# Usage:
#   .\scripts\ship-to-vps.ps1
#   .\scripts\ship-to-vps.ps1 -Tarball dist\aigarth-images-20260818-123000.tar
#   .\scripts\ship-to-vps.ps1 -SkipLoad       # just upload
#   .\scripts\ship-to-vps.ps1 -SkipUp         # load + up without re-upload

[CmdletBinding()]
param(
    [string]$VpsHost = "187.124.35.93",
    [int]$VpsPort = 22,
    [string]$VpsUser = "root",
    [string]$VpsPassword,
    [string]$VpsFingerprint,
    [string]$Tarball,
    [switch]$SkipLoad,
    [switch]$SkipUp
)

$ErrorActionPreference = 'Stop'

# Locate the tarball if not specified — pick the most recent one in dist/
if (-not $Tarball) {
    $dist = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "..\dist"
    $dist = Resolve-Path $dist -ErrorAction SilentlyContinue
    if (-not $dist) {
        throw "No dist/ directory found. Run build-prod-images.ps1 first."
    }
    $Tarball = Get-ChildItem -Path $dist -Filter "aigarth-images-*.tar" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $Tarball) {
        throw "No aigarth-images-*.tar found in $dist. Run build-prod-images.ps1 first."
    }
}
if (-not (Test-Path $Tarball)) {
    throw "Tarball not found: $Tarball"
}
$Tarball = Resolve-Path $Tarball | Select-Object -ExpandProperty Path
$TarballName = Split-Path -Leaf $Tarball

# Locate the Caddyfile snippet
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..") | Select-Object -ExpandProperty Path
$CaddyfileSource = Join-Path $RepoRoot "infrastructure\Caddyfile.aigarth"
$ComposeSource = Join-Path $RepoRoot "infrastructure\docker-compose.production.yml"

if (-not (Test-Path $CaddyfileSource)) {
    throw "Caddyfile source not found: $CaddyfileSource"
}
if (-not (Test-Path $ComposeSource)) {
    throw "Compose file not found: $ComposeSource"
}

# Plink path
$Plink = "C:\Program Files\PuTTY\plink.exe"
$Pscp = "C:\Program Files\PuTTY\pscp.exe"
if (-not (Test-Path $Plink)) {
    throw "PuTTY plink.exe not found at $Plink"
}
if (-not (Test-Path $Pscp)) {
    throw "PuTTY pscp.exe not found at $Pscp"
}

# Build plink/pscp arg list
$plinkArgs = @("-ssh", "-P", "$VpsPort", "-batch")
$pscpArgs = @("-P", "$VpsPort")
if ($VpsFingerprint) {
    $plinkArgs += @("-hostkey", $VpsFingerprint)
    $pscpArgs += @("-hostkey", $VpsFingerprint)
}
if ($VpsPassword) {
    $plinkArgs += @("-pw", $VpsPassword)
    $pscpArgs += @("-pw", $VpsPassword)
} else {
    # If no password, plink needs an SSH key — agent or default key
    Write-Host "==> No -VpsPassword provided; relying on SSH agent or default key." -ForegroundColor Yellow
}

function Invoke-Ssh {
    param([string]$Cmd)
    $args = $plinkArgs + @("$VpsUser@$VpsHost", $Cmd)
    $output = & $Plink @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "SSH command failed: $Cmd`n$($output -join "`n")"
    }
    return $output
}

# Pre-flight
Write-Host "==> Pre-flight: verify SSH works" -ForegroundColor Cyan
$whoami = Invoke-Ssh "whoami"
Write-Host "    Logged in as: $whoami" -ForegroundColor Green

# Upload the tarball
Write-Host ""
Write-Host "==> Uploading $TarballName to /opt/aigarth/ ..." -ForegroundColor Yellow
$remoteTar = "/opt/aigarth/$TarballName"
$pscpArgs += @($Tarball, "${VpsUser}@${VpsHost}:/opt/aigarth/")
& $Pscp @pscpArgs
if ($LASTEXITCODE -ne 0) {
    throw "pscp upload failed"
}

# Upload the compose file
Write-Host ""
Write-Host "==> Uploading docker-compose.production.yml ..." -ForegroundColor Yellow
$pscpComposeArgs = $pscpArgs[0..($pscpArgs.Count - 2)] + @(
    $ComposeSource,
    "${VpsUser}@${VpsHost}:/opt/aigarth/infrastructure/"
)
# (Re-call with the trailing pair replaced)
$pscpArgsClean = @("-P", "$VpsPort")
if ($VpsPassword) { $pscpArgsClean += @("-pw", $VpsPassword) }
$pscpArgsClean += @($ComposeSource, "${VpsUser}@${VpsHost}:/opt/aigarth/infrastructure/")
& $Pscp @pscpArgsClean
if ($LASTEXITCODE -ne 0) { throw "pscp compose upload failed" }

# Upload the Caddyfile snippet
Write-Host ""
Write-Host "==> Uploading Caddyfile.aigarth ..." -ForegroundColor Yellow
$pscpCaddyArgs = $pscpArgsClean[0..($pscpArgsClean.Count - 2)] + @(
    $CaddyfileSource,
    "${VpsUser}@${VpsHost}:/etc/caddy/Caddyfile.d/aigarth.caddy"
)
& $Pscp @pscpCaddyArgs
if ($LASTEXITCODE -ne 0) { throw "pscp caddyfile upload failed" }

if ($SkipLoad) {
    Write-Host ""
    Write-Host "==> -SkipLoad: skipping docker load + compose up." -ForegroundColor Yellow
    return
}

# Load images
Write-Host ""
Write-Host "==> docker load -i /opt/aigarth/$TarballName ..." -ForegroundColor Yellow
Invoke-Ssh "docker load -i /opt/aigarth/$TarballName" | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" }

# Verify images loaded
Write-Host ""
Write-Host "==> Verifying images on the host:" -ForegroundColor Cyan
$imgs = Invoke-Ssh "docker images --format '{{.Repository}}:{{.Tag}}' | grep aigarth/"
$imgs | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }

if ($SkipUp) {
    Write-Host ""
    Write-Host "==> -SkipUp: skipping compose up." -ForegroundColor Yellow
    return
}

# Verify .env.production is in place (the script does not write it; user does)
Write-Host ""
Write-Host "==> Verifying /opt/aigarth/.env.production ..." -ForegroundColor Cyan
$envStat = Invoke-Ssh "test -f /opt/aigarth/.env.production && stat -c '%a %s' /opt/aigarth/.env.production || echo MISSING"
if ($envStat -eq "MISSING") {
    throw ".env.production not found at /opt/aigarth/.env.production on the VPS. Write it from infrastructure/env.production.example, replacing every __GENERATE_AND_PASTE_...__ placeholder."
}
Write-Host "    /opt/aigarth/.env.production: $envStat" -ForegroundColor Green

# Bring up infra first
Write-Host ""
Write-Host "==> Bringing up infra (postgres, redis, nats, minio) ..." -ForegroundColor Yellow
Invoke-Ssh "cd /opt/aigarth && docker compose -f infrastructure/docker-compose.production.yml up -d postgres redis nats minio minio-init"

# Wait for healthy
Write-Host "    Waiting for infra to become healthy ..." -ForegroundColor Yellow
Invoke-Ssh "cd /opt/aigarth && docker compose -f infrastructure/docker-compose.production.yml ps"

# Run migrations
Write-Host ""
Write-Host "==> Running migrations (aigarth/migrate) ..." -ForegroundColor Yellow
Invoke-Ssh "cd /opt/aigarth && docker compose -f infrastructure/docker-compose.production.yml run --rm migrate" 2>&1 |
    ForEach-Object { Write-Host "    $_" }

# Bring up everything else
Write-Host ""
Write-Host "==> Bringing up all services + apps ..." -ForegroundColor Yellow
Invoke-Ssh "cd /opt/aigarth && docker compose -f infrastructure/docker-compose.production.yml up -d"

# Reload Caddy
Write-Host ""
Write-Host "==> Reloading host Caddy to pick up the aigarth snippet ..." -ForegroundColor Yellow
Invoke-Ssh "systemctl reload caddy" 2>&1 | ForEach-Object { Write-Host "    $_" }

# Final smoke
Write-Host ""
Write-Host "==> Final state:" -ForegroundColor Cyan
Invoke-Ssh "cd /opt/aigarth && docker compose -f infrastructure/docker-compose.production.yml ps"

Write-Host ""
Write-Host "==> Done. Next steps:" -ForegroundColor Green
Write-Host "    1. Wait ~30s for Let's Encrypt to issue certs." -ForegroundColor Green
Write-Host "    2. Run the smoke tests: curl -I https://aigarth.cloud/" -ForegroundColor Green
Write-Host "    3. Run all 18 dashboard targets: open https://aigarth.cloud/services" -ForegroundColor Green
