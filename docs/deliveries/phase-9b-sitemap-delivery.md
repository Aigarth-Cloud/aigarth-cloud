# Phase 9b — Visual Sitemap delivery report

**Phase:** 9b — Visual sitemap graph on the tracker dashboard
**Sprint:** Follow-up to Phase 9, single sitting
**Date:** 2026-07-31

---

## What shipped

A live, pan/zoomable graph of every page in `apps/web`, rendered as a
"living neural network" on the tracker dashboard at **`/sitemap`**.

- **Source of truth** — `apps/dashboard/src/lib/sitemap.ts` walks
  `apps/web/app/**/{page,route}.{tsx,ts}` and parses every `<Link href>`
  + `href: "/foo"` reference in pages and the marketing/dashboard nav
  components. No AST parser — regex over source, fast and good enough.
- **Layout** — group clusters (marketing / dashboard / auth / api) sit on
  a circle (radius 700) around the origin. Pages within each cluster
  scatter via concentric rings + jitter. Deterministic via a mulberry32
  PRNG seeded at 42 so the layout is stable across server restarts.
- **Canvas** — `sitemap-canvas.tsx` uses **ReactFlow v12**
  (`@xyflow/react`) with:
  - custom `pageNode` (glowing circle, group color, label)
  - custom `neuralEdge` (curved bezier, width = edge weight, animated
    particles on weight ≥ 2)
  - group-hub overlays (dashed rotating ring per group)
  - pan/zoom controls + minimap + dark gradient background with grid
  - 1-hop hover highlighting
  - group filter chips + search input
  - right-side panel with selected node + connected edges + jump-to-file
- **Nav link** — added a `Sitemap` entry to `tracker-nav.tsx` with the
  `Network` icon from lucide.

## Final graph

- **71 nodes** across 4 groups: marketing 41, dashboard 22, api 6, auth 2
- **192 edges** (1 implicit `/` per page, plus every parsed `<Link>`)
- Top hubs: `/`, `/dashboard`, `/about`, `/dashboard/api-keys`,
  `/dashboard/usage`

## Bug fixes landed in this pass

1. **`groupForRoute` was off-by-one** on Windows. The function
   documented `parts[0]` as the route group but compared against
   `parts[1]`. With `path.relative` on Windows returning paths without
   a leading `app/`, the check always fell through to `marketing`. Fixed
   by reading `parts[0]` and handling the `app/page.tsx` (head = `"page.tsx"`)
   case explicitly. The `root` group was vestigial since the home page
   lives in `app/(marketing)/page.tsx`; collapsed into `marketing`.
2. **`node:fs` leaking into the client bundle.** The canvas (a "use
   client" component) imported `toReactFlow` from `@/lib/sitemap`, which
   also had `import fs from "node:fs"`. Webpack rejected the bundle
   with `UnhandledSchemeError`. Refactored the lib into three files:
   - `lib/sitemap-types.ts` — pure types (client-safe)
   - `lib/sitemap-layout.ts` — `layout()` + `toReactFlow()` (client-safe)
   - `lib/sitemap.ts` — `buildSitemap()` (server-only, uses `fs`/`path`),
     re-exports types + `toReactFlow` for backward compat
3. **Dead `rng` helper** removed from `sitemap.ts` after layout moved
   out.

## ⏱ Time-to-Ship

| Step | Time | Notes |
| --- | --- | --- |
| Confirm nav link missing | ~5 min | 1-line check |
| Add nav link | ~1 min | 1 import, 1 NAV entry |
| Diagnose off-by-one in `groupForRoute` | ~10 min | tsx debug script + tracing |
| Fix group classification | ~2 min | head check |
| Diagnose `node:fs` webpack error | ~5 min | log + module trace |
| Refactor lib into 3 files | ~10 min | split types / layout / build |
| Verify page renders 200 | ~2 min | curl + content checks |
| **Total** | **~35 min** | **~5 SP** (mostly the bug hunts) |

**SP velocity:** ~7 min/SP. The 3-file split is a reusable pattern
(client-safe `*-types.ts` + `*-layout.ts`, server-only `*.ts`) for any
future canvas/diagram that needs filesystem-backed data.

## Verification

- `GET http://localhost:4000/sitemap` → 200, 45 KB HTML
- HTML contains: `Sitemap`, `Marketing`, `Auth`, `Dashboard`, `API`
  group labels, the ReactFlow bundle, the right-side panel scaffold.
- Nav on the dashboard home (`/`) shows the new **Sitemap** link with
  the Network icon.
- `apps/web` files referenced by every page (66 marketing, 23
  dashboard, 6 API, 2 auth) all parse without errors.

## Files touched

| File | Change |
| --- | --- |
| `apps/dashboard/src/components/tracker-nav.tsx` | + `Network` icon, + `Sitemap` nav entry |
| `apps/dashboard/src/lib/sitemap.ts` | `groupForRoute` fix; `buildSitemap` re-exports types + `toReactFlow` |
| `apps/dashboard/src/lib/sitemap-types.ts` | **new** — pure types (client-safe) |
| `apps/dashboard/src/lib/sitemap-layout.ts` | **new** — `layout` + `toReactFlow` (client-safe) |
| `apps/dashboard/src/components/pages/sitemap-canvas.tsx` | imports moved to client-safe files |

## Open items (carry-forward)

- **TCP Qubic client** (services/qubic) — needs real Qubic node access.
- **K12 signature verification** for Qubic wallet linking — format-only today.
- Sitemap currently doesn't include API route handlers in the visual
  edges (they only appear as nodes, with no `<Link>` from pages since
  API routes aren't navigated to from the browser). Could be expanded
  later by parsing the `app/api/**/route.ts` files for `Request → handler`
  relationships.
