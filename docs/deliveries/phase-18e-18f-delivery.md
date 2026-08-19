# Phase 18E + 18F — Productization & Launch delivery report

**Phases:** 18E (Productization) + 18F (Docs + Launch)
**Sprint:** Fifth + sixth of the 6-phase Trinary Intelligence Layer (18A–18F)
**Date:** 2026-08-04
**Author:** Principal Architect, Aigarth Cloud
**Builds on:** [Phase 18A](./phase-18a-trinary-core-delivery.md), [Phase 18B](./phase-18b-trinary-ann-integration-delivery.md), [Phase 18C](./phase-18c-trinary-gateway-delivery.md), [Phase 18D](./phase-18d-tissue-service-delivery.md), [ADR 003](../architecture-decisions/003-trinary-protocol-v1.md)

---

## TL;DR

The runtime is now a product. The Trinary Intelligence Layer ships end-to-end:

- **Marketplace** sells per-decision access to tissues (new listing type)
- **Billing** meters tissue usage as a first-class product
- **Tissue service** enforces per-tissue access control and emits billing events
- **SDK** exposes the new surfaces (`client.tissues`, `client.marketplace.tissueListings`)
- **Studio** lets non-engineers compose and call tissues
- **Internal dashboard** surfaces the most recent decisions for ops/audit
- **Docs, blog, tweet thread, and video** round it out for launch

The Trinary Intelligence Layer is **live in dev and staging**.

---

## What shipped

### 18E — Productization

**1. Marketplace: tissue listings**
- New `mkt_tissue_listings` table with `mkt_tissue_access` enum (`open` | `licensed`)
- New service `services/marketplace/src/services/tissueListings.ts` (list, create, update, close, recordDecision)
- New routes `services/marketplace/src/routes/tissueListings.ts` (6 endpoints)
- Internal `POST /v1/tissue-listings/:id/decisions` for the tissue service to increment counters (token-gated)

**2. Billing: tissue usage events**
- New `billing_tissue_usage_events` append-only log
- New service `services/billing/src/services/tissueUsage.ts` (record, aggregate by user / period / tissue / state)
- New internal `POST /v1/internal/tissue-usage` (token-gated)
- `GET /v1/billing/usage` now includes `tissue` block (total, by_tissue, by_state)
- `buildPreview()` invoice math now includes `overageTissueQubic`
- `generateInvoice()` adds an `overage_tissue` line item with per-tissue breakdown

**3. Tissue service: licensing + access control + hooks**
- New `tissue_licenses` table with per-grantee, per-tissue grants (time-bounded, cap-bound, revocable)
- New `tissue_access` enum (`open` | `licensed`) + `access` column on `tissues`
- New service `services/tissue/src/services/licenses.ts` (`grantLicense`, `revokeLicense`, `listLicenses`, `checkAccess`)
- New service `services/tissue/src/services/billingHook.ts` (`reportTissueUsage`, `reportMarketplaceDecision`) — best-effort, non-blocking
- `decideTissue()` updated: access check before fanout, billing + marketplace hooks after success
- New `TissueAccessDeniedError` error class (403 / 404)
- New routes `services/tissue/src/routes/licenses.ts` (3 endpoints)

**4. SDK: Tissues resource**
- New `packages/sdk/src/types/tissue.ts` (Tissue, TissueMember, TissueLicense, TissueDecision, ConsensusPolicy)
- New `packages/sdk/src/types/tissueListing.ts` (TissueListing, ListTissueListingsResponse)
- New `packages/sdk/src/resources/tissues.ts` (12 methods: list, retrieve, create, update, publish, pause, addMember, removeMember, decide, listDecisions, listLicenses, grantLicense, revokeLicense)
- New `client.tissues` on the Aigarth client
- `client.marketplace.tissueListings` block added (5 methods: list, retrieve, create, update, close)
- New `tissue` service URL + port 7008 default

**5. Studio (apps/web)**
- New page `apps/web/app/dashboard/tissues/page.tsx` (list + summary)
- New client component `apps/web/app/dashboard/tissues/client.tsx` (create form + add-member form + publish)
- `apps/web/lib/server/aigarth.ts` updated with the tissue service URL
- 5/4/2 inputs: name, tagline, description, policy + threshold, access, visibility, with member role/weight

**6. Internal dashboard (apps/dashboard)**
- New page `apps/dashboard/src/app/tissues/page.tsx`
- New lib `apps/dashboard/src/lib/tissues.ts` (loadAllTissues, loadRecentTissueDecisions — async wrappers)
- New component `apps/dashboard/src/components/pages/tissues.tsx` (TissuesHistoryView: 2 tables, summary stats)

### 18F — Docs + Launch

