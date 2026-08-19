# Fix mojibake in the public marketing copy.
#
# We work directly on the file bytes. Each mojibake pattern is a
# specific sequence of bytes in UTF-8; we replace it with the correct
# UTF-8 bytes for the intended character.
#
# For example, the em-dash (U+2014) was corrupted like this:
#   1. Original UTF-8: E2 80 94  (3 bytes for "—")
#   2. Read as Latin-1: "â€""   (3 chars: â + € + ")
#   3. Re-saved as UTF-8: C3 A2 E2 82 AC 22  (6 bytes for "â€"")
# So the file's bytes at that position are now C3 A2 E2 82 AC 22,
# and we replace those 6 bytes with E2 80 94 (3 bytes for "—").

$ErrorActionPreference = 'Stop'

# (bad bytes -> good bytes) map
$map = New-Object 'System.Collections.Generic.List[object]'

# Helper: add a replacement entry
function Add-Replace([byte[]]$bad, [byte[]]$good) {
  $map.Add(@{ Bad = $bad; Good = $good })
}

# em-dash "—" (U+2014): bad = "â€"" in UTF-8 (6 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0x22)) ([byte[]](0xE2, 0x80, 0x94))
# em-dash "—" at sentence end followed by space (â€ + space): handle bare "â€"
# but the file may not have the trailing " — just match the 5-byte pattern
# (most common case in this codebase)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x82, 0xAC)) ([byte[]](0xE2, 0x80, 0x94))

# ellipsis "…" (U+2026): bad = "â₦" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x82, 0xA6)) ([byte[]](0xE2, 0x80, 0xA6))

# right single quote "’" (U+2019): bad = "â’" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0x99)) ([byte[]](0xE2, 0x80, 0x99))

# left single quote "‘" (U+2018): bad = "â‘" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0x98)) ([byte[]](0xE2, 0x80, 0x98))

# left double quote "“" (U+201C): bad = "â“" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0x9C)) ([byte[]](0xE2, 0x80, 0x9C))

# right double quote "”" (U+201D): bad = "â”" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0x9D)) ([byte[]](0xE2, 0x80, 0x9D))

# bullet "•" (U+2022): bad = "â•" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0xA2)) ([byte[]](0xE2, 0x80, 0xA2))

# right arrow "→" (U+2192): bad = "â†’" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0xA0, 0xE2, 0x80, 0x99)) ([byte[]](0xE2, 0x86, 0x92))

# left arrow "←" (U+2190): bad = "â†“" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0xA0, 0xE2, 0x80, 0x9C)) ([byte[]](0xE2, 0x86, 0x90))

# up-right arrow "↗" (U+2197): bad = "â†↗" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0xA0, 0xE2, 0x86, 0x97)) ([byte[]](0xE2, 0x86, 0x97))

# check mark "✓" (U+2713): bad = "â✓" in UTF-8 (7 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x9C, 0x93)) ([byte[]](0xE2, 0x9C, 0x93))

# up triangle "▲" (U+25B2): bad = "â▲" in UTF-8 (7 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x96, 0xB2)) ([byte[]](0xE2, 0x96, 0xB2))

# rightwards arrow to bar "↦" (U+21A6): bad = "â†↦" in UTF-8 (8 bytes)
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0xA0, 0xE2, 0x86, 0xA6)) ([byte[]](0xE2, 0x86, 0xA6))

# minus sign "−" (U+2212): bad = "âˆ’" in UTF-8 (7 bytes, triple corruption)
# UTF-8 E2 88 92 -> Latin-1 âˆ’ -> UTF-8 C3 A2 CB 86 E2 80 99
Add-Replace ([byte[]](0xC3, 0xA2, 0xCB, 0x86, 0xE2, 0x80, 0x99)) ([byte[]](0xE2, 0x88, 0x92))

# command symbol "⌘" (U+2318): bad = "âŒ˜" in UTF-8 (5 bytes, Windows-1252 corruption)
# UTF-8 E2 8C 98 -> 1252 âŒ˜ -> UTF-8 C3 A2 C5 92 CB 9C
Add-Replace ([byte[]](0xC3, 0xA2, 0xC5, 0x92, 0xCB, 0x9C)) ([byte[]](0xE2, 0x8C, 0x98))

# almost equal "≈" (U+2248): bad = "â‰ˆ" in UTF-8 (6 bytes, double corruption)
# UTF-8 E2 89 88 -> Latin-1 â‰ˆ -> UTF-8 C3 A2 E2 80 B0 CB 86
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0xB0, 0xCB, 0x86)) ([byte[]](0xE2, 0x89, 0x88))

