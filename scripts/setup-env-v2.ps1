# Rewrites every service's .env from .env.example, with the right
# JWT secret + ADMIN_PASSWORD so all seeds + services verify the
# same tokens.
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Wesley\.minimax-agent\projects\qubic-aigarth-cloud'

# Use the secret that was already in the existing services. We copy
# it into every .env to keep cross-service auth working.
$sharedSecret = (Get-Content "$root\services\identity\.env" -Raw) -match 'JWT_SECRET=(\S+)' | Out-Null; $null
$matches = [regex]::Match((Get-Content "$root\services\identity\.env" -Raw), 'JWT_SECRET=(\S+)')
$sharedSecret = $matches.Groups[1].Value
if (-not $sharedSecret) { $sharedSecret = 'dev-jwt-secret-fallback' }
Write-Host "Using JWT secret: $sharedSecret"

$services = @(
  @{ Name = 'identity' }
  @{ Name = 'qubic' }
  @{ Name = 'compute' }
  @{ Name = 'gateway' }
  @{ Name = 'billing' }
  @{ Name = 'ann' }
  @{ Name = 'marketplace' }
  @{ Name = 'economy' }
)

foreach ($s in $services) {
  $svcDir = Join-Path $root "services\$($s.Name)"
  $examplePath = Join-Path $svcDir '.env.example'
  $envPath = Join-Path $svcDir '.env'
  if (-not (Test-Path $examplePath)) { Write-Host "  [skip] $($s.Name) - no .env.example"; continue }

  $content = Get-Content $examplePath -Raw
  # Substitute placeholders
  $content = $content -replace 'replace-me-with-the-same-secret-as-identity', $sharedSecret
  $content = $content -replace 'JWT_SECRET=replace-me-with-the-same-secret-as-identity', "JWT_SECRET=$sharedSecret"
  # Identity needs a non-default admin password (the seed warns + exits otherwise)
  if ($s.Name -eq 'identity') {
    $content = $content + "`nADMIN_PASSWORD=dev-admin-pass`nADMIN_EMAIL=admin@aigarth.local`nADMIN_NAME=Admin`n"
  }
  # Force LF line endings (the project uses LF; PowerShell Set-Content defaults to CRLF)
  $content = $content -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText($envPath, $content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "  [wrote] $($s.Name) ($((Get-Content $envPath).Count) lines)"
}
Write-Host "Done."
