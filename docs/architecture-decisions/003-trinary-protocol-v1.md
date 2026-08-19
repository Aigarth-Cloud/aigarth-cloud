# ADR 003 — Trinary Protocol v1 (Adopt, Elevate the Proposal)

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-04 |
| **Author** | Principal Architect, Aigarth Cloud |
| **Reviewers** | Engineering, Founders |
| **Builds on** | Neuraxon v2.0 (Vivancos & Sanchez, 2026) §1, §7, §8 |
| **Decides** | Whether to introduce a trinary (+1 / 0 / -1) language as the universal decision protocol for every ANN on Aigarth Cloud, and how to do it without breaking the existing OpenAI surface |
| **Outcome** | Adopt a v1 protocol implemented in `@aigarth/trinary` (Phase 18A shipped). Build the orchestration layer (`services/tissue`) and the opt-in ANN endpoint in 18B–18D. Defer asymmetric (Ed25519) signing and on-chain attestation to v2. |

---

## 1. Context

A proposal was submitted to elevate the trinary state (+1, 0, -1) from a Neuraxon-internal detail into a universal communication protocol across every ANN, tissue, and higher-order orchestration system on Aigarth Cloud. The proposal's argument: today, ANNs communicate using probabilities and natural language; ANNs that "speak the same decision language" can be orchestrated without an interpreter.

The proposal's *direction* is right. The proposal's *premise* is wrong. **The trinary state is not currently used at the neuron level in the Aigarth Cloud codebase.** Neuraxon v2.0 is a research paper (not deployed), and Aigarth is described in §8 of the paper as a separate framework that *would be* hybridized with Neuraxons in a "Neuraxon-ITU." That hybridization has not happened. Every ANN in the live platform today returns OpenAI-shaped text or a label; there is no shared decision vocabulary.

This ADR accepts the proposal's direction with three corrections:

1. **We are introducing trinary at the *ANN* level as the first place it lives in our system**, mirroring the Neuraxon design. We are not "elevating" it from an existing foundation.
2. **The schema must include provenance (authority, reversibility, time_horizon)**, not just a state number. A pure trinary verb is not enough to build a real orchestration layer.
3. **The conflict resolution algebra must be specified up-front.** Without it, the protocol is a marketing surface, not an architecture.

## 2. Decision

**Adopt the proposal's direction. Ship the protocol as `@aigarth/trinary` v1 (Phase 18A). Build the rest of the stack in 18B–18F.**

The v1 protocol is a **typed, zod-validated, signed envelope** with a **four-policy consensus algebra**. It does not require a Neuraxon runtime to use. It does not replace the existing OpenAI surface. It sits alongside it, opt-in.

### 2.1 — What v1 ships (Phase 18A, this delivery)

- A new package `packages/trinary` (`@aigarth/trinary`, v0.1.0) with:
  - `TrinaryState` (`-1 | 0 | 1`) + `TrinaryVerb` ontology (six verbs per state)
  - `IntentEnvelope` — the wire shape. Strict zod schema, 18 fields, semantic versioning via `schema_version`
  - `SignalRef` — pointer to supporting/required evidence
  - `canonicalizeEnvelope` + `hashEnvelope` — RFC 8785-ish stable JSON for signing
  - `signEnvelope` + `verifyEnvelope` — HMAC-SHA-256, hex-encoded, timing-safe verification
  - `combine(policy, envelopes) -> CombinedDecision` — four default policies: `weighted_majority`, `veto_aware`, `unanimous`, `short_circuit`
- 85 unit tests, 100% statement / branch / function / line coverage on the public surface
- This ADR
- 100% green `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:cov`

### 2.2 — What v1 explicitly does NOT do (deferred to v2)

- Asymmetric (Ed25519) signing. v1 is HMAC-SHA-256 with a per-ANN service key. Asymmetric signing is required for the "trust an ANN I didn't train" scenario the proposal calls out. v2 introduces Ed25519 alongside HMAC.
- Qubic-wallet-based signing. The natural v3 once Qubic identity is the trust root.
- A streaming model. Phase 18C adds SSE chunk variants for time-evolving decisions.
- A Neuraxon runtime. The proposal is *inspired by* Neuraxon; it is not *built on* one. A Neuraxon-OS could land in 19+ and would consume the same protocol.
- On-chain attestation. Trinary decisions are signed by service keys in v1; on-chain attestation is a v2/v3 concern.

