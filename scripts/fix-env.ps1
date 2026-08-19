#!/usr/bin/env pwsh
# Properly rewrites all service .env files from .env.example,
# preserving line breaks. Previous versions got flattened by
# Set-Content + WriteAllText races. This one uses UTF-8 with no BOM
# and writes line-by-line.
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Wesley\.minimax-agent\projects\qubic-aigarth-cloud'

$sharedSecret = '24483bfb1fc98577aa908a891c115ef3df44e109283bad3ea72f157058d710cd'

# Per-service overrides (lines we want to add or replace after substitution)
$overrides = @{
  'identity' = @(
    'ADMIN_PASSWORD=dev-admin-pass',
    'ADMIN_EMAIL=admin@aigarth.local',
    'ADMIN_NAME=Admin'
  )
}

$services = @('identity','qubic','compute','gateway','billing','ann','marketplace','economy')

foreach ($svc in $services) {
  $examplePath = Join-Path $root "services\$svc\.env.example"
  $envPath = Join-Path $root "services\$svc\.env"
  if (-not (Test-Path $examplePath)) { Write-Host "  [skip] $svc (no .env.example)"; continue }

  $raw = Get-Content $examplePath -Raw
  # Normalize line endings to LF
  $raw = $raw -replace "`r`n", "`n"
  # Substitute placeholders (multiple variants across services)
  $raw = $raw -replace 'replace-me-with-the-same-secret-as-identity', $sharedSecret
  $raw = $raw -replace 'replace-me-with-a-32-byte-hex-secret-in-production', $sharedSecret
  $raw = $raw -replace 'JWT_SECRET=replace-me-with-the-same-secret-as-identity', "JWT_SECRET=$sharedSecret"
  # Last-resort: if a placeholder was missed, force JWT_SECRET to the real one
  $raw = [regex]::Replace($raw, '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$sharedSecret")

  # Per-service overrides (append at the end, separated by newlines)
  if ($overrides[$svc]) {
    foreach ($line in $overrides[$svc]) {
      $raw += "`n" + $line
    }
  }

  # Write as UTF-8 without BOM, LF endings
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  $stream = [System.IO.File]::Create($envPath)
  $writer = New-Object System.IO.StreamWriter($stream, $utf8)
  $writer.Write($raw)
  $writer.Close()
  $stream.Close()

  $lineCount = (Get-Content $envPath).Count
  Write-Host "  [wrote] $svc ($lineCount lines)"
}

Write-Host ""
Write-Host "Verifying JWT_SECRET alignment:"
foreach ($svc in $services) {
  $envPath = Join-Path $root "services\$svc\.env"
  $secret = ([regex]::Match((Get-Content $envPath -Raw), 'JWT_SECRET=(\S+)')).Groups[1].Value
  Write-Host "  $svc : $($secret.Substring(0, [Math]::Min(20, $secret.Length)))..."
}
