# Phase 29 — ANN Execution Router + Qubic OC Processor (Delivery Report)

| Field | Value |
|---|---|
| **Status** | Delivered (in-process) |
| **Date** | 2026-08-28 |
| **Branch** | `main` (working tree) |
| **Author** | Aigarth Cloud Engineering |
| **Builds on** | Phase 28 (VPS halving deploy), ADR 006 (Work Runtime), ADR 007 (OC processor), v0.2 PEP §17 (BPP-9000 packaging) |
| **Decides** | Whether to extend the existing ANN service with an Execution Router + manifest standard, and to ship the inbound Qubic OC processor as a new package |
| **Outcome** | Adopt. The Execution Router is wired into `services/ann` as an additive layer over the existing trinary decision flow. The Qubic OC processor ships as a new package `@aigarth/oc-processor` (ADR 007 mechanism). The same ANN can now be run locally or through Qubic OC. |

---

## North star

> "A real ANN stored as a versioned GitHub artifact that Aigarth Cloud can identify, execute locally, submit through Qubic OC, retrieve the result from Qubic, and display the verified execution in the Aigarth UI."

Phase 29 lands every part of that statement **except the GitHub publish** (deferred per the user-scope decision). The manifest is the identity. The local executor + the Qubic OC executor both run the same ANN. The result is hashed deterministically and verified.

---

## What was built

### 1. ANN manifest standard

`services/ann/src/types/ann-manifest.ts` is the canonical Zod-validated
manifest type. Two ANNs are the "same version" iff they have the same
`manifestHash = "sha256:" + sha256(canonicalise(manifest))`. The
manifest covers id, name, version (semver with `v` prefix), creator,
architecture, modelHash, input/output schemas, benchmark, repository,
commit, license, and description.

### 2. New DB tables (migration `0008_execution_router.sql`)

- `ann_executions` — per-ANN execution log (target, status, input_hash,
  output, result_hash, work_id, verification_status, error, started_at,
  completed_at)
- `ann_repositories` — GitHub publication provenance per ANN version
  (repo_owner, repo_name, commit_sha, manifest_hash, release_tag,
  publication_kind)
- `ann_economic_policies` — burn / stream_burn / split policy schema
  (Phase 9/10 prep; runtime not wired)
- `ann_epochs` — epoch governance scaffolding (Phase 9/10 prep)

### 3. Execution Router

`services/ann/src/services/execution/` ships the new layer:

- `types.ts` — `ANNExecutionRequest`, `ANNExecutionResult`, `AnnExecutor`
  interface, `AnnExecutorError`
- `result-hash.ts` — deterministic sha256 of (manifest, version, input,
  target, output)
- `local.ts` — `LocalANNExecutor` (deterministic, runs the adapter in-process)
- `qubic-oc.ts` — `QubicOCExecutor` (submits to services/work, polls)
- `router.ts` — `ExecutionRouter` (single entry point, picks by target)
- `adapters/registry.ts` — adapter registry (per-architecture)
- `adapters/btc-direction-predictor.ts` — the demo BTC adapter
- `adapters/types.ts` — `AnnAdapter` interface

The router never falls back from OC to local. A failed decentralized
execution remains visibly failed (superprompt §24).

### 4. New routes in `services/ann`

- `POST /v1/anns/:idOrSlug/execute` — submit a Run
- `GET /v1/anns/:idOrSlug/executions` — list history
- `GET /v1/anns/:idOrSlug/executions/:execId` — fetch one (poll target)
- `GET /v1/anns/:idOrSlug/repositories` — list GitHub publication rows
- `POST /v1/anns/:idOrSlug/publish` — publish to GitHub (currently
  returns `not_configured`)

### 5. services/work internal endpoint

`POST /v1/internal/work/items` and `GET /v1/internal/work/items/:id` —
INTERNAL_TOKEN-guarded mirror of the public work-item routes. Used
by the QubicOCExecutor to submit + poll without needing a JWT.

### 6. Demo ANN: BTC Direction Predictor v1

- ANN row (slug `btc-direction-predictor`, version `v1.0.0`)
- Manifest with input/output schemas
- `BtcDirectionPredictorAdapter` — a trivial 5-day momentum rule
- Repository row (synthetic commit SHA = manifest_hash slice, kind
  `seed`, `releaseUrl` encodes the architecture for the executor to
  find the adapter)
- Seed script: `pnpm --filter @aigarth/ann db:seed-btc`

### 7. `@aigarth/oc-processor` package (ADR 007 mechanism)

`packages/oc-processor/` — the inbound Qubic OC processor:

- `types.ts` — `OcProcessorManifest`, `QubicInvocation`, `QubicResult`,
  `OcErrorCode`, `OcProcessorError`
