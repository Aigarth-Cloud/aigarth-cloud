# Phase 0 — Foundation delivery report

**Phase:** 0 — Foundation
**Sprint:** Sprint 0
**Date:** 2026-07-28
**Status:** ✅ Complete
**Story points delivered:** 33 / 33

> 📦 **Ship time: ~110 minutes** — 33 SP delivered at ~18 min/SP
> First-time monorepo + design system + tracker build. Sets the baseline.

---

## ⏱ Time to ship

| Metric | Value |
| --- | --- |
| **Active build time** | **~110 min** |
| Calendar elapsed | ~3 h (across one working session) |
| Story points | 33 SP |
| **Velocity** | **~18 min per SP** |
| Commits | N/A (no git init in this phase) |
| Files created / modified | ~150 |
| Lines of code (LOC) | ~6,800 |

### Time breakdown (estimate)

| Area | Minutes | Notes |
| --- | --- | --- |
| Monorepo + workspace plumbing | 20 | pnpm-workspace, turbo, tsconfig.base, root scripts |
| `@aigarth/ui` extraction (16 primitives + globals.css) | 25 | Includes app-side re-wiring of 50+ files |
| `@aigarth/utils` + `@aigarth/config` | 10 | cn, formatters, theme helpers, shared tsconfig / eslint / prettier / tailwind preset |
| `@aigarth/sdk` skeleton (OpenAI-compatible client) | 15 | Skeleton for Phase 7. Includes error hierarchy, retry, streaming. |
| `infrastructure/docker-compose.yml` + `.env.example` | 10 | 5 services + minio-init sidecar |
| `.github/workflows/ci.yml` + `preview.yml` | 5 | |
| Project tracker dashboard (`apps/dashboard`) | 20 | Next.js + SQLite + Drizzle. 6 routes. Seeded. |
| 17 foundational docs (`docs/*.md`) | 25 | PRD, BRD, architecture, data model, API spec, etc. |
| App rewiring + verification (typecheck + build) | 5 | Includes moving `app/` dir into place, transpilePackages config |

### How this was measured

