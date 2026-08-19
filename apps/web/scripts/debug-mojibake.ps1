$ErrorActionPreference = 'Stop'
$f = "C:/Users/Wesley/.minimax-agent/projects/qubic-aigarth-cloud/apps/web/app/(marketing)/ai-compute/page.tsx"
$bytes = [System.IO.File]::ReadAllBytes($f)
# Find the em-dash position. Em-dash UTF-8 is E2 80 94.
$pattern = [byte[]](0xE2, 0x80, 0x94)
$idx = -1
for ($i = 0; $i -le $bytes.Length - $pattern.Length; $i++) {
  $match = $true
  for ($j = 0; $j -lt $pattern.Length; $j++) {
    if ($bytes[$i + $j] -ne $pattern[$j]) { $match = $false; break }
  }
  if ($match) { $idx = $i; break }
}
Write-Output ("Index of em-dash UTF-8 bytes: $idx")
if ($idx -ge 0) {
  Write-Output ("Bytes at position: " + (($bytes[$idx..($idx+3)] | ForEach-Object { $_.ToString("X2") }) -join " "))
  $context = $bytes[[Math]::Max(0, $idx-15)..($idx+15)]
  Write-Output ("Context bytes: " + (($context | ForEach-Object { $_.ToString("X2") }) -join " "))
  Write-Output ("Context as UTF-8: " + [System.Text.Encoding]::UTF8.GetString($context))
  Write-Output ("Context as 1252: " + [System.Text.Encoding]::GetEncoding(1252).GetString($context))
}

# Also look for the mojibake pattern (C3 A2 E2 82 AC)
$mojibake = [byte[]](0xC3, 0xA2, 0xE2, 0x82, 0xAC)
$idx2 = -1
for ($i = 0; $i -le $bytes.Length - $mojibake.Length; $i++) {
  $match = $true
  for ($j = 0; $j -lt $mojibake.Length; $j++) {
    if ($bytes[$i + $j] -ne $mojibake[$j]) { $match = $false; break }
  }
  if ($match) { $idx2 = $i; break }
}
Write-Output ("")
Write-Output ("Index of mojibake bytes (C3 A2 E2 82 AC): $idx2")
if ($idx2 -ge 0) {
  Write-Output ("Bytes: " + (($bytes[$idx2..($idx2+4)] | ForEach-Object { $_.ToString("X2") }) -join " "))
}
