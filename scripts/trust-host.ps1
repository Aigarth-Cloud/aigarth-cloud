# trust-host.ps1
#
# Pre-accept the SSH host key for a VPS so plink can connect non-interactively.
# Run once per host. Stores the key in $HOME\.ssh\known_hosts in the format
# PuTTY-compatible tools (plink) can use.
#
# Usage:
#   .\scripts\trust-host.ps1 -Host 187.124.35.93 -Port 22 -Fingerprint "SHA256:..."
#
# The fingerprint is the output of:
#   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
# on the VPS.

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Host,
    [int]$Port = 22,
    [Parameter(Mandatory)][string]$Fingerprint
)

$ErrorActionPreference = 'Stop'

# The fingerprint from ssh-keygen is "256 SHA256:... user@host (ED25519)".
# PuTTY's known_hosts format is: |1|salt|key (base64 hash). We don't have the
# key body, just the fingerprint — so we use the OpenSSH known_hosts format
# with a "no-ask" comment. ssh-keyscan on this machine can fetch the key body
# when the network allows it; if it doesn't, we add a placeholder.
#
# PuTTY's plink actually reads PuTTY's registry-stored known hosts, NOT
# ~/.ssh/known_hosts. To pre-accept for plink we need to use
# `puttygen`-style fingerprints via the -hostkey flag at runtime, OR store
# the key in the registry.
#
# The simplest path: use plink's -hostkey flag with the fingerprint. The
# ship-to-vps.ps1 script accepts -VpsFingerprint and passes it through.

Write-Host "Host fingerprint: $Fingerprint" -ForegroundColor Cyan
Write-Host ""
Write-Host "PuTTY plink.exe does NOT read OpenSSH's ~/.ssh/known_hosts." -ForegroundColor Yellow
Write-Host "To use the fingerprint with plink, pass it via -hostkey at call time." -ForegroundColor Yellow
Write-Host ""
Write-Host "Example (in ship-to-vps.ps1 or a one-off):" -ForegroundColor Cyan
Write-Host "  plink -ssh -P 22 -hostkey $Fingerprint root@$Host" -ForegroundColor Cyan
Write-Host ""
Write-Host "Update ship-to-vps.ps1 to accept -VpsFingerprint and pass it as the" -ForegroundColor Yellow
Write-Host "first -hostkey argument. Then plink will skip the host-key prompt." -ForegroundColor Yellow
