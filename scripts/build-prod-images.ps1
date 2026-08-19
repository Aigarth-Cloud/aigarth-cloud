# build-prod-images.ps1
#
# Build the 14 Aigarth Cloud production images (12 services + 2 apps + migrate)
# and save them as a single tarball that can be shipped to the VPS.
#
# Prereqs:
#   - Docker Desktop running with buildx (default on Docker Desktop 4.x)
#   - Run from the repo root: .\scripts\build-prod-images.ps1
#
# Output:
#   dist\aigarth-images-YYYYMMDD-HHMMSS.tar
#   (~2.5 GB; ships via scp/pscp to root@187.124.35.93)
#
# Idempotent: re-running rebuilds and overwrites the tarball.

[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$OutputDir = "dist"
)

# NOTE: do not set $ErrorActionPreference = 'Stop' globally — Docker
# buildx emits informational lines to stderr that PowerShell
# interprets as errors. We only stop on real exit codes.

# Repo root = parent of this script's directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..") | Select-Object -ExpandProperty Path
Set-Location $RepoRoot

# Service list — keep in sync with the AGENTS.md port table and the production
# compose. Order matches the production compose (gateway 7004 is exposed to host).
$Services = @(
    "identity", "qubic", "compute", "gateway", "billing", "ann",
    "marketplace", "tissue", "dataset", "economy", "training", "work"
)
$Apps = @("web", "dashboard")
$AllImages = @("aigarth/migrate") + ($Apps | ForEach-Object { "aigarth/$_" }) + ($Services | ForEach-Object { "aigarth/$_" })

# Verify Docker is responsive
Write-Host "==> Docker version:" -ForegroundColor Cyan
docker version --format '{{.Server.Version}}' | Out-Host

# Verify buildx is available
$BuildxVersion = docker buildx version 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "docker buildx not available. Update Docker Desktop to 4.x+."
}
Write-Host "==> Buildx: $BuildxVersion" -ForegroundColor Cyan

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TarPath = Join-Path $OutputDir "aigarth-images-$Timestamp.tar"

if (-not $SkipBuild) {
    # ---- Build services ----
    foreach ($svc in $Services) {
        Write-Host ""
        Write-Host "==> Building aigarth/$svc ..." -ForegroundColor Yellow
        & docker buildx build --platform linux/amd64 --build-arg "SERVICE=$svc" -f Dockerfile.service -t "aigarth/$svc`:latest" --load .
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed for aigarth/$svc (exit $LASTEXITCODE)"
        }
    }

    # ---- Build apps ----
    foreach ($app in $Apps) {
        Write-Host ""
        Write-Host "==> Building aigarth/$app ..." -ForegroundColor Yellow
        & docker buildx build --platform linux/amd64 --build-arg "APP=$app" -f Dockerfile.app -t "aigarth/$app`:latest" --load .
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed for aigarth/$app (exit $LASTEXITCODE)"
        }
    }

    # ---- Build migrate image ----
    Write-Host ""
    Write-Host "==> Building aigarth/migrate ..." -ForegroundColor Yellow
    & docker buildx build --platform linux/amd64 -f Dockerfile.migrate -t "aigarth/migrate:latest" --load .
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed for aigarth/migrate (exit $LASTEXITCODE)"
    }
} else {
    Write-Host "==> Skipping build (-SkipBuild). Using local images as-is." -ForegroundColor Yellow
}

# ---- Verify all expected images are present ----
Write-Host ""
Write-Host "==> Verifying images in local cache:" -ForegroundColor Cyan
$MissingImages = @()
foreach ($img in $AllImages) {
    $present = docker images --format '{{.Repository}}:{{.Tag}}' | Where-Object { $_ -eq "$($img):latest" }
    if (-not $present) {
        $MissingImages += $img
    } else {
        $size = docker images --format '{{.Size}}' $img | Select-Object -First 1
        Write-Host "    [OK]  $img ($size)" -ForegroundColor Green
    }
}
if ($MissingImages.Count -gt 0) {
    throw "Missing images after build: $($MissingImages -join ', ')"
}

# ---- Save tarball ----
Write-Host ""
Write-Host "==> Saving tarball to $TarPath ..." -ForegroundColor Yellow
$saveArgs = @("save", "-o", $TarPath) + $AllImages
& docker @saveArgs
if ($LASTEXITCODE -ne 0) {
    throw "docker save failed (exit $LASTEXITCODE)"
}

$TarSize = (Get-Item $TarPath).Length
$TarSizeMb = [math]::Round($TarSize / 1MB, 1)
Write-Host ""
Write-Host "==> Done." -ForegroundColor Green
Write-Host "    Tarball: $TarPath ($TarSizeMb MB)" -ForegroundColor Green
Write-Host "    Next step: .\scripts\ship-to-vps.ps1 -Tarball $TarPath" -ForegroundColor Green
