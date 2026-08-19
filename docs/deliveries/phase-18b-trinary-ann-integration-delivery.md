# Phase 18B — Trinary ANN Integration delivery report

**Phase:** 18B — Trinary Intelligence Protocol v1 (ANN service integration)
**Sprint:** Second of the 6-phase Trinary Intelligence Layer (18A–18F)
**Date:** 2026-08-04
**Builds on:** [Phase 18A — Trinary Core](./phase-18a-trinary-core-delivery.md), [ADR 003 — Trinary Protocol v1](../architecture-decisions/003-trinary-protocol-v1.md)

---

## What shipped

The trinary protocol is no longer just a contract — it is now reachable end-to-end from the ANN service. Any ANN created with `decision_protocol: 'trinary'` (or `'hybrid'`) can be queried at `POST /v1/anns/:id/decide` and returns a signed `IntentEnvelope`. Every decision is logged to an append-only table (`ann_decisions`) and is replayable end-to-end.

### New routes

- `POST /v1/anns/:idOrSlug/decide` (authenticated) — build + sign + log + return an `IntentEnvelope`
- `GET /v1/anns/:idOrSlug/decisions` (authenticated) — paginated decision history with optional signature re-verification

### New schema

- `anns.decision_protocol` — pgEnum `('openai_chat' | 'trinary' | 'hybrid')`, default `'openai_chat'`
- `anns.trinary_prompt_template` — text, nullable, creator-only
- `anns.authority_weight` — numeric(4, 3), default 0.5
- `ann_decisions` — new append-only log table (uuid PK, JSONB envelope, indexed by `(ann_id, issued_at DESC)`, `(request_id)`, and `(ann_id, state)`)

### New service module

- `services/ann/src/services/trinary.ts` — `decideAnn()`, `listDecisions()`, plus exported stub helpers (`stubTrinaryState`, `stubConfidence`, `stableStringify`, `stubReasoning`, `defaultReversibility`, `numericOr`, `newRequestId`)
- New zod schemas: `DecideRequestSchema`, `ListDecisionsQuerySchema`
- New error classes: `AnnNotFoundError`, `AnnNotTrinaryError`, `AnnNoPublishedVersionError` (mapped to 404 / 400 by the route layer)
- New audit action: `ann.decision_emitted` (logged with ann_id, ann_version, state, confidence, request_id)

### New env var

- `ANN_TRINARY_SIGNING_KEY` — HMAC-SHA-256 key, ≥16 chars, with a dev placeholder in `.env.example`. Documented as v1 (single key, all ANNs); v2 introduces per-ANN keys via a secrets manager.

### Migration

- `services/ann/drizzle/0002_trinary_intelligence.sql` — additive, non-breaking. Existing ANNs default to `decision_protocol='openai_chat'` and `authority_weight=0.5`. No existing row is touched.

## File map

```
services/ann/
├── drizzle/
│   └── 0002_trinary_intelligence.sql       (new)
├── src/
│   ├── config/index.ts                     (updated: ANN_TRINARY_SIGNING_KEY)
│   ├── db/schema.ts                        (updated: enum, 3 columns, ann_decisions table)
│   ├── lib/
│   │   ├── audit.ts                        (updated: decisionEmitted action)
│   │   └── serialize.ts                    (updated: decision_protocol + authority_weight on Ann)
│   ├── routes/anns.ts                      (updated: /decide + /decisions routes)
│   ├── services/
│   │   ├── anns.ts                         (updated: CreateAnnSchema, UpdateAnnSchema, createAnn, updateAnn accept new fields)
│   │   └── trinary.ts                      (new: 350+ lines)
│   ├── tests/
│   │   ├── trinary.test.ts                 (new: 40 tests)
│   │   └── routes.test.ts                  (new: 2 auth-smoke tests)
│   └── ... unchanged
├── scripts/
│   └── clean.mjs                           (new: cross-platform clean)
├── vitest.config.ts                        (new: 100% coverage on the new code)
└── package.json                            (updated: @aigarth/trinary dep, vitest devDeps, test scripts)
```

## Verification

```bash
$ pnpm --filter @aigarth/ann typecheck
> tsc --noEmit
# (clean)

$ pnpm --filter @aigarth/ann build
> tsc
# (clean)

$ pnpm --filter @aigarth/ann test
 Test Files  2 passed (2)
      Tests  42 passed (42)
   Duration  13.19s

$ pnpm --filter @aigarth/trinary test
 Test Files  7 passed (7)
      Tests  85 passed (85)
# (still 100% green — Phase 18A is untouched)
```

## What the `/decide` round trip looks like

