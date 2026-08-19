# Updates imports in apps/web and apps/dashboard to use workspace packages.
# Run from the project root.

$ErrorActionPreference = 'Stop'

$targets = @(
    "C:\Users\Wesley\.minimax-agent\projects\qubic-aigarth-cloud\apps\web",
    "C:\Users\Wesley\.minimax-agent\projects\qubic-aigarth-cloud\apps\dashboard"
)

foreach ($base in $targets) {
    Write-Host "Processing $base ..." -ForegroundColor Cyan
    Get-ChildItem -Path $base -Recurse -Include "*.tsx","*.ts" -Force | Where-Object {
        $_.FullName -notmatch "\\node_modules\\" -and
        $_.FullName -notmatch "\\.next\\" -and
        $_.FullName -notmatch "\\dist\\"
    } | ForEach-Object {
        $path = $_.FullName
        $content = Get-Content -Path $path -Raw

        $original = $content

        # Path-alias imports: @/components/ui/...  ->  @aigarth/ui
        $content = $content -replace 'from\s+"@/components/ui/[^"]+"', 'from "@aigarth/ui"'
        $content = $content -replace 'from\s+''@/components/ui/[^'']+''', "from '@aigarth/ui'"

        # Path-alias imports: @/lib/utils           ->  @aigarth/utils
        $content = $content -replace 'from\s+"@/lib/utils"', 'from "@aigarth/utils"'
        $content = $content -replace 'from\s+''@/lib/utils''', "from '@aigarth/utils'"

        # Relative imports: ../ui/...  /  ../../ui/...  /  ../../../ui/...
        $content = [regex]::Replace($content, 'from\s+"(\.\.\/)+ui\/[^"]+"', 'from "@aigarth/ui"')
        $content = [regex]::Replace($content, "from\s+'(\.\.\/)+ui\/[^']+'", "from '@aigarth/ui'")

        # Relative imports: ../lib/utils  /  ../../lib/utils
        $content = [regex]::Replace($content, 'from\s+"(\.\.\/)+lib\/utils"', 'from "@aigarth/utils"')
        $content = [regex]::Replace($content, "from\s+'(\.\.\/)+lib\/utils'", "from '@aigarth/utils'")

        if ($content -ne $original) {
            Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8
            Write-Host "  updated: $($_.Name)"
        }
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