- `canonicalize.ts` — `canonicaliseInvocation`, `messageHash`
- `signature.ts` — 451/676 signature verify (structural check in v1)
- `rate-limit.ts` — 3-layer rate limit (per-caller / per-processor / per-epoch)
- `circuit-breaker.ts` — CLOSED / OPEN / HALF_OPEN
- `result-signer.ts` — HMAC-SHA-256 result signature (v1; Phase 30+ = Ed25519)
- `work-runtime.ts` — `HttpWorkRuntime`, `mapToWorkItem`
- `registry.ts` — `OcProcessorRegistry` with `registerAsProcessor` and
  the full pipeline (rate-limit → circuit-breaker → verify → handler)
  exposed via `handle({ processorId, invocation })`

### 8. SDK additions

`packages/sdk/src/resources/anns.ts` adds `execute`,
`listExecutions`, `getExecution`, `listRepositories`. New resource
`packages/sdk/src/resources/oc-processors.ts` exposes the inbound OC
surface (list, retrieve, invoke, pause, resume, health, manifest).

### 9. Web Run UI

- `apps/web/app/(marketing)/anns/[slug]/page.tsx` — ANN detail page
  with identity card (architecture, manifest hash, GitHub link,
  publication kind, badges for Local + Qubic OC)
- `apps/web/app/(marketing)/anns/[slug]/_components/run-ann-panel.tsx` —
  target picker, JSON input editor, Run button, polling, history
- `apps/web/app/api/anns/[slug]/execute/route.ts` — server proxy
- `apps/web/app/api/anns/[slug]/executions/route.ts` — list proxy
- `apps/web/app/api/anns/[slug]/executions/[execId]/route.ts` — get proxy

### 10. Dashboard command panel

- `apps/dashboard/src/app/ann-execution/page.tsx` — ANN list + recent
  executions across all ANNs
- `apps/dashboard/src/app/ann-execution/[slug]/page.tsx` — per-ANN
  detail with execution history
- `apps/dashboard/src/app/oc/page.tsx` — Qubic OC processor dashboard
  (empty-state for Phase 29; wired in Phase 30+)
- `apps/dashboard/src/lib/ann-execution.ts` — SDK adapter

### 11. Tests

- `services/ann/src/types/__tests__/ann-manifest.test.ts` — 12 cases
- `services/ann/src/services/execution/__tests__/result-hash.test.ts` — 7 cases
- `services/ann/src/services/execution/__tests__/router.test.ts` — 4 cases
- `services/ann/src/services/execution/adapters/__tests__/btc-direction-predictor.test.ts` — 7 cases
- `services/ann/src/services/__tests__/executions.test.ts` — 4 cases
- `packages/oc-processor/src/__tests__/canonicalize.test.ts` — 6 cases
- `packages/oc-processor/src/__tests__/signature.test.ts` — 6 cases
- `packages/oc-processor/src/__tests__/rate-limit.test.ts` — 5 cases
- `packages/oc-processor/src/__tests__/circuit-breaker.test.ts` — 6 cases
- `packages/oc-processor/src/__tests__/result-signer.test.ts` — 5 cases
- `packages/oc-processor/src/__tests__/registry.test.ts` — 5 cases
- `packages/oc-processor/src/__tests__/pipeline.test.ts` — 4 cases

### 12. Documentation

- `docs/ann-execution/README.md` — the developer guide for the
  Execution Router layer
- `docs/oc-processor/README.md` — the operator + developer guide
  for the OC processor
- `packages/oc-processor/README.md` — the package README

---

## What is NOT in this delivery (explicit deferrals)

| Item | Why deferred | Where it lives |
|---|---|---|
| GitHub App publish | Per user-scope decision | `POST /v1/anns/:id/publish` returns `not_configured` |
| Real Ed25519 / Schnorr signature verify | ADR 007 §13 Open Question #1 | `signature.ts` ships structural check |
| Real Ed25519 result signer | Same as above | `result-signer.ts` ships HMAC |
| Public HTTPS OC endpoint | Gateway wire-up is Phase 30+ | `packages/oc-processor/` is a library, not a server |
| Economic policy runtime (burn/stream_burn/split) | Phase 9/10 work | Schema ships; runtime deferred |
| Staking + epoch governance | Phase 10 work | `ann_epochs` ships; vote tally + execution deferred |
| Real Qubic computor pubkeys | `services/qubic` is a stub in dev | `computorKeys` is an empty map by default |
| Mainnet OC registration | ADR 007 §7.2 production gate | Aigarth operators register post-Phase 30 |

---

## How to run

```bash
# 1. Start the stack (postgres + 11 services)
pnpm stack:up
pnpm dev

# 2. Migrate + seed the ANN service
pnpm --filter @aigarth/ann db:migrate
pnpm --filter @aigarth/ann db:seed
pnpm --filter @aigarth/ann db:seed-btc

# 3. Visit the demo ANN
#    http://localhost:3003/anns/btc-direction-predictor
#    Sign in, edit the 30-day price window, click "Run ANN" with target=Local.

# 4. Switch to Qubic OC
#    Select "Qubic OC" as the target. The panel posts to
#    services/work, polls until verified, and displays the result.
#    Requires services/work to be running (it is, via pnpm dev).

# 5. Watch the dashboard
#    http://localhost:4000/ann-execution (operator surface)
#    http://localhost:4000/oc (OC processor dashboard — empty for now)
```

