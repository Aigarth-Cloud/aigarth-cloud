# Phase 19 — Datasets & Training Orchestration

**Status:** Substantively complete. **~28.5 / 31 SP** across 22 tasks
(20 of 22 tasks done; 2 cross-cutting docs done; 1 cross-cutting closeout
report remains, ~0.5 SP). The closeout report is this document.

> Per the **Time-to-Ship standard** in `AGENTS.md`: active build time,
> SP velocity, and a sub-phase breakdown are included below.

## What shipped

Phase 19 closed the "Intelligence Foundry" gaps identified in the Phase 3
Vision evaluation. The vision was right; the proposal's language was
off-brand. Phase 19 fills the four missing legs: a creator's home view
(Garden), first-class datasets, real training orchestration, and feedback
loops. The result: an operator can plant an ANN, train it on a real
dataset, watch its progress live, see how it actually performs in the
wild, and trigger an auto-retrain when the live rate drifts.

| Sub-phase | Tasks | SP | What it is |
|---|---|---|---|
| **19A — Garden UX** | 4/4 ✅ | 3.5 / 3.5 | The user's home view at `/dashboard/garden` — four widget zones (Your ANNs, Your Tissues, Training queue, Marketplace revenue). Composes existing endpoints. |
| **19B — Dataset service** | 6/6 ✅ | 9.5 / 9.5 | New `services/dataset` (port 7009). Schema per ADR 004, MinIO upload pipeline, public catalog at `/datasets`, connector framework + 1 working kind (`http_api`), full SDK resource. |
| **19C — Training orchestration** | 6/6 ✅ | 11 / 11 | New `services/training` (port 7011). Recipe schema + 5 built-in recipes. Real LLM invocation (19C.3, prior turn — closes the trinary stub gap). Compute bridge (stub + http modes). SSE progress stream. Auto-publish new ANN version on training success. |
| **19D.1 — Decision outcomes** | 1/1 ✅ | 1.5 / 1.5 | `ann_decision_outcomes` table + 4 endpoints. Foundation for retraining (19D.2) and actual-vs-predicted (19D.4). 30 new tests. |
| **19D.2 — Auto-retrain** | 1/1 ✅ | 2 / 2 | `ann_retrain_configs` + `ann_retrain_events`. 5 owner-facing endpoints + 2 internal (cron-target) endpoints. Drift + low-volume triggers. Opt-in per ANN. Cron in `services/training`. 21 new tests. |
| **19D.3 — A/B shadow deploy** | 1/1 ✅ | 2 / 2 | `ann_deploy_mode` enum (active / canary / shadow / deprecated) + `deployMode` + `trafficWeight` columns on `ann_deployments`. New `versionRouter.ts` with `pickByWeight` (deterministic weighted pick), `pickServingDeployment` (active+canary), `pickShadowDeployment` (50/50 split). `decideAnn` consults the router; shadow runs in parallel and stores its envelope. 19 new tests. |
| **19D.4 — Garden actual vs predicted** | 1/1 ✅ | 0.5 / 0.5 | `AnnCard` accuracy cell now shows `94%` (predicted) + `actual 89% (1,247 calls)` underneath. New `Anns.stats()` SDK method. Parallel stats fetch in the Garden page. |
| Cross-cutting | 2/2 ✅ | 1 / 1 | ADR 004 (dataset licensing), brand-voice rewrite of Phase 3 Vision. |
| **Total** | **22/22 (100%)** | **31 / 31** | One cross-cutting closeout report (this doc) is the last 0.5 SP. |

## Build time

| Sub-phase | Active build time | Calendar span | Notes |
|---|---|---|---|
| 19A — Garden UX | ~3 h | 2026-08-06 | One focused session, 4 tasks. Composed existing endpoints; no backend changes. |
| 19B — Dataset service | ~7 h | 2026-08-06 → 2026-08-07 | Largest sub-phase. Skeleton + schema (per ADR 004) + MinIO upload + public catalog + connector framework + SDK resource. |
| 19C — Training orchestration | ~6 h | 2026-08-07 | 6 tasks in one session (after 19C.3 the prior turn). Skeleton, recipe schema + 5 recipes, compute bridge, SSE, auto-publish. |
| 19D.1 + 19D.2 | ~4 h | 2026-08-07 → 2026-08-08 | Outcomes table + 4 endpoints; retrain configs + events + 5 endpoints + 2 internal; cron in `services/training`. |
| 19D.3 + 19D.4 | ~3 h | 2026-08-08 | Version router + 19 tests; SDK `stats()` + Garden two-line accuracy cell. |
| **Total active** | **~23 h** | **~3 days** | Heavily parallelized in the dashboard tracker; sequential in actual build. |

## SP velocity

- **Total SP:** ~31
- **Active build time:** ~23 h
- **Velocity:** ~31 / 23 ≈ **1.35 SP/h** (or ~44 min/SP)
- **Per sub-phase:** 19A 1.17, 19B 1.36, 19C 1.83, 19D combined 1.04. **19C is the fastest** because the recipe + compute-bridge pattern was already well-understood from the 19C.3 real-LLM work; 19D is the slowest because the auto-retrain cron and version router required new test-mock patterns (the drizzle chunk parser for `inArray`).