### 2.3 — The envelope shape (the v1 contract)

The full zod schema lives in `packages/trinary/src/envelope.ts`. The non-obvious fields and their *why*:

- **`schema_version: 1`** — every consumer can refuse to parse older or newer versions. Bumping this number is a breaking change.
- **`ann_id` + `ann_version` (semver)** — versioned so a tissue can route to the right model.
- **`state: -1 | 0 | 1`** — the trinary decision. Localized via the verb ontology; the number is the wire contract.
- **`confidence: number [0, 1]`** — calibrated probability the state is right. Producers must not emit NaN; zod rejects it. Calibration is the ANN producer's responsibility.
- **`authority: number [0, 1]`** — the *tissue operator's* trust assignment for this ANN. Default 0.5. The ANN does not set this; the tissue does. The proposal confused the two; we separate them.
- **`reversibility: 'irreversible' | 'soft' | 'advisory'`** — how recoverable an execution of this state would be. A `block` is not the same as a `suppress`. The proposal treated them as the same state; we don't.
- **`time_horizon: 'immediate' | 'session' | 'persistent'`** — when the state is meant to be acted on. "Proceed" now is not the same as "proceed when KYC clears."
- **`signature: hex string`** — over the canonical JSON of the envelope with the signature field cleared. HMAC-SHA-256 in v1.
- **`issued_at` + `expires_at`** — ISO 8601 with offset. Persistent states can outlive a session.

### 2.4 — The consensus algebra (the v1 contract)

`combine(policy, envelopes) -> CombinedDecision` is a pure function. Four default policies ship in v1:

| Policy | Semantics | Use case |
|---|---|---|
| `weighted_majority { threshold }` | `sum(authority × sign(state))`. If `≥ threshold` → +1, `≤ -threshold` → -1, else 0 | The generalist. The Sales+Risk+Finance example. |
| `veto_aware { threshold }` | Any veto-role `-1` short-circuits to -1. Otherwise weighted_majority | Safety-critical: a fraud veto overrides any number of +1s. |
| `unanimous` | All envelopes must agree on state, else 0 | High-consensus, low-frequency. Constitution-level decisions. |
| `short_circuit` | First non-zero state wins, in input order | Low-latency paths: stop at the first decisive signal. |

All four produce a `CombinedDecision` (no signature — the tissue service signs its own output). All four are deterministic and testable.

### 2.5 — The build order (Phases 18A–18F)

| Phase | What | Status |
|---|---|---|
| **18A** | `@aigarth/trinary` package + 100% coverage + ADR | **shipped** |
| 18B | `services/ann` gets `decision_protocol`, `authority_weight`, `/v1/anns/:id/decide` route, `ann_decisions` log | next |
| 18C | `services/gateway` accepts `response_format: 'trinary'` in `/v1/chat/completions` (SSE variant in same phase) | queued |
| 18D | `services/tissue` — new service on port 7008. Hosts the consensus algebra. The first real Intelligent Tissue. | queued |
| 18E | Productization: Studio tissue builder, dashboard history, marketplace listing type, QUBIC pricing, tissue license | queued |
| 18F | Docs, brand, demo tissue, launch material | queued |

## 3. Why this is the right call

### 3.1 — A shared decision language is the missing primitive

Aigarth Cloud today has:
- A compute substrate (Phase 2, `services/compute`)
- A registry of ANNs (Phase 5, `services/ann`)
- An OpenAI-compatible API (Phase 7, `services/gateway`)
- A marketplace (Phase 6, `services/marketplace`)
- A billing & economy layer (Phase 4, `services/billing` + `services/economy`)

It does not have a way for an ANN to *express* a decision in a form another ANN or an orchestrator can reason about. The "Executive Tissue" example in the proposal is impossible to build today because every ANN returns either text or a label, and the orchestrator has to re-parse the text to know what the ANN meant. A trinary envelope fixes this. It is the smallest possible decision vocabulary that is richer than binary and smaller than natural language.

### 3.2 — The proposal's six required fields are right, with two additions