```bash
# 1. Create a trinary-mode ANN
curl -X POST http://localhost:7006/v1/anns \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Lead Qualifier",
    "decision_protocol": "trinary",
    "authority_weight": 0.7,
    "trinary_prompt_template": "You are a sales lead qualifier. Emit a trinary envelope."
  }'

# 2. Publish a version
curl -X POST http://localhost:7006/v1/anns/$ANN_ID/versions \
  -H "Authorization: Bearer $JWT" \
  -d '{ "version": "1.0.0" }'

curl -X POST http://localhost:7006/v1/anns/$ANN_ID/publish \
  -H "Authorization: Bearer $JWT"

# 3. Decide
curl -X POST http://localhost:7006/v1/anns/$ANN_ID/decide \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req_abc",
    "input": { "lead_id": "L42", "score": 0.91 },
    "reversibility": "soft",
    "time_horizon": "session"
  }'
# → 201 Created
# {
#   "decision_id": "...",
#   "envelope": {
#     "schema_version": 1,
#     "ann_id": "...",
#     "ann_version": "1.0.0",
#     "state": 1, "confidence": 0.81, "authority": 0.7,
#     "reasoning": "ANN ... (stub): observed 2 input field(s) — lead_id, score",
#     "recommended_action": "proceed",
#     "supporting_signals": [], "required_future_signals": [],
#     "reversibility": "soft", "time_horizon": "session",
#     "signature": "a3f4...",
#     "issued_at": "2026-08-04T..."
#   },
#   "persisted": true
# }

# 4. List decisions
curl http://localhost:7006/v1/anns/$ANN_ID/decisions?verify_signatures=true \
  -H "Authorization: Bearer $JWT"
# → 200 OK
# { "data": [...], "next_cursor": null, "has_more": false }
```

The same shape is what Phase 18C (gateway) will accept as `response_format: "trinary"` on `/v1/chat/completions`, and what Phase 18D (tissue service) will combine under the consensus algebra.

## Decisions landed

1. **One env-var signing key for all ANNs (v1).** Per-ANN keys (KMS / Vault) are explicitly v2. Documented in `.env.example` and the config schema.
2. **Deterministic stub for envelope generation.** Real ANNs replace this with an actual model call in a follow-on phase. The stub is hash-based so the same input always produces the same state — useful for replay tests in CI.
3. **`ann_decisions` is append-only.** Cascade-delete on ANN hard-delete only. No application code updates or deletes rows. This is the audit + replay surface.
4. **`authority_weight` lives on `anns`, not on `ann_decisions`.** The operator-trusted weight is a property of the ANN, not of the decision. The decision row carries a copy of the value at decision time (for replay), but the source of truth is the ANN row.
5. **Trinary prompt template is creator-only.** Not in the public `serializeAnn` response. Stored on the ANN row so the producer can iterate on the prompt without a code deploy.
6. **`z.coerce.boolean()` is not enough for query params.** `"false"` coerces to `true` because `Boolean("false")` is `true`. The list-decisions query uses an explicit transform that recognizes `"true" | "1" | true | 1` as truthy.
7. **Vitest `**` glob in JSDoc triggers an esbuild parse error** in the config file. Moved the doc comment to a non-JSDoc block.

## Bug fixes / refactors landed in this pass

- **`@aigarth/trinary` zod pin is mirrored in `services/ann`.** Pinned `zod@~3.23.8` to avoid the broken `zod@3.25.x` root import that we hit in Phase 18A. The other services will hit the same bug if they ever load zod via vitest — should be a root-level pnpm override in a follow-up.
- **`scripts/clean.mjs`** (new, cross-platform). The old `rm -rf` script failed on Windows.
- **`package.json` `test` script** now actually runs tests (was `echo "no tests yet" && exit 0`).
- **`tsconfig` exclude** — `services/ann/tsconfig.json` excludes `src/tests/**` from the production build, mirroring the trinary package's pattern.

## What is NOT in this phase (deferred, with rationale)

- **A real model call inside `decideAnn`.** The current implementation uses a deterministic hash-based stub. Real model invocation is a follow-on: the consumer (gateway in 18C, or a deployed compute job in 18D) supplies the model output; the ANN service just frames it as an envelope. We don't want to bake an LLM call into the registry service.
- **Streaming / SSE variant.** The current `POST /decide` returns a single envelope. Phase 18C adds a streaming variant in the gateway.
- **Ed25519 signing.** v1 = HMAC. v2 = Ed25519 with optional Qubic-wallet keys.
- **Tissue service.** That's Phase 18D — a new service on port 7008 that consumes `combine()` from `@aigarth/trinary`.
- **Per-ANN signing keys.** v1 = single env-var key. v2 = per-ANN keys loaded from a secrets manager.

## Time-to-Ship

- **Active build time:** ~75 minutes
- **SP velocity:** ~1.5 SP / 75 min
- **Tests added:** 42 (40 trinary service + 2 route auth smoke)
- **Files added:** 4 (migration, trinary service, vitest config, clean script, 2 test files, 1 update to env example)
- **Files updated:** 7 (schema, anns service, routes, config, audit, serialize, package.json)

## Comparison to prior phases

Phase 18A shipped a pure contract package with 100% coverage. 18B is the first *integration* phase — it touches the existing ANN service schema, routes, audit, and serializer. The blast radius is contained: the migration is additive, new routes are opt-in (the existing `decision_protocol` defaults to `openai_chat`), and every existing test path is unaffected. The ANN service now has 42 unit tests (up from zero), with the rest of the codebase still to be retrofitted in a separate test-writing pass.

## Next phase (18C)

`services/gateway` accepts `response_format: "trinary"` on `POST /v1/chat/completions` and proxies the call to `/v1/anns/:id/decide`. The OpenAI surface stays default; trinary is opt-in. Streaming variant (SSE chunks emit `aigarth_intent_delta`) ships in the same phase.

Want me to start 18C?