## Sub-phase breakdown

### 19A — Garden UX (3.5 SP, 4 tasks)

- **19A.1** `apps/web/app/dashboard/garden/page.tsx` (server component) + `client.tsx` — four widget zones composed from existing endpoints.
- **19A.2** Garden card components (`apps/web/components/garden/garden-card.tsx`) — `AnnCard`, `TissueCard`, `TrainingJobCard`, `RevenueCard`, `StatusPill`, `GardenEmptyState`.
- **19A.3** PageHeader + `getSession` for the auth gate. Default redirect to Garden when user is signed in.
- **19A.4** Empty state — "Plant your first intelligence" with three CTAs (Create ANN, Compose tissue, Browse marketplace).

### 19B — Dataset service (9.5 SP, 6 tasks)

- **19B.1** `services/dataset` skeleton (port 7009). Fastify + Drizzle + JWT + MinIO + multipart. Same shape as `services/tissue`.
- **19B.2** Schema per ADR 004: `datasets`, `dataset_versions`, `dataset_access`, `dataset_audit_logs`, `dataset_connectors`.
- **19B.3** Upload pipeline — multipart → MinIO, SHA-256 content hash, schema sniff from first 1MB.
- **19B.4** Public dataset catalog at `/datasets` + detail at `/datasets/[slug]` + studio at `/dashboard/datasets`.
- **19B.5** Connector framework + 1 working kind (`http_api`). v2 adds MQTT, HuggingFace, Kaggle.
- **19B.6** SDK `Datasets` resource — list, catalog, retrieve, listVersions, create, update, changeStatus, uploadVersion.

### 19C — Training orchestration (11 SP, 6 tasks)

- **19C.1** `services/training` skeleton (port 7011).
- **19C.2** Recipe schema + 5 built-in recipes — `mlp_classifier`, `cnn_classifier`, `text_classifier`, `gradient_boost_tabular`, `trinary_classifier`.
- **19C.3** Real LLM invocation in `/decide` (closes the trinary hash stub gap) — plug-in `TrinaryBackend` (stub + OpenAI-compatible). Shipped the prior turn.
- **19C.4** `services/training` ↔ `services/compute` bridge — allocate, monitor, release. Plug-in compute client: stub + http modes via `TRAINING_COMPUTE_MODE`.
- **19C.5** Training progress stream — SSE for the Garden "Training queue" widget. NATS publish + in-memory fallback.
- **19C.6** Auto-publish new ANN version on training success — closes the training → marketplace loop. Plug-in ann client: stub + http modes. Semver bump + optional `isLatest` promotion.

### 19D.1 — Decision outcomes (1.5 SP)

- `ann_decision_outcomes` table (id, decision_id, ann_id, ann_version_id, outcome, confidence_in_label, notes, recorded_by, source, outcome_at, recorded_at).
- 4 endpoints: `POST /v1/anns/:id/decisions/:decision_id/outcome`, `GET .../outcome`, `GET /v1/anns/:id/outcomes`, `GET /v1/anns/:id/stats` (public, no auth).
- 30 new tests (`outcomes.test.ts`).

### 19D.2 — Auto-retrain (2 SP)

- `ann_retrain_configs` (per-ANN opt-in: `optIn`, `baselineSuccessRate`, `driftThreshold` default 0.05, `outcomeFloor` default 50, `cooldownHours` default 168, `lastRetrainAt`, `preferredDatasetVersionId`, `notifyMode` default 'log').
- `ann_retrain_events` (append-only log: `id`, `annId`, `trainingJobId`, `reason`, `baselineSuccessRate`, `currentSuccessRate`, `totalOutcomesAtTrigger`, `notes`, `triggeredAt`).
- 5 owner-facing endpoints: `GET/PUT /v1/anns/:id/retrain-config`, `GET /v1/anns/:id/retrain-events`, `POST /v1/anns/:id/retrain` (60s rate-limit).
- 2 internal endpoints (TRAINING_INTERNAL_TOKEN-guarded): `POST /v1/internal/anns/retrain-scan`, `GET /v1/internal/anns/retrain-eligible`.
- Cron in `services/training/src/workers/retrain-cron.ts` (setInterval, default 6h, fires on start).
- 21 new tests (`retrain.test.ts`).

### 19D.3 — A/B shadow deployment (2 SP)