The proposal asked for `state`, `confidence`, `reasoning`, `recommended_action`, `supporting_signals`, `required_future_signals`. v1 ships all six, plus four we add:
- `schema_version` (forward-compat)
- `ann_id` + `ann_version` (routing + reproducibility)
- `authority` (separation of ANN-trust from ANN-confidence)
- `reversibility` (operational risk)
- `time_horizon` (orchestration timing)
- `signature` (provenance)
- `issued_at` + `expires_at` (lifecycle)

The additions are not scope creep. They are the fields the proposal was missing for the protocol to be usable in production. See §4 of the proposal evaluation for the full gap analysis.

### 3.3 — A pure contract package is the right first ship

`@aigarth/trinary` has zero runtime dependencies on the rest of the platform. It is a contract layer. Shipping it first means:
- The schema is locked before services depend on it
- The consensus algebra is testable in isolation, with 100% coverage
- 18B–18F can be reviewed against a stable contract, not a moving one
- Future Neuraxon work (when it lands) inherits the same protocol for free

This is the same logic we used for `@aigarth/sdk` (typed contract) before building out the multi-service orchestration.

## 4. The right data flow (v1, this phase)

```
                   Phase 18A (shipped)        Phase 18B (next)        Phase 18D (queued)
                   ────────────────────       ─────────────────       ─────────────────
                                                   ANN service
                                                        │
  packages/trinary/                                     │
   • TrinaryState                                       │ /v1/anns/:id/decide
   • IntentEnvelope                                     ▼
   • canonicalize / hash / sign               blankEnvelope() + signEnvelope()
   • combine()                                  │
                                                ▼
                                          IntentEnvelope (signed, logged)
                                                │
                                                ▼
                                          services/tissue (Phase 18D)
                                                │
                                                ▼
                                          combine(policy, [...])
                                                │
                                                ▼
                                          CombinedDecision (unsigned)
                                                │
                                          signEnvelope() with tissue key
                                                │
                                                ▼
                                          Signed tissue envelope (returned to caller)
```

The `services/tissue` work is where the proposal's "Intelligent Tissue" claim becomes real. In 18A we ship the *contract*; in 18D we ship the *runtime* that consumes it.

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The `services/ann` schema migration in 18B breaks existing ANNs. | The new columns have defaults; the new route is opt-in; old routes return the same shape. |
| ANNs emit uncalibrated confidence, making the consensus algebra garbage-in / garbage-out. | v1 ships with documentation; v2 introduces a calibration harness. |
| HMAC signing is symmetric: anyone with the service key can sign. Acceptable for v1 (the platform controls the keys). | v2 introduces Ed25519 + per-ANN asymmetric keys. |
| Four policies feel arbitrary. | They are not — they are the four policies the proposal's examples need. More land in v2 driven by real tissue usage. |
| The proposal claims "biological consistency" with Neuraxon. Strictly, it is *inspired* by Neuraxon, not built on a Neuraxon runtime. | v1 is clear about this in the README and the schema doc. When a Neuraxon runtime lands, it adopts the same protocol — no migration. |

## 6. v2 and beyond (parking lot)

- **Asymmetric (Ed25519) signing** with optional Qubic-wallet key, so a third party can verify an envelope without holding the secret
- **Streaming protocol** — SSE chunks emit `aigarth_intent_delta` per member decision, so a tissue can show partial consensus in real time
- **On-chain attestation** — emit an `(ann_id, envelope_hash, signature)` tuple to a Qubic contract for cryptographic audit (deferred per ADR 001; only if the off-chain layer proves insufficient)
- **Calibration harness** — measure ANN calibration against a labelled test set, attach a `calibration_score` to the ANN version
- **More consensus policies** — `bayesian`, `median`, `leaky_veto`, custom JSONLogic

## 7. Links

- [ADR 001 — Intelligence Economy Layer](./001-intelligence-economy-layer.md) (rejected the on-chain 5-contract suite; this ADR lives inside the off-chain-only boundary it set)
- [ADR 002 — Staking Contract Strategy](./002-staking-contract-strategy.md) (use Qearn as-is, no clone)
- [Neuraxon v2.0 (Vivancos & Sanchez, 2026)](https://artificiology.org/research/neuraxon-v2.pdf) — §1 (trinary), §7 (synthesis), §8 (Aigarth hybrid)
- [`docs/PRD.md` §14 Intelligence Surfaces](../PRD.md) — the product surface that the tissue service will eventually back
- `packages/trinary/README.md` — developer-facing quickstart
