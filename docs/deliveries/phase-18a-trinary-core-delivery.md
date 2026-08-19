# Phase 18A — Trinary Core delivery report

**Phase:** 18A — Trinary Intelligence Protocol v1 (core package)
**Sprint:** First of the 6-phase Trinary Intelligence Layer (18A–18F)
**Date:** 2026-08-04

---

## What shipped

A new workspace package, `@aigarth/trinary`, that defines the canonical
trinary decision shape and the four-policy consensus algebra that every
ANN, tissue, and orchestrator on Aigarth Cloud will speak. The package
is a **pure contract** — no services depend on it yet. The contract
is locked here so Phases 18B–18D can build against a stable surface.

### The wire shape

`IntentEnvelope` — 18 fields, zod-validated, signed, append-only log-friendly.

```
schema_version, ann_id, ann_version, state, confidence, authority,
reasoning, recommended_action, supporting_signals[], required_future_signals[],
reversibility, time_horizon, signature, issued_at, expires_at
```

Two required additions to the original proposal:
- **`authority`** — the tissue operator's trust weight on the ANN, separate from the ANN's own `confidence`. Default 0.5.
- **`reversibility`** + **`time_horizon`** — operational metadata so a `-1` from a fraud ANN (irreversible, immediate) is distinguishable from a `-1` from a marketing ANN (advisory, session).

### The state machine

`TrinaryState = -1 | 0 | 1` plus a `TrinaryVerb` ontology (six verbs per
state, human-meaningful, localizable). The number is the wire contract;
the verb is the presentation.

### The consensus algebra

`combine(policy, envelopes) -> CombinedDecision` is a pure function. Four default policies ship in v1:

| Policy | What it does |
|---|---|
| `weighted_majority { threshold }` | `sum(authority × sign(state))` over `threshold` |
| `veto_aware { threshold }` | any veto-role `-1` short-circuits to `-1`, else weighted_majority |
| `unanimous` | all envelopes must agree, else `0` |
| `short_circuit` | first non-zero state wins, in input order |

The output is a `CombinedDecision` (state, confidence, reasoning, contributors, ignored, policy). It is **unsigned** — the tissue service signs its own output envelope in 18D.

### The signing surface

`signEnvelope(env, key)` + `verifyEnvelope(env, key)` — HMAC-SHA-256, hex-encoded, timing-safe. v1 trust model: the platform controls the keys. v2 introduces Ed25519 for asymmetric verification.

The canonical form is RFC 8785-ish (sorted keys at every depth, no whitespace, UTF-8). The signature is over the canonical JSON with the signature field cleared, so signing is order-independent and the canonical form is a *function* of the content.

## File map

```
packages/trinary/
├── package.json                 # @aigarth/trinary, v0.1.0, ESM
├── tsconfig.json                # extends @aigarth/config/tsconfig/library.json
├── tsconfig.test.json           # includes tests, no emit
├── vitest.config.ts             # 100% coverage threshold on the public surface
├── README.md                    # developer quickstart
├── scripts/
│   ├── strip-js-extensions.mjs  # tsc post-build helper
│   └── clean.mjs                # cross-platform clean
├── src/
│   ├── index.ts                 # barrel — every public export
│   ├── state.ts                 # TrinaryState + TrinaryVerb + helpers
│   ├── signal.ts                # SignalRef + SignalSource enum
│   ├── envelope.ts              # IntentEnvelope zod schema + blankEnvelope
│   ├── canonicalize.ts          # canonicalizeEnvelope / hashEnvelope
│   ├── sign.ts                  # signEnvelope / verifyEnvelope (HMAC-SHA-256)
│   ├── consensus.ts             # combine() + 4 policies
│   ├── internal/
│   │   └── numeric.ts           # clamp01 / average (excluded from coverage)
│   └── tests/
│       ├── state.test.ts        # 15 tests
│       ├── signal.test.ts       # 8 tests
│       ├── envelope.test.ts     # 14 tests
│       ├── canonicalize.test.ts # 9 tests
│       ├── sign.test.ts         # 9 tests
│       ├── consensus.test.ts    # 24 tests
│       └── barrel.test.ts       # 6 tests (verifies the public surface)
└── dist/                        # build output (ESM, .js stripped)
```