- `docs/launches/phase-18-trinary-launch.md` — launch summary (TL;DR, what's new, why it matters, what's not)
- `docs/guides/trinary-intelligence.md` — full user guide (8 sections: create, call, policies, open vs licensed, monetize, audit, gateway, design decisions)
- `docs/blog/2026-08-04-trinary-intelligence-launch.md` — long-form launch post
- `docs/blog/2026-08-04-trinary-intelligence-tweet-thread.md` — 12-tweet launch thread (X-ready)
- `docs/INDEX.md` — added "Launches" + "Video walkthroughs" sections; added user-guide link
- `docs/PRD.md` — added "5.4 For tissue builders" + linked trinary docs
- `docs/video/trinary-intelligence-walkthrough.md` — companion doc for the video tutorial (architecture, narration, source)

### Cross-cutting fixes

- **zod 3.25 → 3.23.8 pin** as a root `pnpm.overrides` (latent issue from 18D; the marketplace + billing services re-exposed it on first test run; root-level pin eliminates the class of bug)
- **vitest wired into marketplace + billing** (both had no tests before 18E; now 16 + 7 = 23 new tests)
- **Internal-token gates** (`MARKETPLACE_INTERNAL_TOKEN`, `BILLING_INTERNAL_TOKEN`) for service-to-service calls
- **Cross-service service URLs** added to billing + tissue configs (`ANN_SERVICE_URL`, `TISSUE_SERVICE_URL`, `MARKETPLACE_SERVICE_URL`)

## File map

```
docs/launches/phase-18-trinary-launch.md              ← NEW
docs/guides/trinary-intelligence.md                   ← NEW
docs/blog/2026-08-04-trinary-intelligence-launch.md   ← NEW
docs/blog/2026-08-04-trinary-intelligence-tweet-thread.md ← NEW
docs/video/trinary-intelligence-walkthrough.md         ← NEW (companion to video)
docs/INDEX.md                                         ← UPDATED
docs/PRD.md                                           ← UPDATED

services/marketplace/
├── src/db/schema.ts                                  ← UPDATED (mkt_tissue_listings, mkt_tissue_access)
├── drizzle/0002_tissue_listings.sql                  ← NEW
├── drizzle/meta/_journal.json                        ← UPDATED
├── src/services/tissueListings.ts                    ← NEW
├── src/lib/serialize.ts                              ← UPDATED (serializeTissueListing)
├── src/routes/tissueListings.ts                      ← NEW
├── src/config/index.ts                               ← UPDATED (MARKETPLACE_INTERNAL_TOKEN)
├── src/server.ts                                     ← UPDATED (register tissueListingRoutes)
├── .env.example                                      ← UPDATED
├── src/tests/tissueListings.test.ts                  ← NEW (16 tests)
├── package.json                                      ← UPDATED (zod ~3.23.8, vitest)
└── vitest.config.ts                                  ← NEW

services/billing/
├── src/db/schema.ts                                  ← UPDATED (tissue_usage_events)
├── drizzle/0001_tissue_usage_events.sql              ← NEW
├── drizzle/meta/_journal.json                        ← UPDATED
├── src/services/tissueUsage.ts                       ← NEW
├── src/services/invoices.ts                          ← UPDATED (overage_tissue line item)
├── src/routes/billing.ts                             ← UPDATED (tissue block in /usage)
├── src/routes/tissueUsage.ts                         ← NEW
├── src/config/index.ts                               ← UPDATED (BILLING_INTERNAL_TOKEN, tissue/ann URLs)
├── src/server.ts                                     ← UPDATED (register tissueUsageRoutes)
├── .env.example                                      ← UPDATED
├── src/tests/tissueUsage.test.ts                     ← NEW (7 tests)
├── package.json                                      ← UPDATED (zod ~3.23.8, vitest)
└── vitest.config.ts                                  ← NEW

services/tissue/
├── src/db/schema.ts                                  ← UPDATED (tissue_licenses, tissue_access enum, access column)
├── drizzle/0001_tissue_licensing.sql                 ← NEW
├── drizzle/meta/_journal.json                        ← UPDATED
├── src/services/licenses.ts                          ← NEW
├── src/services/billingHook.ts                       ← NEW
├── src/services/decisions.ts                         ← UPDATED (access check + billing/marketplace hooks)
├── src/lib/serialize.ts                              ← UPDATED (serializeTissueLicense, access in serializeTissue)
├── src/routes/licenses.ts                            ← NEW
├── src/config/index.ts                               ← UPDATED (MARKETPLACE/BILLING URLs + tokens)
├── src/server.ts                                     ← UPDATED (register licenseRoutes)
├── .env.example                                      ← UPDATED
├── src/tests/licenses.test.ts                        ← NEW (7 tests)
└── (existing tests untouched: 44 tests still pass)

packages/sdk/
├── src/types/tissue.ts                               ← NEW
├── src/types/tissueListing.ts                        ← NEW
├── src/resources/tissues.ts                          ← NEW
├── src/resources/marketplace.ts                      ← UPDATED (tissueListings block)
├── src/resources/index.ts                            ← UPDATED (Tissues export)
├── src/types/index.ts                                ← UPDATED (re-export new types)
└── src/client.ts                                     ← UPDATED (tissues field, tissue service URL)

apps/web/
├── app/dashboard/tissues/page.tsx                    ← NEW
├── app/dashboard/tissues/client.tsx                  ← NEW
└── lib/server/aigarth.ts                             ← UPDATED (tissue service URL)

apps/dashboard/
├── src/app/tissues/page.tsx                          ← NEW
├── src/lib/tissues.ts                                ← NEW
└── src/components/pages/tissues.tsx                  ← NEW

package.json                                          ← UPDATED (pnpm.overrides zod ~3.23.8)
```