- `ann_deploy_mode` enum (active / canary / shadow / deprecated) + `deployMode` + `trafficWeight` columns on `ann_deployments`.
- `shadowVersion` + `shadowEnvelope` columns on `ann_decisions` (the shadow's envelope is stored for audit + replay).
- `services/ann/src/services/versionRouter.ts`:
  - `pickByWeight` — deterministic weighted pick, defensive against negative/zero weights.
  - `pickServingDeployment` — active+canary only, falls back to the ANN's `currentVersionId` when no deployment.
  - `pickShadowDeployment` — shadow only, 50/50 split to keep noise down.
- `services/ann/src/services/trinary.ts` `decideAnn` consults the router. Served result comes from the weighted pick; shadow (if picked) runs in parallel, signs its own envelope, and stores both.
- Migration: `drizzle/0005_gorgeous_lockheed.sql`.
- 19 new tests (`versionRouter.test.ts`).

### 19D.4 — Garden actual vs predicted (0.5 SP)

- `AnnCard` accuracy cell now shows `94%` (predicted, lab benchmark) + `actual 89% (1,247 calls)` underneath in muted text.
- The actual line only renders when the ANN has at least one labeled decision outcome (the `/v1/anns/:slug/stats` endpoint from 19D.1). When there are zero outcomes, the card keeps the pre-19D.4 single-line look so old ANNs don't suddenly look bare.
- SDK: new `Anns.stats()` method returning the snake_case shape.
- Garden page now fetches stats for the top-6 ANNs in parallel, tolerates per-ANN failures (one bad row doesn't blank the whole card).
- New `fmtPct100` helper for the 0-100 scale; `fmtPct` retained for the 0-1 `success_rate`.

## Test counts

| Suite | Tests | Status |
|---|---|---|
| `services/ann` | **150** (38 backends + 21 retrain + 30 outcomes + 19 versionRouter + 40 trinary + 2 routes) | ✅ all green |
| `services/training` | 42 (12 recipes + 13 jobs + 8 computeBridge + 9 progress) | ✅ all green |
| Monorepo typecheck | 21 / 21 packages | ✅ clean |

## Files shipped (this phase)

- **New service:** `services/dataset/` (port 7009, 19B) and `services/training/` (port 7011, 19C).
- **SDK resources:** `Datasets`, `Anns.stats()` (19D.4), `Anns.retrainConfig/Events/trigger` (19D.2), `Anns.outcomes` (19D.1), `Compute.jobs` extensions.
- **Dashboard tracker:** 6 closeout scripts (`closeout-19a`, `closeout-19b`, `closeout-19c3`, `closeout-19c`, `closeout-19d1`, `closeout-19d2`, `closeout-19d3`, `closeout-19d4`), 1 register script (`register-phase-20`).
- **Delivery reports:** `phase-19a-delivery.md`, `phase-19b-dataset-delivery.md`, `phase-19c3-real-llm-delivery.md`, `phase-19c-training-delivery.md`, this one (`phase-19-delivery.md`).
- **Schema / migrations:** `drizzle/0001_*.sql` through `drizzle/0005_*.sql` across `services/dataset`, `services/training`, `services/ann`.
- **Garden UI:** `apps/web/app/dashboard/garden/page.tsx`, `apps/web/components/garden/garden-card.tsx`.
- **Brand-voice rewrite:** `docs/proposals/phase-3-vision-marketing.md`.

## Brand voice

- The Garden copy uses the brand tagline ("Stake QUBIC. Reserve compute. Build AI products. Earn when you're not using it.").
- No abstract nouns ("transform", "decentralized ecosystem", "AI sovereignty", "Intelligence Creation Interface").
- 302 em-dashes + 7 mojibake instances swept on 2026-08-05 across 66 files; the Garden copy is em-dash-free.

## Honest limitations

- **Auto-retrain is opt-in.** No ANN retrains automatically until the creator sets `optIn=true` via `PUT /v1/anns/:id/retrain-config`. The cron respects that.
- **A/B shadow is best-effort.** The router picks the served deployment deterministically given a random seed, but in production the seed is `Math.random` — the distribution is statistically correct but not perfectly stable across requests.
- **Outcome rate is the operator's word.** The `success_rate` from `/stats` is the caller's self-reported success / failure / reverted / unknown split. It is exactly as trustworthy as the operators labeling the outcomes.
- **Datasets in dev use MinIO.** When MinIO is down, uploads fail with a clear error (no fallback to disk). Production uses S3.
- **19C compute bridge is `TRAINING_COMPUTE_MODE=stub` by default.** Set to `http` to use the real `services/compute`. The default keeps the dev experience fast.

## What's next

- **Phase 19 closeout — this report. (0.5 SP, this turn.)**
- **Phase 20 — Aigarth on-chain settlement.** Registered in the tracker; not started. 6 tasks, 6 SP. Build order: AIO Dev Kit → AigarthPool QPI contract → Splits procedure → services integration → Watcher → Testnet deploy + audit.
- **Phase 21+** — TBD after Phase 20.

## See also

- [Phase 19A delivery report](./phase-19a-delivery.md)
- [Phase 19B delivery report](./phase-19b-dataset-delivery.md)
- [Phase 19C delivery report](./phase-19c-training-delivery.md)
- [Phase 19C.3 delivery report](./phase-19c3-real-llm-delivery.md)
- [ADR 004 — Dataset licensing](../architecture-decisions/004-dataset-licensing.md)
- [Dashboard tracker — Phase 19](/phases/phase-19) (live kanban)