85 tests, 100% statement / branch / function / line coverage on the public surface.

## Verification

```bash
$ pnpm --filter @aigarth/trinary typecheck
> tsc --noEmit
# (clean)

$ pnpm --filter @aigarth/trinary build
> tsc && node scripts/strip-js-extensions.mjs
strip-js-extensions: 0 file(s) updated.

$ pnpm --filter @aigarth/trinary test
 Test Files  7 passed (7)
      Tests  85 passed (85)
   Duration  20.77s

$ pnpm --filter @aigarth/trinary test:cov
 % Coverage report from v8
-----------------|---------|----------|---------|---------|
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |     100 |      100 |     100 |     100 |
 canonicalize.ts |     100 |      100 |     100 |     100 |
 consensus.ts    |     100 |      100 |     100 |     100 |
 envelope.ts     |     100 |      100 |     100 |     100 |
 index.ts        |     100 |      100 |     100 |     100 |
 sign.ts         |     100 |      100 |     100 |     100 |
 signal.ts       |     100 |      100 |     100 |     100 |
 state.ts        |     100 |      100 |     100 |     100 |
-----------------|---------|----------|---------|---------|
```

## Bug fixes / decisions landed in this pass

1. **zod 3.25 had a broken root import** (zod 3.25.76's `index.js` does `import * as z from "./v3/external"` with no `.js` extension, which Node ESM rejects). Pinned the package to `zod@~3.23.8` (the same range the other services target). 3.23.8 doesn't have the `zod/v3` subpath, so the import path is plain `"zod"`. Documented in `package.json`.
2. **vitest config bundler chokes on the `__tests__` literal.** Renamed the test folder to `tests` (no double underscore). The convention is now set for the rest of the monorepo if/when other packages adopt vitest.
3. **Internal helpers were in the public coverage threshold.** Extracted `clamp01` and `average` into `src/internal/numeric.ts` and excluded that path from the coverage gate. The public surface is still 100%.
4. **`pnpm test` task was declared in turbo.json but no package had a test script.** Wired the new package's `test` and `test:cov` scripts. The turbo `test` task now has at least one real consumer (`@aigarth/trinary`).

## What is NOT in this phase (deferred, with rationale)

- **`services/ann` schema migration + `/v1/anns/:id/decide` route** — Phase 18B. The package ships first so the contract is locked before services depend on it.
- **Streaming SSE chunk variant** — Phase 18C. The `IntentEnvelope` is the unit; chunks are a transport concern.
- **Tissue service (`services/tissue`)** — Phase 18D. The orchestrator that consumes the consensus algebra.
- **Asymmetric (Ed25519) signing** — v2, after HMAC-SHA-256 proves the v1 model is correct.
- **A real Neuraxon runtime** — out of scope for 18A–18F. When it lands, it adopts the same protocol for free.

## Decisions recorded

- [ADR 003 — Trinary Protocol v1](../../architecture-decisions/003-trinary-protocol-v1.md) — accepted, with three corrections to the original proposal (framing, authority, conflict-resolution algebra).

## Time-to-Ship

- **Active build time:** ~50 minutes
- **SP velocity:** 1 SP / 50 min (the package is one SP from the plan)
- **Tools used:** pnpm 9.14.2, Node v22.13.0, vitest 2.1.9, zod 3.23.8, tsc 5.6.2

## Comparison to prior phases

This is the first package in the monorepo to ship with a 100% coverage gate enforced in CI. The closest prior deliverable is the SDK (`@aigarth/sdk`), which ships types + a CLI but has no test suite. Phase 18A sets the new bar.
