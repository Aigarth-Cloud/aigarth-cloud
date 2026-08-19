# `@aigarth/utils`

Shared utilities — no React, no DOM, no fetch. Safe to use in any package or service.

## Exports

- `cn(...inputs)` — Tailwind-aware className merge (uses `clsx` + `tailwind-merge`)
- `formatNumber`, `formatCurrency`, `formatCompact`, `formatPercent`, `formatBytes`, `formatDuration`, `formatRelativeTime` — Intl-backed formatters
- `BRANDS`, `DEFAULT_BRAND`, `DEFAULT_MODE`, `isBrandId`, `isModeId`, `applyTheme`, `readStoredBrand`, `readStoredMode`, `writeStoredBrand`, `writeStoredMode` — theme helpers
- `slugify`, `truncate`, `initials`, `pluralize`, `formatCount` — string utilities

## Usage

```ts
import { cn, formatCurrency, BRANDS } from "@aigarth/utils";

const className = cn("px-4 py-2", isActive && "bg-primary");
const price = formatCurrency(42000); // "$42,000"
const swatch = BRANDS.find((b) => b.id === "qubic")?.swatches.dark.from;
```
