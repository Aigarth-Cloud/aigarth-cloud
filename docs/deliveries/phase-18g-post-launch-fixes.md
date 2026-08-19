# Phase 18G — Post-Launch Fixes

**Date:** 2026-08-04
**Author:** Principal Architect, Aigarth Cloud
**Status:** Done
**SP:** ~3 SP (90 min)

## What this phase delivered

Three of the four post-launch follow-ups (issues #1, #2, #4) from the
Phase 18E-18F delivery report. Issue #3 (video clips) was deferred per
user direction — that work will be re-scoped as a screen-recording demo
rather than AI-generated B-roll.

| # | Issue | Status | Tests |
|---|---|---|---|
| #1 | Slugify mismatch — tissue seed used `ann_sales_v1` while ANN service produces `ann-sales-v1` | **Fixed** — seed derives slug via the shared `slugify()` helper | 51/51 tissue |
| #2 | Silently-broken migration system — shared `drizzle.__drizzle_migrations` table caused services to skip their own migrations | **Fixed** — per-service `migrationsTable` in all 4 `migrate.ts` files, plus `migrationsSchema: "public"` so the bookkeeping lives next to the data | All 4 `pnpm db:migrate` runs now no-op cleanly |
| #4 | `decision_protocol` not exposed via API — integration test had to flip it via raw SQL | **Fixed** — `CreateAnnSchema` already accepted the field; only the integration test was out of date. Now uses the API path. | 11/11 integration |
| #3 | Video clips seg4/5/6 blocked on credits | **Deferred** — re-scope as screen recording per user direction | n/a |

## Active build time

- Reading + verifying the post-18F state: ~10 min
- #2 (finish migrate refactor): ~30 min
  - Discovered the real root cause (drizzle-orm's default `migrationsSchema` is `"drizzle"`, not `"public"`)
  - Patched all 4 `migrate.ts` to pass `migrationsTable` + `migrationsSchema`
  - Seeded per-service migration tables so existing DBs become idempotent
  - Re-applied the missing `billing_tissue_usage_events` table (shim was lost)
  - Verified all 4 services migrate cleanly
- #4 (decision_protocol via API): ~10 min
  - Discovered the schema already had the field (the summary was stale)
  - Updated integration test to use the API
  - Fixed a latent bug in the test's `skipSuite` early-return that always skipped
- #1 (slugify mismatch): ~5 min
  - Refactored tissue seed to derive slugs from human names via `slugify()`
  - Removed the `fix-demo-members.mjs` workaround
  - Re-flipped demo ANNs to trinary; verified end-to-end /decide
- Tier 4 cleanup: ~15 min
  - Moved 25+ debug scripts to `scripts/archived-migrations/scripts-archive/`
  - Kept 6 useful operator scripts in `tests/integration/scripts/` with a README
- **Total: ~70 minutes** (faster than the 90 estimate because the schema work for #4 was already done)

## SP velocity

~2.3 min/SP — at the high end of the "small focused fixes" band.

## #2 — Detailed writeup

### Root cause (refined)

The previous summary identified the shared `drizzle.__drizzle_migrations` table
as the root cause — service A's migrator sees service B's hashes and skips
its own. That was correct at a high level, but the fix was incomplete.
Reading `drizzle-orm@0.42.0`'s `pg-core/dialect.cjs` revealed three subtle
facts:

1. `migrationsTable` defaults to `"__drizzle_migrations"` (correct)
2. **`migrationsSchema` defaults to `"drizzle"`** — a separate Postgres
   schema! Without overriding it, the bookkeeping table lives outside
   `public` and is invisible to most ad-hoc queries.
3. **The "should I apply this migration?" check is purely time-based**:
   `Number(lastDbMigration.created_at) < migration.folderMillis`.
   The `hash` column is never compared — it's only stored for audit.

So the fix is:
- Set `migrationsTable: "{service}_migrations"` to namespace per service
- Set `migrationsSchema: "public"` to co-locate the bookkeeping with the data
- Wrap the `migrate()` call in `try/catch` and `process.exit(1)` on failure
  so silent skip → loud failure

### Files patched

| Service | `migrate.ts` | `drizzle.config.*` |
|---|---|---|
| ann | ✓ (per-service table + try/catch) | ✓ `migrationsTable: "ann_migrations"` |
| marketplace | ✓ | ✓ `migrationsTable: "marketplace_migrations"` |
| billing | ✓ (this session) | ✓ `migrationsTable: "billing_migrations"` |
| tissue | ✓ (this session) | ✓ `migrationsTable: "tissue_migrations"` (in `drizzle.config.json`) |

### Why the seeded `created_at` matters

drizzle-orm reads the LAST applied migration's `created_at` and skips any
journal entry with `folderMillis <= lastDbMigration.created_at`. So we seed
ONLY the most recent applied migration per service, with its journal `when`
as `created_at`. Re-running `pnpm db:migrate` is then a true no-op.

The seeder lives at `tests/integration/scripts/seed-migration-tables.cjs`
with a README explaining when to run it.

### Latent bug uncovered

The migration refactor exposed that the billing 18E shim was lost — the
`billing_tissue_usage_events` table never made it into the DB, but the
`billing_migrations` table I seeded marked 0001 as applied. The first
integration test run after the fix caught this (`relation does not exist`).
The fix: applied the SQL directly via `apply-billing-tissue-events.cjs`.

## #4 — Detailed writeup

### Discovery

Reading `services/ann/src/services/anns.ts:33-50` showed `CreateAnnSchema`
ALREADY has `decisionProtocol`, `trinaryPromptTemplate`, and `authorityWeight`
fields, all wired into `createAnn()` (line 147) and `updateAnn()` (line 187).
The summary's "TODO: add `decision_protocol` to CreateAnnSchema" was stale —
the field was added in 18B. The only outstanding work was to update the
integration test to use the API path.

### Test changes

- Removed the `"sets decision_protocol=trinary on each ANN"` test (which
  used raw SQL)
- Merged it into `"creates 3 ANNs (sales, risk, finance) with trinary
  protocol"` — the create call now passes `decisionProtocol: "trinary"`,
  `trinaryPromptTemplate: ...`, `authorityWeight: 0.5` via the API
- Added `expect(r.decision_protocol).toBe("trinary")` so a regression in
  the API → DB mapping is caught

### Latent bug uncovered

The original test had this:
```ts
beforeAll(async () => { health = await isStackUp(); ... }, 60_000);

describe("trinary intelligence", () => {
  const skipSuite = !health?.allUp;  // ❌ health is null here
  if (skipSuite) {
    it.skip(...);
    return;
  }
  ...
});
```

`skipSuite` was evaluated at describe-registration time, BEFORE `beforeAll`
ran. So `health` was always `null`, `health?.allUp` was `undefined`,
`!undefined` was `true`, and the suite ALWAYS skipped. The previous
"12/12 pass" in the summary must have been from a different state.

The fix: remove the early-return, and let the first test call `requireStack()`
which throws if the stack is down. The suite now fails loudly when the
stack is down (which is the right signal — integration tests SHOULD fail
without a stack). The user can run `pnpm test` (unit tests only) without
the stack, or `pnpm test:integration` with it.

## #1 — Detailed writeup

### Before

```ts
const DEMO_MEMBERS = [
  { ann_slug: "ann_sales_v1", ... },
  { ann_slug: "ann_risk_v1", ... },
  { ann_slug: "ann_finance_v1", ... },
];
```

The slug is hand-written with underscores. When the tissue calls
`/v1/anns/ann_sales_v1/decide` on the ANN service, the ANN service
slugifies it (underscores → hyphens) before the lookup, so the call
404s. The `fix-demo-members.mjs` workaround renamed the rows in
`tissue_members` to the hyphenated form, but a re-seed would re-break.

### After

```ts
const DEMO_MEMBERS = [
  { ann_name: "Ann Sales V1",   role: "voting", authority_weight: 0.4, position: 0 },
  { ann_name: "Ann Risk V1",    role: "veto",   authority_weight: 0.3, position: 1 },
  { ann_name: "Ann Finance V1", role: "voting", authority_weight: 0.3, position: 2 },
].map((m) => ({ ...m, ann_slug: slugify(m.ann_name) }));
```

Now `ann_slug` is derived from `ann_name` via the same `slugify()` helper
the ANN service uses. If the slugify rules change in the future, the tissue
seed picks up the new convention automatically. The re-seed is idempotent
and matches the ANN service.

### Verification

Live /decide on the demo tissue after the fix:

```
envelope: state=0 conf=0.7222 auth=0.5
contributors: 3 ignored: 0
policy: veto_aware
```

3 contributors (sales + risk + finance), 0 ignored, veto_aware policy
active. The demo is whole.

## Tier 4 cleanup

| Moved to `scripts/archived-migrations/scripts-archive/` | Count |
|---|---|
| Per-service `apply-pending.mjs`, `apply-18b-direct.mjs`, `apply-18e-shim.mjs` shims | 5 |
| Per-service `check-*.mjs` debug queries | 12 |
| Per-service `drop-*.mjs` reset scripts | 4 |
| Per-service `flip-to-trinary.mjs` one-off flip | 1 |
| `services/ann/test-migrate.mjs` + `test-migrate2.mjs` temp debug | 2 |
| Pre-Phase-18 `e2e.ts` + `reset-tables.ts` (superseded by `tests/integration/`) | 6 |
| `scripts/{smoke-anns,publish-anns,version-and-publish-anns,debug-publish}.ps1` one-offs | 4 |
| **Total** | **34** |

Kept in `tests/integration/scripts/` (with a README):
- `seed-migration-tables.cjs` — bootstrap per-service migrations tables
- `apply-billing-tissue-events.cjs` — re-apply the lost 18E billing shim
- `check-migration-state.cjs`, `check-billing-tables.cjs`, `check-demo-state.cjs` — operator queries
- `verify-demo-decide.cjs` — quick smoke test for the demo

Kept in `services/{ann,tissue}/scripts/clean.mjs`:
- Each service's cross-platform clean script (referenced in `package.json`)

## Test results (final)

```
@aigarth/trinary:test:                90/90 pass
@aigarth/ann:test:                    42/42 pass
@aigarth/gateway:test:                16/16 pass
@aigarth/tissue:test:                 51/51 pass
@aigarth/marketplace:test:            16/16 pass
@aigarth/billing:test:                 7/7  pass
@aigarth/integration-tests:test:      11/11 pass
pnpm typecheck:                       19/19 tasks
```

## Comparison to prior phases

| Phase | SP | Time | Min/SP |
|---|---|---|---|
| 18A | 5 | 120 min | 24 min/SP |
| 18B | 6 | 150 min | 25 min/SP |
| 18C | 3 | 60 min | 20 min/SP |
| 18D | 8 | 200 min | 25 min/SP |
| 18E-18F | 5 | 120 min | 24 min/SP |
| **18G (this)** | **3** | **70 min** | **23 min/SP** |

Roughly in line with the small-phase band. The cleanup work was the
largest time sink — useful but unrewarding.

## What's still open

- **#3** — Video clips seg4/5/6 (re-scoped to screen recording, deferred)
- **Real LLM invocation** in ANN service (replace hash stub) — natural next step
- **Ed25519 + Qubic-wallet signing** (replace HMAC-SHA-256)
- **Global `/v1/decisions`** endpoint for the internal dashboard (replace N+1 fan-out)
- **Per-grant cap enforcement** (already persisted, not enforced)
- **Per-state pricing** in marketplace
- **Phase 19** — not yet defined; logical candidates: real model integration, agent orchestration on tissues, multi-region tissue federation
