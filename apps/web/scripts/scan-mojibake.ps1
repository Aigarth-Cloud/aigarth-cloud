$ErrorActionPreference = 'Stop'
$base = "C:/Users/Wesley/.minimax-agent/projects/qubic-aigarth-cloud/apps/web/app/(marketing)"
$utf8 = [System.Text.Encoding]::UTF8

# Catch-all scan: look for any of the common mojibake prefix bytes
# (UTF-8 0xC3 0xA2 = "â") followed by another byte, which signals
# a corrupted multi-byte UTF-8 sequence.
$files = Get-ChildItem -Path $base -Recurse -Include "*.tsx","*.ts" -ErrorAction SilentlyContinue
$hits = @{}
foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  for ($i = 0; $i -lt $bytes.Length - 1; $i++) {
    if ($bytes[$i] -eq 0xC3 -and $bytes[$i + 1] -eq 0xA2) {
      # Found "â" — capture the next 2-3 bytes as the mojibake signature
      $ctxStart = [Math]::Max(0, $i - 5)
      $ctxLen = [Math]::Min(40, $bytes.Length - $ctxStart)
      $ctxBytes = $bytes[$ctxStart..($ctxStart + $ctxLen - 1)]
      $ctx = $utf8.GetString($ctxBytes)
      $relPath = $f.FullName.Replace("C:/Users/Wesley/.minimax-agent/projects/qubic-aigarth-cloud/", "")
      if (-not $hits.ContainsKey($relPath)) { $hits[$relPath] = @() }
      $hits[$relPath] += "  offset $i : $ctx"
    }
  }
}
if ($hits.Count -eq 0) {
  Write-Output "CLEAN - no remaining 'a-circumflex' mojibake signatures in marketing copy."
} else {
  Write-Output "REMAINING MOJIBAKE"
  foreach ($k in ($hits.Keys | Sort-Object)) {
    Write-Output ""
    Write-Output $k
    $hits[$k] | Select-Object -First 5 | ForEach-Object { Write-Output $_ }
  }
}
