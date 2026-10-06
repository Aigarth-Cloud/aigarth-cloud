# build-dashboard-image.ps1
#
# Build only the aigarth/dashboard image (apps/dashboard → command.aigarth.cloud)
# and drop a single-image tarball at dist\aigarth-dashboard-latest.tar.
# Use this for fast dashboard-only iteration. For a full release ship,
# use scripts\build-prod-images.ps1 + scripts\ship-to-vps.ps1 instead.
#
# Output:
#   dist\aigarth-dashboard-latest.tar
#
# Next step: .\scripts\ship-dashboard-only.ps1

[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$OutputDir = "dist"
)

# NOTE: do not set $ErrorActionPreference = 'Stop' globally — Docker
# buildx emits informational lines to stderr that PowerShell
# interprets as errors. We only stop on real exit codes.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..") | Select-Object -ExpandProperty Path
Set-Location $RepoRoot

$App = "dashboard"
$Image = "aigarth/$App"
$TarPath = Join-Path $OutputDir "$App-latest.tar"

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

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "==> Building $Image ..." -ForegroundColor Yellow
    & docker buildx build --platform linux/amd64 --build-arg "APP=$App" -f Dockerfile.app -t "$Image`:latest" --load .
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed for $Image (exit $LASTEXITCODE)"
    }
} else {
    Write-Host "==> Skipping build (-SkipBuild). Using local image as-is." -ForegroundColor Yellow
}

# Verify the image is present
Write-Host ""
Write-Host "==> Verifying image in local cache:" -ForegroundColor Cyan
$present = docker images --format '{{.Repository}}:{{.Tag}}' | Where-Object { $_ -eq "$Image`:latest" }
if (-not $present) { throw "$Image:latest not found after build." }
$size = docker images --format '{{.Size}}' $Image | Select-Object -First 1
Write-Host "    [OK]  $Image:latest ($size)" -ForegroundColor Green

# Save tarball
Write-Host ""
Write-Host "==> Saving tarball to $TarPath ..." -ForegroundColor Yellow
& docker save -o $TarPath "$Image`:latest"
if ($LASTEXITCODE -ne 0) { throw "docker save failed (exit $LASTEXITCODE)" }

$TarSize = (Get-Item $TarPath).Length
$TarSizeMb = [math]::Round($TarSize / 1MB, 1)
Write-Host ""
Write-Host "==> Done." -ForegroundColor Green
Write-Host "    Tarball: $TarPath ($TarSizeMb MB)" -ForegroundColor Green
Write-Host "    Next step: .\scripts\ship-dashboard-only.ps1" -ForegroundColor Green