## Test coverage

| Service / Package        | Tests | Delta from 18D | Status |
|--------------------------|-------|----------------|--------|
| `@aigarth/trinary`       | 90    | 0              | green  |
| `@aigarth/ann`           | 42    | 0              | green  |
| `@aigarth/gateway`       | 16    | 0              | green  |
| `@aigarth/tissue`        | 51    | +7 (licenses)  | green  |
| `@aigarth/marketplace`   | 16    | +16 (NEW)      | green  |
| `@aigarth/billing`       | 7     | +7 (NEW)       | green  |
| **Total**                | **222** | **+30**      | **all green** |

## Build + typecheck

- `pnpm typecheck` — 18/18 tasks successful across the monorepo
- `pnpm --filter @aigarth/sdk build` — emits `dist/` with the new Tissues resource

## Verification commands

```bash
pnpm typecheck                                        # 18/18 green
pnpm --filter @aigarth/trinary test                  # 90/90 pass
pnpm --filter @aigarth/ann test                      # 42/42 pass
pnpm --filter @aigarth/gateway test                  # 16/16 pass
pnpm --filter @aigarth/tissue test                   # 51/51 pass
pnpm --filter @aigarth/marketplace test              # 16/16 pass
pnpm --filter @aigarth/billing test                  #  7/7  pass
pnpm --filter @aigarth/sdk build                     # dist/ emitted
```

## Active build time

Approximately 90 minutes from a clean state, including:

- 4 schema migrations written by hand (no `drizzle-kit generate` needed for the small additions)
- 6 new service files
- 3 new route files
- 2 new SDK resource + 2 new type files
- 2 new page + 1 new lib + 1 new component (apps)
- 4 new test files
- 5 new docs / blog / launch files
- 1 zod pin + 1 root `pnpm.overrides`

## SP velocity

| Phase | SP | Min | Min/SP |
|-------|----|-----|--------|
| 18A   | 5  | 110 | 22     |
| 18B   | 4  | 95  | 24     |
| 18C   | 3  | 70  | 23     |
| 18D   | 5  | 120 | 24     |
| 18E   | 4  | 90  | 23     |
| 18F   | 1  | 30  | 30     |
| **Total 18A-18F** | **20** | **~515** | **~26** |

(18F is docs-only, so the per-SP ratio is misleadingly high. The "real" 18E number — 4 SP for the entire productization surface — matches the prior phases at ~23-24 min/SP.)

## What didn't make it (deferred to v2)

- **Ed25519 + Qubic-wallet signing.** HMAC-SHA-256 with a single per-service env-var key for v1. Per-ANN / per-tissue keys tied to Qubic wallets with on-chain revocation is the v2 plan.
- **Real LLM invocation in the ANN service.** The trinary /decide path still uses a deterministic hash-based stub for envelope generation. Real model invocation is the next major work item.
- **Global /v1/decisions endpoint.** The dashboard fans out per-tissue (N+1 requests) for the decision history. v2 will add an indexed cross-tissue decision log.
- **Per-grant cap enforcement** on `tissue_licenses.max_decisions`. Persisted but not enforced.
- **Per-state pricing** in marketplace listings. v1 charges the same fee for `+1`, `0`, `-1` (intentional — no perverse incentive). v2 will add per-state pricing for callers who want it.
- **Cross-tissue replay tool** in the Studio. Replay currently lives in the decision history table. v2 will add a UI for "what would this tissue have said with this input last week."

## What to look at first

- [Launch doc](../launches/phase-18-trinary-launch.md) — short summary
- [User guide](../guides/trinary-intelligence.md) — full working guide
- [Video walkthrough companion](../video/trinary-intelligence-walkthrough.md) — visual + script
- [Launch blog post](../blog/2026-08-04-trinary-intelligence-launch.md) — long-form
- [Tweet thread](../blog/2026-08-04-trinary-intelligence-tweet-thread.md) — X / Twitter ready
- [ADR 003](../architecture-decisions/003-trinary-protocol-v1.md) — protocol spec

## See also

- [Phase 18A delivery report](./phase-18a-trinary-core-delivery.md)
- [Phase 18B delivery report](./phase-18b-trinary-ann-integration-delivery.md)
- [Phase 18C delivery report](./phase-18c-trinary-gateway-delivery.md)
- [Phase 18D delivery report](./phase-18d-tissue-service-delivery.md)
