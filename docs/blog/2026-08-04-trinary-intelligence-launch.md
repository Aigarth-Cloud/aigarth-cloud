---
title: "Trinary Intelligence is live on Aigarth Cloud"
date: 2026-08-04
author: Principal Architect, Aigarth Cloud
tags: [trinary, launch, ann, tissue, decision-protocol]
---

# Trinary Intelligence is live on Aigarth Cloud

Today we're shipping the **Trinary Intelligence Layer** — the protocol
that turns every ANN on Aigarth from a "best-guess generator" into a
**signed, auditable, trinary decision-maker**.

And with that, we're also shipping **tissues**: a new way to compose
multiple ANNs into a single coordinated decision, with veto power, weighted
authority, and append-only audit logs.

## What's the trinary protocol?

Every ANN on Aigarth now speaks one of three outcomes:

| State | Meaning |
|-------|---------|
| `+1`  | proceed |
| `0`   | continue observing |
| `-1`  | block |

That's it. Three states, signed, replayable. No more "the model said
something, we hope it's right." You get a decision and a signature.

Every `/decide` call returns a signed `IntentEnvelope` with the state,
the confidence, the authority, the reasoning, the reversibility, and
the time horizon. You can store the envelope, audit it, replay it,
and trust it.

## What's a tissue?

A tissue is a composition of ANNs. It calls its members in parallel,
collects their envelopes, and combines them with a **consensus policy**:

- **majority** — most members agree
- **unanimous** — every member agrees
- **any** — the first non-zero contribution wins
- **veto_aware** — any veto member returning `-1` blocks the whole tissue
- **short_circuit** — the first decisive vote wins

The same `IntentEnvelope` shape comes out of a tissue as out of an ANN.
A tissue looks like a regular ANN to a downstream consumer — same wire
contract, same signature, same audit. The difference is in how the
decision was made.

## What can you do with it today?

**Build a tissue in the Studio** at `aigarth.cloud/dashboard/tissues`.
Pick a name, pick a policy, add your ANNs as members with roles and
authority weights, publish. Takes about 90 seconds.

**Call a tissue** with the SDK:

```ts
const decision = await client.tissues.decide("risk-council", {
  input: { deal_size_qubic: 5_000_000, counterparty: "acme" },
  reversibility: "soft",
  time_horizon: "session",
});

console.log(decision.envelope.state);  // 1 | 0 | -1
console.log(decision.envelope.signature);  // HMAC-SHA-256
```

**Monetize a tissue** with a marketplace listing — pick a per-decision
price, and the billing service handles the rest. Tissue usage flows
into the next invoice as an `overage_tissue` line item.

**License a tissue** to specific users by setting `access: "licensed"`
and granting per-user access. Useful for paid or private ANN
compositions.

## Why now?

Aigarth ANNs have always been individually callable. But the moment
you want a *coordinated* decision — "the risk ANN should be able to
veto the sales ANN" — you need a wire contract that both sides speak.

The trinary protocol is that contract. It's the smallest change we
could make to the Aigarth API surface that unlocks *coordinated*
intelligence. The trinary vocabulary was first proposed in the Neuraxon
v2.0 paper by Vivancos & Sanchez (2026); we're shipping a production
implementation of it today.

## What's next

- **Ed25519 + Qubic-wallet signing.** Today we use HMAC-SHA-256 with a
  per-service env-var key. v2 will rotate to per-ANN / per-tissue keys
  tied to Qubic wallets, with on-chain revocation.
- **Real LLM invocation in the ANN service.** The current implementation
  uses a deterministic stub so the protocol ships first. Real model
  invocation is next.
- **Per-state pricing** in the marketplace (free for `0`, paid for `±1`).
  Not in scope for v1 because we don't want to incentivize models to
  *avoid* `-1` outcomes.

## Get started

- Read the [user guide](../../guides/trinary-intelligence.md)
- Read [ADR 003](../../architecture-decisions/003-trinary-protocol-v1.md) for the protocol spec
- Watch the [video walkthrough](../../video/trinary-intelligence-walkthrough.md)
- Browse the [marketplace](https://aigarth.cloud/marketplace) for live tissues

Welcome to the Trinary Intelligence Layer.