# star "★" (U+2605): bad = "â­" in UTF-8 (5 bytes, Windows-1252 corruption)
# UTF-8 E2 98 85 -> 1252 â­ -> UTF-8 C3 A2 C2 AD C2 90
Add-Replace ([byte[]](0xC3, 0xA2, 0xC2, 0xAD, 0xC2, 0x90)) ([byte[]](0xE2, 0x98, 0x85))

# middle dot "·" (U+00B7): bad = "Â·" in UTF-8 (4 bytes, double corruption)
# UTF-8 C2 B7 -> Latin-1 Â· -> UTF-8 C3 82 C2 B7
Add-Replace ([byte[]](0xC3, 0x82, 0xC2, 0xB7)) ([byte[]](0xC2, 0xB7))

# em-dash with trailing right double quote (U+2014 + U+201D): bad = "â€”" in UTF-8
# seen when the em-dash was corrupted and the trailing ” was preserved
Add-Replace ([byte[]](0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xE2, 0x80, 0x9D)) ([byte[]](0xE2, 0x80, 0x94, 0xE2, 0x80, 0x9D))

# degree sign "°" (U+00B0): bad = "Â°" in UTF-8 (4 bytes)
Add-Replace ([byte[]](0xC3, 0x82, 0xC2, 0xB0)) ([byte[]](0xC2, 0xB0))

# plus-minus "±" (U+00B1): bad = "Â±" in UTF-8 (4 bytes)
Add-Replace ([byte[]](0xC3, 0x82, 0xC2, 0xB1)) ([byte[]](0xC2, 0xB1))

$base = "C:/Users/Wesley/.minimax-agent/projects/qubic-aigarth-cloud/apps/web"
$files = Get-ChildItem -Path $base -Recurse -Include "*.tsx","*.ts" -ErrorAction SilentlyContinue
Write-Output ("Scanning {0} files under {1}" -f $files.Count, $base)
Write-Output ""

$totalReplacements = 0
$totalFilesTouched = 0
$summary = @()

foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $fileReplacements = 0
  $perMap = @()

  foreach ($entry in $map) {
    $bad = $entry.Bad
    $good = $entry.Good
    $count = 0
    $idx = 0
    while (($idx = [Array]::IndexOf($bytes, $bad[0], $idx)) -ge 0) {
      # Check if the full pattern matches at this position
      if ($idx + $bad.Length -le $bytes.Length) {
        $match = $true
        for ($j = 1; $j -lt $bad.Length; $j++) {
          if ($bytes[$idx + $j] -ne $bad[$j]) { $match = $false; break }
        }
        if ($match) {
          $count++
          $idx += $bad.Length
          continue
        }
      }
      $idx++
    }
    if ($count -gt 0) {
      # Replace all occurrences in the byte array
      $newBytes = New-Object 'System.Collections.Generic.List[byte]'
      $i = 0
      while ($i -lt $bytes.Length) {
        if ($i + $bad.Length -le $bytes.Length) {
          $match = $true
          for ($j = 0; $j -lt $bad.Length; $j++) {
            if ($bytes[$i + $j] -ne $bad[$j]) { $match = $false; break }
          }
          if ($match) {
            $newBytes.AddRange($good)
            $i += $bad.Length
            continue
          }
        }
        $newBytes.Add($bytes[$i])
        $i++
      }
      $bytes = $newBytes.ToArray()
      $goodCode = if ($good.Length -gt 0) { ($good | ForEach-Object { $_.ToString("X2") }) -join " " } else { "" }
      $perMap += ("{0} -> {1}  x{2}" -f (($bad | ForEach-Object { $_.ToString("X2") }) -join " "), $goodCode, $count)
      $fileReplacements += $count
    }
  }

  if ($fileReplacements -gt 0) {
    [System.IO.File]::WriteAllBytes($f.FullName, $bytes)
    $totalReplacements += $fileReplacements
    $totalFilesTouched++
    $relPath = $f.FullName.Replace("C:/Users/Wesley/.minimax-agent/projects/qubic-aigarth-cloud/", "")
    $summary += [pscustomobject]@{
      File = $relPath
      Total = $fileReplacements
      Per = ($perMap -join " | ")
    }
  }
}

Write-Output ("=== Files touched: {0} | Total replacements: {1} ===" -f $totalFilesTouched, $totalReplacements)
Write-Output ""
foreach ($s in ($summary | Sort-Object -Property File)) {
  Write-Output ("  {0,-60}  {1,3}  {2}" -f $s.File, $s.Total, $s.Per)
}