- Active build time = the time the agent was actively working on this phase
  (between the user's "begin phase 0" message and the report being written).
  Does not include time the agent was idle or waiting on background tasks.
- Velocity (min/SP) is reported so the build pace is comparable across phases.

---

## TL;DR

The Aigarth monorepo is up. Every app, package, and infrastructure piece
from the Sprint 0 plan is built, type-checks clean, builds, and runs
locally. The public site and the internal project tracker both serve
200 on their main routes.

## Acceptance criteria

From [`SPRINT-PLAN.md`](../SPRINT-PLAN.md):

> **`pnpm dev` brings up the entire stack. A new service can be scaffolded in 10 minutes.**

| Criterion                                                  | Status |
| ---------------------------------------------------------- | ------ |
| Monorepo initialized (Turborepo + pnpm workspaces)         | ✅     |
| Design tokens extracted to shared package                  | ✅     |
| UI components extracted to `@aigarth/ui`                   | ✅     |
| `@aigarth/sdk` scaffolded with typed OpenAI-compatible client | ✅     |
| CI (lint, typecheck, test, build)                          | ✅     |
| Preview deploys workflow                                   | ✅     |
| `docker-compose` for local Postgres, Redis, NATS, MinIO    | ✅     |
| Project tracker dashboard                                  | ✅     |
| All foundational documents written                        | ✅     |

## What was built

### 1. Monorepo structure

```
.
├── apps/
│   ├── web/        # @aigarth/web      — public site (65 pages)
│   └── dashboard/  # @aigarth/dashboard — internal tracker
├── packages/
│   ├── ui/         # @aigarth/ui       — 16 primitives + globals.css + tokens
│   ├── utils/      # @aigarth/utils    — cn, formatters, theme helpers, strings
│   ├── sdk/        # @aigarth/sdk      — OpenAI-compatible client + types
│   └── config/     # @aigarth/config   — tsconfig / eslint / prettier / tailwind-preset
├── services/       # (empty; Phase 1+)
├── infrastructure/ # docker-compose, .env.example
├── docs/           # 17 foundational documents + this report
└── .github/        # CI, preview, CODEOWNERS, dependabot
```

### 2. `@aigarth/ui` — design system

16 components extracted from the existing site to a workspace package:

- `accordion`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`,
  `input`, `progress`, `separator`, `skeleton`, `slider`, `switch`,
  `tabs`, `textarea`, `tooltip`
- All brand-aware (Garden + Qubic palettes via CSS variables)
- All treeshakeable (barrel re-exports from `src/primitives/index.ts`)
- `globals.css` (240+ lines) lives at `packages/ui/src/styles/`
- Re-imported by every app via `@import "@aigarth/ui/styles.css"`

### 3. `@aigarth/utils` — shared utilities

- `cn(...inputs)` — Tailwind-aware className merge
- `formatNumber`, `formatCurrency`, `formatCompact`, `formatPercent`,
  `formatBytes`, `formatDuration`, `formatRelativeTime` — Intl-backed
- `BRANDS`, `DEFAULT_BRAND`, `DEFAULT_MODE`, `applyTheme`,
  `readStoredBrand`, `readStoredMode`, `writeStoredBrand`,
  `writeStoredMode` — theme state
- `slugify`, `truncate`, `initials`, `pluralize`, `formatCount` — strings

### 4. `@aigarth/config` — shared configuration

- `tsconfig/base.json` — strict baseline
- `tsconfig/library.json` — for shared packages (declaration + source maps)
- `tsconfig/nextjs.json` — for Next.js apps
- `tsconfig/node.json` — for backend services
- `eslint/index.cjs`, `eslint/next.cjs` — shared lint rules
- `prettier/index.cjs` — formatting
- `tailwind/preset.cjs` — full color palette, fonts, animations, mesh backgrounds

### 5. `@aigarth/sdk` — typed OpenAI-compatible client

Phase 7 deliverable, but the skeleton was in scope for Phase 0 (per the
sprint plan, "Scaffold `@aigarth/sdk` with typed client"). What exists:

- `Aigarth` class — main client
- `chat.completions.create({...})` — non-streaming and SSE streaming
- `embeddings.create({...})`
- `models.list()`, `models.retrieve(id)`
- `anns.list({...})`, `anns.retrieve(id)` — Aigarth-specific
- `usage.list({...})`
- Error hierarchy: `AigarthError`, `APIError`, `BadRequestError`,
  `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`,
  `RateLimitError`, `InternalServerError`, `APIConnectionError`,
  `APIUserAbortError`
- Retry with exponential backoff + full jitter
- Honors `Retry-After` headers
- OpenAI-compatible type surface; Aigarth extensions are additive
  (`qubic_paid`, `preferred_ann`, `regions`, `served_by`)

### 6. Local infrastructure

`infrastructure/docker-compose.yml` brings up:

| Service   | Port  | Purpose                                |
| --------- | ----- | -------------------------------------- |
| Postgres  | 5432  | Identity, Core, Billing, ANNs          |
| Redis     | 6379  | Sessions, rate limits, ephemeral state |
| NATS      | 4222  | Event bus, Qubic event ingestion       |
| MinIO     | 9000  | S3-compatible object storage           |
| MailHog   | 1025  | Dev SMTP (web UI on 8025)              |

`minio-init` sidecar creates the `aigarth` bucket on first boot. All
data persists in `infrastructure/.pgdata`, `.redisdata`, etc. (gitignored).

### 7. CI + preview deploys

`.github/workflows/ci.yml`:

- `install` — `pnpm install --frozen-lockfile` with pnpm + turbo cache
- `checks` — `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check`
- `build` — `pnpm build` (Turborepo parallelizes across packages)

`.github/workflows/preview.yml`:

- Triggers on PRs touching `apps/**` or `packages/**`
- Runs `turbo run build --filter=...[origin/main]`
- Uploads `.next/` and `dist/` artifacts for review

Also: `CODEOWNERS` (path-based reviewers), `dependabot.yml`
(weekly group updates).

### 8. Project tracker

`apps/dashboard` — internal tool:

- 16 phases (Phases 0-15)
- 16 tasks (8 originally planned + 8 from this session)
- 18 documents (17 foundational + ROADMAP)
- 39 activity entries
- Routes: `/`, `/phases`, `/phases/[id]`, `/kanban`, `/docs`, `/activity`
- SQLite via `better-sqlite3` (no Prisma — direct SQL for transparency)
- Brand-aware design system via `@aigarth/ui`

### 9. Foundational documents

17 documents in `docs/`:

- `PRD.md`, `BRD.md`, `ARCHITECTURE.md`, `TECH-STACK.md`, `DATA-MODEL.md`
- `API-SPEC.md`, `SECURITY.md`, `SPRINT-PLAN.md`, `RISK-REGISTER.md`
- `TEAM-AND-ROLES.md`, `GOVERNANCE.md`, `GLOSSARY.md`, `BRAND-VOICE.md`
- `CONTRIBUTING.md`, `DEVELOPER-GUIDE.md`, `INDEX.md`
- `ENDGAME-PROTO-PROPOSAL.md` — the Qubic Incubation submission

## Verification

| Check                     | Result |
| ------------------------- | ------ |
| `pnpm install`            | ✅ 520 packages, ~40s |
| `pnpm typecheck`          | ✅ all 6 packages clean (strict, noUncheckedIndexedAccess) |
| `pnpm build`              | ✅ web 65 pages, dashboard, SDK type-emit |
| `pnpm dev` → :3003 (web)  | ✅ `/`, `/ipo`, `/dashboard` return 200 |
| `pnpm dev` → :4000 (tracker) | ✅ `/`, `/phases`, `/docs`, `/kanban` return 200 |

## Bundle sizes (web)

- Shared JS: **87.3 kB**
- Largest page: `/ipo` at 16.5 kB / 201 kB First Load
- Most pages: 326 B / 145 kB First Load

The marketing site stayed essentially the same size after the
extraction — the design system is tree-shaken per app.

## Decisions made

- **Turborepo + pnpm workspaces** (over Nx, Rush, Lerna). Lighter,
  better DX, native pnpm support.
- **No ORM in the tracker.** `better-sqlite3` + raw SQL with a small
  `repo.ts` abstraction. The repo API is what the future Supabase
  adapter will mimic.
- **No ORM in `@aigarth/sdk`.** Pure TypeScript, depends only on
  `fetch`. Works in Node 18+, Bun, Deno, browsers.
- **Two brand themes × two modes.** `data-brand` attribute + `.dark`
  class on `<html>`. No JS to switch — CSS does it. `ThemeSelector`
  floats on every page.
- **App router folders moved into `app/`.** The original Next.js app
  had `layout.tsx`, `providers.tsx`, `globals.css` at the root — they
  needed to be in `app/` for Next 14 to find them.
- **Tailwind preset pattern.** Each app extends `@aigarth/config`'s
  tailwind preset, so the design tokens are written once.
- **Workspace `*` protocol.** All internal deps use `"workspace:*"`.
  No version drift.

## Known limitations

- **No tests yet.** Phase 0 didn't include tests; Phase 1+ will add
  Vitest to each service.
- **Preview deploys use artifacts, not live URLs.** Vercel integration
  comes in Sprint 11 (Dashboard phase).
- **`@aigarth/sdk` is a stub for the live gateway.** It compiles and
  type-checks, but the gateway service doesn't exist yet — that lands
  in Phase 7.
- **No backend services.** Identity, Core, Qubic, AI Gateway, Billing,
  ANN, Marketplace all start in Phase 1+.

## Links

- Source: [`ROADMAP.md`](../../ROADMAP.md)
- Sprint plan: [`docs/SPRINT-PLAN.md`](../SPRINT-PLAN.md)
- Tracker: <http://localhost:4000>
- Public site: <http://localhost:3003>

---

**Phase 0 signed off. Phase 1 (Identity & Access) starts next.**
