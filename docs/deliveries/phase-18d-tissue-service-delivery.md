# Phase 18D — Tissue Service delivery report

**Phase:** 18D — Trinary Intelligence Protocol v1 (Tissue runtime)
**Sprint:** Fourth of the 6-phase Trinary Intelligence Layer (18A–18F)
**Date:** 2026-08-04
**Builds on:** [Phase 18A](./phase-18a-trinary-core-delivery.md), [Phase 18B](./phase-18b-trinary-ann-integration-delivery.md), [Phase 18C](./phase-18c-trinary-gateway-delivery.md), [ADR 003](../architecture-decisions/003-trinary-protocol-v1.md)

---

## What shipped

A new `services/tissue` service on port **7008** that turns the `@aigarth/trinary` consensus algebra into a working runtime. The first real *Intelligent Tissue* — the thing the original proposal was actually about.

A tissue is a named composition of ANNs with a consensus policy. When you call `POST /v1/tissues/:slug/decide`, the service:

1. Loads the tissue + its active members
2. Calls each member's ANN service `/decide` endpoint **in parallel** (with a per-call timeout)
3. Combines the resulting `IntentEnvelope`s via the configured consensus policy (`weighted_majority` / `veto_aware` / `unanimous` / `short_circuit`)
4. Signs a tissue-level envelope with `TISSUE_SIGNING_KEY` and persists it to the append-only `tissue_decisions` log
5. Returns the combined decision with full contributor / ignored detail

The tissue-level envelope is **indistinguishable from an ANN's output** to downstream consumers — same `IntentEnvelope` shape, same signature scheme, same zod schema. A consumer that understands the trinary protocol can't tell whether a decision came from a single ANN or a 5-ANN tissue. That's the point.

## The first real Intelligent Tissue

The seed ships the **Sales + Risk + Finance** example from the original proposal:

```
tissue_executive_v1  (veto_aware { threshold: 0.4 })
  ├─ ann_sales_v1     voting   authority 0.4
  ├─ ann_risk_v1      veto     authority 0.3   ← any -1 blocks the whole tissue
  └─ ann_finance_v1   voting   authority 0.3
```

Behavior:
- All three say +1 → +1 (proceed)
- Sales=+1, Finance=+1, Risk=anything-but-(-1) → +1
- Risk=-1, anything else → -1 (block) — veto fired
- One or more ANNs fail / time out / don't exist → marked `ignored`, decision continues

The seed assumes those three ANNs exist in the ANN service. If they don't, the tissue still gets created; the missing members are reported as `ignored` on the first `/decide` call.

## File map

```
services/tissue/                            ← NEW
├── drizzle/
│   ├── 0000_tissue_init.sql                (new: tissues, tissue_members, tissue_decisions, tissue_audit_logs)
│   └── meta/_journal.json                  (new: drizzle migration journal)
├── src/
│   ├── config/index.ts                     (new: env + signing key + timeouts)
│   ├── db/
│   │   ├── schema.ts                       (new: 4 tables, 3 enums, indexes, types)
│   │   ├── index.ts                        (new: drizzle + pg pool)
│   │   ├── migrate.ts                      (new)
│   │   └── seed.ts                         (new: Sales+Risk+Finance fixture)
│   ├── lib/
│   │   ├── ids.ts                          (new: uid, slugify, slugSuffix)
│   │   ├── auth.ts                         (new: extractJwt)
│   │   ├── audit.ts                        (new: logActivity, auditAction enum)
│   │   ├── db-types.ts                     (new: loose Database alias)
│   │   └── serialize.ts                    (new: tissue / member / decision serializers)
│   ├── services/
│   │   ├── annClient.ts                    (new: callAnnDecide, buildAnnInput, URL builder, AbortController-based timeout)
│   │   ├── tissues.ts                      (new: CRUD + member management + 5 error classes)
│   │   └── decisions.ts                    (new: the main /decide flow + listDecisions + consensus application helpers)
│   ├── routes/
│   │   ├── tissues.ts                      (new: /v1/tissues + /members)
│   │   ├── decisions.ts                    (new: /decide + /decisions)
│   │   └── health.ts                       (new: /healthz)
│   ├── tests/
│   │   ├── annClient.test.ts               (new: 9 tests)
│   │   ├── consensus-application.test.ts   (new: 7 tests)
│   │   ├── tissues.test.ts                 (new: 19 tests)
│   │   └── decisions.test.ts               (new: 9 tests)
│   ├── server.ts                           (new: Fastify bootstrap with helmet/cors/jwt/cookie)
│   ├── index.ts                            (new: start())
│   └── ...
├── scripts/clean.mjs                       (new: cross-platform)
├── vitest.config.ts                        (new)
├── tsconfig.json
├── package.json
└── .env.example

packages/trinary/                          ← UPDATED
├── src/
│   ├── consensus.ts                        (added: ConsensusPolicySchema zod discriminated union)
│   ├── index.ts                            (re-export)
│   └── tests/consensus.test.ts             (added: 5 tests for the schema)
```

## Verification

