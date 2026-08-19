# @aigarth/trinary

> Trinary Intelligence Protocol v1 — the canonical `IntentEnvelope`, state machine, consensus algebra, and signed-decision helpers for Aigarth Cloud.

This package is the **public contract** for how every ANN, every tissue, and every orchestrator on Aigarth Cloud communicates decisions. It is the first deployed layer of the biological protocol introduced in Neuraxon v2.0 (Vivancos & Sanchez, 2026). See [ADR 003 — Trinary Protocol v1](../../docs/architecture-decisions/003-trinary-protocol-v1.md).

## What it gives you

- **`TrinaryState`** — the three-value core: `-1 | 0 | 1`. Mirrors excitatory / modulatory / inhibitory dynamics.
- **`IntentEnvelope`** — the wire shape. Every trinary decision on the platform is one of these.
- **`SignalRef`** — a pointer to an observation that supports or conditions a decision.
- **Canonical encoding** — stable, deterministic JSON for signing and hashing (RFC 8785-ish).
- **HMAC-SHA-256 signing** — v1 trust model: per-ANN service key. Asymmetric (Ed25519) + Qubic-wallet signing land in v2.
- **Consensus algebra** — four default policies (`weighted_majority`, `veto_aware`, `unanimous`, `short_circuit`) for combining member envelopes into a tissue-level decision.

## What it does **not** give you (yet)

- A runtime. This package is a contract layer, not a Neuraxon-OS or a tissue engine. The first runtime lives in `services/tissue` (Phase 18D).
- Asymmetric signing. v1 is HMAC; v2 is Ed25519 with optional Qubic-wallet keys.
- Streaming. Phase 18C adds SSE chunk variants for time-evolving decisions.

## Install (workspace)

It's a workspace package — already linked under `packages/trinary`. Import from source or from `dist/`:

```ts
import {
  blankEnvelope,
  signEnvelope,
  verifyEnvelope,
  combine,
  type IntentEnvelope,
  type ConsensusPolicy,
} from "@aigarth/trinary";
```

For Next.js consumers, import from the `dist/` path (the SDK note in `AGENTS.md` applies here too):

```ts
import { ... } from "@aigarth/trinary/dist/index.js";
```

## Quickstart

```ts
import {
  blankEnvelope,
  signEnvelope,
  verifyEnvelope,
  IntentEnvelopeSchema,
} from "@aigarth/trinary";

// 1. Build a decision
const env = blankEnvelope({
  ann_id: "ann_sales_v1",
  ann_version: "1.0.0",
  state: 1,                  // proceed
  confidence: 0.92,          // calibrated
  reasoning: "Lead is qualified and recent",
  recommended_action: "proceed",
  supporting_signals: [{ source: "event", id: "evt_42" }],
  reversibility: "soft",
  time_horizon: "session",
});

// 2. Validate
const parsed = IntentEnvelopeSchema.parse(env);

// 3. Sign with the ANN's service key
const signed = { ...parsed, signature: signEnvelope(parsed, process.env.ANN_KEY!) };

// 4. Verify
verifyEnvelope(signed, process.env.ANN_KEY!); // true
```

## Consensus

```ts
import { combine, type ConsensusPolicy, type ScoredEnvelope } from "@aigarth/trinary";

const policy: ConsensusPolicy = { kind: "veto_aware", threshold: 0.5 };

const decision = combine(policy, [
  { envelope: salesEnv,  member: { ann_id: "ann_sales",  role: "voting" } },
  { envelope: riskEnv,   member: { ann_id: "ann_risk",   role: "veto"   } },
  { envelope: financeEnv, member: { ann_id: "ann_finance", role: "voting" } },
]);

// decision.state ∈ {-1, 0, 1}
// decision.contributors — envelope ids that drove the decision
// decision.ignored     — envelope ids the policy rejected
```

## Scripts

```bash
pnpm --filter @aigarth/trinary typecheck   # tsc --noEmit
pnpm --filter @aigarth/trinary build       # tsc + strip-js-extensions
pnpm --filter @aigarth/trinary test        # vitest run
pnpm --filter @aigarth/trinary test:cov    # vitest run --coverage (100% thresholds)
```

## License

Private. Internal to Aigarth Cloud.
