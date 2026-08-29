# build-web-only.ps1
# One-shot script: build aigarth/web, save to dist\aigarth-web-latest.tar.
# Same docker buildx args the full build-prod-images.ps1 uses for the web app.

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..") | Select-Object -ExpandProperty Path
Set-Location $RepoRoot

if (-not (Test-Path "dist")) { New-Item -ItemType Directory -Path "dist" | Out-Null }

$BuildLog = Join-Path $RepoRoot "dist\build-web-buildx.log"
$Tarball = Join-Path $RepoRoot "dist\aigarth-web-latest.tar"
if (Test-Path $BuildLog) { Remove-Item $BuildLog -Force }
if (Test-Path $Tarball) { Remove-Item $Tarball -Force }

Write-Host "==> Building aigarth/web (progress=plain) ..."
& docker.exe buildx build `
    --progress=plain `
    --platform linux/amd64 `
    --build-arg "APP=web" `
    -f "Dockerfile.app" `
    -t "aigarth/web:latest" `
    --load . `
    *> "$BuildLog"
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD FAILED (exit $LASTEXITCODE). Tail of ${BuildLog}:"
    Get-Content $BuildLog -Tail 30 | ForEach-Object { Write-Host "    $_" }
    exit $LASTEXITCODE
}

Write-Host "BUILD OK. Saving tarball ..."
docker save -o $Tarball aigarth/web:latest 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "SAVE FAILED (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
}

$size = [math]::Round((Get-Item $Tarball).Length / 1MB, 1)
Write-Host "==> Done. Tarball: $Tarball ($size MB)"
Write-Host "    Next: .\scripts\ship-to-vps.ps1 -Tarball $Tarball"