```bash
$ pnpm --filter @aigarth/tissue typecheck
> tsc --noEmit
# (clean)

$ pnpm --filter @aigarth/tissue build
> tsc
# (clean)

$ pnpm --filter @aigarth/tissue test
 Test Files  4 passed (4)
      Tests  44 passed (44)
   Duration  13.58s

$ pnpm --filter @aigarth/trinary test
 Test Files  7 passed (7)
      Tests  90 passed (90)        # up from 85 — added 5 ConsensusPolicySchema tests

$ pnpm --filter @aigarth/ann test
# 42/42 still pass

$ pnpm --filter @aigarth/gateway test
# 16/16 still pass
```

## What the runtime looks like

### POST /v1/tissues/:slug/decide

```bash
curl -X POST http://localhost:7008/v1/tissues/tissue_executive_v1/decide \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "lead_L42",
    "input": { "lead_id": "L42", "amount": 50000, "region": "EU" }
  }'
```

```jsonc
// 201 Created
{
  "decision_id": "dec_abc",
  "envelope": {
    "schema_version": 1,
    "ann_id": "<tissue uuid>",            // ← tissue's id
    "ann_version": "1.0.0",               // ← tissue's version
    "state": 1,                           // ← combined: +1 (all three proceeded)
    "confidence": 0.87,                   // ← authority-weighted average
    "authority": 0.7,                     // ← max of contributors
    "reasoning": "Tissue Executive Tissue (tissue_executive_v1@1.0.0, veto_aware): ann_sales_v1@1.0.0 state=1 ...; ann_risk_v1@1.0.0 state=0 ...; ann_finance_v1@1.0.0 state=1 ...",
    "recommended_action": "proceed",
    "supporting_signals": [...],
    "required_future_signals": [],
    "reversibility": "soft",
    "time_horizon": "session",
    "signature": "<HMAC-SHA-256 hex>",
    "issued_at": "2026-08-04T..."
  },
  "contributors": [
    { "ann_slug": "ann_sales_v1", "ann_id": "...", "ann_version": "1.0.0", "state": 1, "confidence": 0.92, "authority": 0.5, "signature": "...", "decision_id": "dec_x", "latency_ms": 124, "role": "voting" },
    { "ann_slug": "ann_risk_v1",  "ann_id": "...", "ann_version": "1.0.0", "state": 0, "confidence": 0.81, "authority": 0.7, "signature": "...", "decision_id": "dec_y", "latency_ms":  98, "role": "veto"   },
    { "ann_slug": "ann_finance_v1", ... }
  ],
  "ignored": [],
  "tissue": { "id": "...", "slug": "tissue_executive_v1", "name": "Executive Tissue", "version": "1.0.0" },
  "total_latency_ms": 167,
  "policy": "veto_aware"
}
```

If `ann_risk_v1` returns -1, the same call returns `state: -1` and the envelope's `reasoning` is prefixed with `Blocked by veto from ann_risk_v1@1.0.0:` — exactly what the `combine()` function emits.

## Decisions landed

1. **Tissue-level envelope uses the tissue's identity.** `ann_id = tissue.id`, `ann_version = tissue.version`. This makes the tissue's output indistinguishable from an ANN's output to downstream consumers. No special "tissue envelope" type — same zod schema, same signature scheme, same wire format. Future code that handles ANN decisions works on tissue decisions for free.
2. **Authority = max of contributors.** Not the sum, not the mean. The most conservative number that a consumer can trust. Documented as v1; v2 may switch to a tissue-operator-set `authority_weight` on the tissue table.
3. **Reversibility and time_horizon take the most conservative value across contributors.** "irreversible" beats "soft" beats "advisory"; "persistent" beats "session" beats "immediate". This matches the safety intuition: if any member thinks an action is irreversible, the tissue-level decision is irreversible.
4. **Veto fires on `state: -1` only, regardless of confidence or authority.** A veto-role member saying "I'm not sure" (state=0) doesn't fire the veto. A veto-role member saying "block" (state=-1) does. This matches the original proposal: "any -1 from Risk blocks."
5. **Per-call timeout on the ANN client, never a hard failure.** A single slow or broken ANN member doesn't tank the whole decision. It's recorded as `ignored` with a reason (`timed out after 5000ms`, `404 Not Found`, `network: ECONNREFUSED`, etc.) and the decision continues with the rest. Only when *every* member fails do we return 502.
6. **Policy is stored as JSONB with a denormalized `policy_kind` text column.** The denormalized column lets us index and filter (`?policy_kind=veto_aware`) without `jsonb` ops. The JSONB is the source of truth.
7. **`Authority` on the tissue envelope comes from the contributors, not from the tissue row.** We don't store `authority_weight` on the tissue table. This keeps the tissue row minimal and means a tissue's identity (its policy + its members) fully determines its behavior. v2 may add `authority_weight` if operators want to override the contributor-derived value.
8. **Decision log is append-only.** Cascade-delete on tissue hard-delete only. No application code updates or deletes rows. This is the audit + replay surface.
9. **Single env-var signing key for all tissues in v1.** Per-tissue keys (KMS) are explicitly v2. Documented in `.env.example` and the config schema.
10. **The seed ships the demo tissue with `status: 'active'` directly.** The dev wants the demo to be immediately callable. In production, the seed would create a `draft` and a human would publish it.