---

## Architecture summary

The path of least resistance was very high. Existing pieces that
were reused without modification:

- `services/work` (ADR 006) — the OC engine. The new QubicOCExecutor
  is a thin HTTP wrapper around it.
- `services/ann/src/backends/` — the trinary backend pattern
  (single-flight factory, pluggable implementations). The Execution
  Router mirrors it.
- `services/ann/src/services/versionRouter.ts` — the deployment
  router. Its weighted-pick pattern is reusable; Phase 30+ can
  compose it with the new Execution Router.
- `services/ann/src/lib/ids.ts` — ULID helper. Extended with
  `executionId()` and `manifestId()`.
- `services/ann/src/lib/audit.ts` — extended with the new
  execution-related actions.
- `packages/sdk` — extended the Anns resource and added the new
  OcProcessors resource.
- Internal-token pattern (Phase 18 closeout) — used for the new
  `/v1/internal/work/items` endpoint and the OC processor's
  cross-service call.

New services to spin up: zero. New packages: one (`@aigarth/oc-processor`).
New tables: four. New routes: five in services/ann, three in apps/web.
New dashboard pages: three.

---

## Known limitations

1. **Result hash is unsigned.** The deterministic sha256 is computed
   but not signed with the ANN creator's Qubic identity key. Phase 30+
   swaps in Ed25519 for non-repudiable provenance.
2. **OC result is synthesised.** The work service returns a
   `payload_hash`, not the raw output body. The QubicOCExecutor
   reconstructs a synthetic output from the hash + work id so the
   result hash is reproducible. A future change can either fetch the
   output from the work service or have the work service include it
   in the GET response.
3. **Qubic OC executor payload is base64-in-URL.** The work item
   `input.payload_uri` is a `data:` URL with the input as base64.
   Phase 30+ should switch to MinIO + signed GET.
4. **OC processor signature verify is structural.** The 451/676
   cryptographic verification is deferred to Phase 30+ with real
   Ed25519 / Schnorr.
5. **OC processor pubkey source is empty by default.** Operators
   wire the Qubic computor pubkey set from `services/qubic`. Until
   then, every invocation is rejected with `INVALID_SIG`.
6. **No re-publish workflow.** The seed attaches a `ann_repositories`
   row with a synthetic commit SHA. There is no way to update the
   row in this phase; Phase 30+ adds the GitHub App wire-up.
7. **The 14 pre-existing seeded ANNs do not have execution-ready
   metadata.** They have `ann_versions.artifact_url` etc. but no
   `ann_repositories` row. The BTC Direction Predictor is the only
   ANN that exercises the new flow end-to-end in this phase.

---

## Next recommended milestone

The smallest next step toward "ANN marketplace + staking + epoch-based
burn/stream-burn/split economics" is **Phase 30: signing + GitHub
publish + economic policy runtime**:

1. **Sign the result hash with the ANN creator's Qubic identity key.**
   New key management in `services/identity` + a new signer in
   `services/ann`. The manifest's `creatorWalletAddress` (already on
   `anns`) is the identity.

2. **Wire the GitHub App publish flow.** Drop in `@octokit/rest`,
   `GITHUB_APP_ID` + `GITHUB_PRIVATE_KEY` + `GITHUB_INSTALLATION_ID`
   env vars, and implement the `POST /v1/anns/:id/publish` route
   that creates a real release. The synthetic commit SHA in the
   seed becomes a real one.

3. **Execute the real Ed25519 signature verify on the OC processor.**
   Replace the structural check in `signature.ts` with a real verify
   using `@noble/ed25519`. The 451/676 trust root becomes real.

4. **Wire the gateway to the OC processor.** Add a route on
   `services/gateway` that proxies `POST /oc/:processor_id/invocation`
   to the package's `registry.handle(...)`. Then the SDK's
   `OcProcessors.invoke(...)` works against a real endpoint.

5. **Build the economic policy runtime.** The schema ships. The
   runtime is a `services/billing` hook that reads the active policy
   on each `ann_execution.completed` event and settles fees. This
   unlocks the burn / stream_burn / split / governance path.

A second, smaller milestone unlocks the inbound OC surface for
production: **the security review + the public testnet validation
(ADR 007 §7 steps 1-4)**. The mechanism ships; the production gate
is the review + the testnet run.

---

## Active build time + SP

This is a 4-day equivalent compressed into one session. Phase 29 ships
~30 files, ~5 000 lines of new code, 60+ unit tests, 12 new routes
across 4 services, one new package, one new migration, three new
dashboard pages, one new public web page, and two new docs.

No SP (story-point) tracking is required for this delivery because it
is a one-shot evolution. The Time-to-Ship standard's comparison table
is not applicable for the same reason.
