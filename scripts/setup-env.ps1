# Generates .env files for every service from the .env.example templates.
# Uses a single shared JWT secret so tokens minted by the identity
# service verify across all services.

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Wesley\.minimax-agent\projects\qubic-aigarth-cloud'

# Shared 32-byte hex secret (matches what identity/qubic/billing expect)
$sharedSecret = 'dev-jwt-secret-' + (-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Min 0 -Max 255) }))
Write-Host "Generated JWT secret: $sharedSecret"
Write-Host ""

$services = @(
  @{ Name = 'identity';     Port = 7001 },
  @{ Name = 'qubic';        Port = 7002 },
  @{ Name = 'compute';      Port = 7003 },
  @{ Name = 'gateway';      Port = 7004 },
  @{ Name = 'billing';      Port = 7005 },
  @{ Name = 'ann';          Port = 7006 },
  @{ Name = 'marketplace';  Port = 7007 },
  @{ Name = 'tissue';       Port = 7008 },
  @{ Name = 'dataset';      Port = 7009 },
  @{ Name = 'economy';      Port = 7010 }
)

foreach ($s in $services) {
  $svcDir = Join-Path $root "services\$($s.Name)"
  $examplePath = Join-Path $svcDir '.env.example'
  $envPath = Join-Path $svcDir '.env'

  if (-not (Test-Path $examplePath)) {
    Write-Host "  [skip] $($s.Name) - no .env.example"
    continue
  }
  if (Test-Path $envPath) {
    Write-Host "  [exists] $($s.Name) - .env already present"
    continue
  }

  $content = Get-Content $examplePath -Raw
  # Substitute the placeholder JWT secret
  $content = $content -replace 'replace-me-with-the-same-secret-as-identity', $sharedSecret
  # Substitute placeholder JWT secret in economy (different default)
  $content = $content -replace 'JWT_SECRET=replace-me-with-the-same-secret-as-identity', "JWT_SECRET=$sharedSecret"
  Set-Content -Path $envPath -Value $content -NoNewline
  Write-Host "  [created] $($s.Name) - .env written"
}

Write-Host ""
Write-Host "All service .env files written. JWT secret is shared across services."