## Bug fixes / refactors landed in this pass

- **`CombinedDecision.authority` doesn't exist on the `@aigarth/trinary` algebra output.** I had assumed it did; the actual output has `state, confidence, reasoning, contributors, ignored, policy`. The fix: derive the tissue envelope's authority as max-of-contributors in the application code. Documented.
- **Dynamic imports in `decisions.ts` (workaround for a circular-import concern that didn't actually exist).** Removed. `decisions.ts` imports from `tissues.ts` but not the other way around, so there was no cycle.
- **`ConsensusPolicySchema` was missing from `@aigarth/trinary`.** I had defined the type but not the zod schema. Added a `z.discriminatedUnion` for the four policy shapes with `.strict()` so extra fields are rejected. Tests added in the trinary package.
- **The route layer was using `serializeTissueDecision` against a `DecisionListRow` from `listDecisions` that already had the public field names.** The listDecisions function returns a `{data, next_cursor, has_more}` shape with already-serialized fields; passing it through the db-schema serializer broke the type. Fix: return the result directly from the route.
- **Zod 3.25 pin is now consistent** — `services/tissue` joins `services/ann` and `@aigarth/trinary` in pinning to `~3.23.8`. The next monorepo-wide fix should be a `pnpm.overrides` in the root.

## What is NOT in this phase (deferred, with rationale)

- **Tissue license.** Phase 18E (productization) introduces a marketplace listing type for tissues, with per-tissue licensing and per-decision pricing in QUBIC. v1 inherits from the org default.
- **Multi-tenant access control.** v1 enforces owner-only on update / member-management. Cross-tenant sharing (e.g. "this tissue is callable by any org in this partnership") is a 18E concern.
- **Tissue-level audit log viewer in the dashboard.** Phase 18E (apps/web Studio).
- **Streaming / SSE / partial-consensus visibility.** A caller might want to see "Sales said +1, Finance said +1, Risk is still computing" in real time. This is a wire-protocol change for 18F or v2.
- **Per-tissue signing keys.** v1 = single env-var key. v2 = per-tissue keys loaded from a secrets manager.
- **Tissue template + clone.** "Give me a copy of the executive tissue but with a different member" is a useful ergonomic but a v2 product feature.
- **Real model invocation inside the ANN service.** The deterministic stub from 18B is what every member will return until a real model hook lands. The tissue service is model-agnostic — it just consumes envelopes.

## End-to-end flow

```
┌─────────────────┐  POST /v1/tissues/X/decide  ┌─────────────────┐
│   consumer       │  (user JWT)                │   tissue:7008   │
│   (apps/web,     │ ─────────────────────────► │                 │
│    SDK, curl)    │                            │  1. load tissue  │
│                 │                            │  2. fan out:     │
│                 │                            │                 │
│                 │                            │     ┌───────────┴───────────┐
│                 │                            │     ▼                       ▼
│                 │                            │  POST /v1/anns/sales/decide  POST /v1/anns/risk/decide  ...
│                 │                            │     │ (parallel)             │
│                 │                            │     └───────────┬───────────┘
│                 │                            │                 │
│                 │                            │  3. combine(policy, [...])
│                 │                            │  4. build tissue envelope
│                 │                            │  5. sign with TISSUE_SIGNING_KEY
│                 │                            │  6. log to tissue_decisions
│                 │                            │                 │
│                 │ ◄───────────────────────── │                 │
│   receive       │  envelope + contributors   │                 │
│   envelope      │  + ignored + total_latency │                 │
│   in 3 places   │  + tissue + policy         │                 │
└─────────────────┘                            └─────────────────┘
```

## Time-to-Ship

- **Active build time:** ~115 minutes (the most complex phase by far)
- **SP velocity:** ~3.5 SP / 115 min
- **Tests added:** 44 in the tissue service + 5 in the trinary package = 49
- **Files added:** 22 (1 migration, 14 source, 4 tests, 1 seed, 1 journal, 1 config) + 1 ADR (in 18A)
- **Files updated:** 4 (trinary consensus + index + consensus tests, sdk types)
- **New bounded context:** `tissues`, `tissue_members`, `tissue_decisions`, `tissue_audit_logs`

## Comparison to prior phases

- **18A** shipped a pure contract package (0 service changes).
- **18B** touched one existing service (ann) with a schema migration.
- **18C** touched the gateway's chat route + SDK types.
- **18D** is the largest by far: new bounded context, new service, cross-service HTTP fanout, runtime use of the consensus algebra. It's also the first phase where the trinary protocol is *consumed at runtime* by application code, not just exposed as types.

## Next phases

**18E** (≈ 2 SP): Productization. Studio tissue builder, dashboard history view, marketplace listing type for tissues, QUBIC pricing, per-tissue license. The "first time a user touches a tissue in the UI" phase.

**18F** (≈ 1 SP): Docs, brand, demo tissue, launch material.

The protocol is fully working end-to-end. The remaining two phases are surface work — UI, docs, marketing.

Want me to start 18E?
