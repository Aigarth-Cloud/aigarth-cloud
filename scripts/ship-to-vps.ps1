# ship-to-vps.ps1
#
# Ship the built image tarball to the Hostinger VPS, load the images into
# the host's Docker daemon, drop the Caddyfile snippet, and bring up the
# production stack in the right order.
#
# Uses Windows OpenSSH (ssh.exe / scp.exe from C:\Windows\System32\OpenSSH\)
# rather than PuTTY plink/pscp. Reason: PuTTY 0.83 plink.exe refuses the
# OpenSSH-format private key that `ssh-keygen -o` produces, with:
#   "OpenSSH SSH-2 private key (new format)"
# OpenSSH ssh.exe reads that key natively. The deploy key on this machine
# lives at $HOME\.ssh\aigarth-deploy (override with -Key).
#
# Prereqs:
#   - Run build-prod-images.ps1 first (or pass -Tarball to an existing one)
#   - The deploy key at $HOME\.ssh\aigarth-deploy is unencrypted, or the
#     key is loaded into ssh-agent (ssh-add) if it has a passphrase
#   - The host fingerprint is in $HOME\.ssh\known_hosts; first-time
#     connections auto-accept with StrictHostKeyChecking=accept-new
#   - /opt/aigarth/.env.production must already be on the VPS
#
# Usage:
#   .\scripts\ship-to-vps.ps1
#   .\scripts\ship-to-vps.ps1 -Tarball dist\aigarth-images-20260818-123000.tar
#   .\scripts\ship-to-vps.ps1 -SkipLoad       # just upload
#   .\scripts\ship-to-vps.ps1 -SkipUp         # load + up without re-upload
#   .\scripts\ship-to-vps.ps1 -Key C:\Users\you\.ssh\other_key

[CmdletBinding()]
param(
    [string]$VpsHost = "187.124.35.93",
    [int]$VpsPort = 22,
    [string]$VpsUser = "root",
    # SSH key file. Defaults to the project's deploy key. The key MUST be
    # in OpenSSH format (-----BEGIN OPENSSH PRIVATE KEY-----) — PuTTY .ppk
    # files are not supported here.
    [string]$Key = (Join-Path $env:USERPROFILE ".ssh\aigarth-deploy"),
    [string]$Tarball,
    [switch]$SkipLoad,
    [switch]$SkipUp
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Resolve OpenSSH tool paths
# ---------------------------------------------------------------------------
# Prefer the system ssh.exe / scp.exe; fall back to the default Windows
# OpenSSH install location.
$Ssh = (Get-Command ssh.exe -ErrorAction SilentlyContinue).Source
if (-not $Ssh) {
    $Ssh = "$env:SystemRoot\System32\OpenSSH\ssh.exe"
}
$Scp = (Get-Command scp.exe -ErrorAction SilentlyContinue).Source
if (-not $Scp) {
    $Scp = "$env:SystemRoot\System32\OpenSSH\scp.exe"
}
if (-not (Test-Path $Ssh)) { throw "ssh.exe not found. Install the Windows OpenSSH client (Windows 10 1809+ ships it)." }
if (-not (Test-Path $Scp)) { throw "scp.exe not found. Install the Windows OpenSSH client (Windows 10 1809+ ships it)." }

if (-not (Test-Path $Key)) {
    throw "Deploy key not found at $Key. Override with -Key <path>, or add the key to ssh-agent (ssh-add)."
}

# ---------------------------------------------------------------------------
# Locate the tarball
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Locate the Caddyfile snippet and the production compose
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Common OpenSSH args
# ---------------------------------------------------------------------------
# -i <key>             : deploy key
# -p <port>            : ssh port (lowercase p; scp uses -P, see below)
# -o BatchMode=yes     : never prompt for password/passphrase (we have a key)
# -o StrictHostKeyChecking=accept-new : first time we see a host we accept
#   and remember it in known_hosts; subsequent runs verify the pinned key.
#   This is the OpenSSH equivalent of plink's -hostkey <fingerprint>.
$sshBase = @(
    "-i", $Key,
    "-p", "$VpsPort",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new"
)
# scp uses -P (capital) for port, otherwise the same flags.
$scpBase = @(
    "-i", $Key,
    "-P", "$VpsPort",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new"
)

function Invoke-Ssh {
    param([string]$Cmd)
    $args = $sshBase + @("$VpsUser@$VpsHost", $Cmd)
    $output = & $Ssh @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "SSH command failed (exit $LASTEXITCODE): $Cmd`n$($output -join "`n")"
    }
    return $output
}

function Invoke-Scp {
    # Single file upload: Invoke-Scp -Local <path> -Remote <dir-or-full-path>
    param(
        [Parameter(Mandatory)][string]$Local,
        [Parameter(Mandatory)][string]$Remote
    )
    $args = $scpBase + @($Local, "${VpsUser}@${VpsHost}:$Remote")
    & $Scp @args
    if ($LASTEXITCODE -ne 0) {
        throw "scp upload failed (exit $LASTEXITCODE): $Local -> $Remote"
    }
}

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
Write-Host "==> Pre-flight: verify SSH works" -ForegroundColor Cyan
$whoami = Invoke-Ssh "whoami"
Write-Host "    Logged in as: $($whoami -join '')" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Upload the tarball
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> Uploading $TarballName to /opt/aigarth/ ..." -ForegroundColor Yellow
Invoke-Scp -Local $Tarball -Remote "/opt/aigarth/"

# Upload the compose file
Write-Host ""
Write-Host "==> Uploading docker-compose.production.yml ..." -ForegroundColor Yellow
Invoke-Scp -Local $ComposeSource -Remote "/opt/aigarth/infrastructure/"

# Upload the Caddyfile snippet
Write-Host ""
Write-Host "==> Uploading Caddyfile.aigarth ..." -ForegroundColor Yellow
Invoke-Scp -Local $CaddyfileSource -Remote "/etc/caddy/Caddyfile.d/aigarth.caddy"

if ($SkipLoad) {
    Write-Host ""
    Write-Host "==> -SkipLoad: skipping docker load + compose up." -ForegroundColor Yellow
    return
}

# ---------------------------------------------------------------------------
# Load images
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> docker load -i /opt/aigarth/$TarballName ..." -ForegroundColor Yellow
Invoke-Ssh "docker load -i /opt/aigarth/$TarballName" | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" }

# Verify images loaded
Write-Host ""
Write-Host "==> Verifying aigarth/* images on the host:" -ForegroundColor Cyan
$imgs = Invoke-Ssh "docker images --format '{{.Repository}}:{{.Tag}}' | grep '^aigarth/'"
$imgs | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }

if ($SkipUp) {
    Write-Host ""
    Write-Host "==> -SkipUp: skipping compose up." -ForegroundColor Yellow
    return
}

# ---------------------------------------------------------------------------
# Bring up the production stack
# ---------------------------------------------------------------------------

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
