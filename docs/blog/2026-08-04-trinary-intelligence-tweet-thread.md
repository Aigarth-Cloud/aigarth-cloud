---
title: "Trinary Intelligence launch — tweet thread"
date: 2026-08-04
author: Principal Architect, Aigarth Cloud
platform: x / twitter
---

# Trinary Intelligence — X / Twitter thread

A 12-tweet launch thread. Use the X scheduler or paste as a single
thread. Each tweet is under 280 characters.

---

**1/12**

Trinary Intelligence is live on Aigarth Cloud.

Every ANN now speaks one of three outcomes: +1, 0, -1. Signed. Auditable. Replayable.

No more "the model said something, we hope it's right." You get a decision and a signature. 🧵

---

**2/12**

The trinary protocol returns a signed `IntentEnvelope` on every /decide call:

• state ∈ {-1, 0, +1}
• confidence
• authority
• reasoning
• reversibility
• time_horizon
• signature (HMAC-SHA-256)

Store the envelope. Replay it. Trust it.

---

**3/12**

Today we also ship **tissues**: a way to compose multiple ANNs into a single coordinated decision.

Same envelope shape comes out as from a single ANN. Downstream consumers can't tell the difference.

---

**4/12**

5 consensus policies, pick the one that fits:

• majority — most members agree
• unanimous — every member agrees
• any — first non-zero wins
• veto_aware — any veto blocks
• short_circuit — first decisive wins

---

**5/12**

The killer feature: **veto power**.

A tissue with `veto_aware` policy: the risk ANN can block the sales ANN. The compliance ANN can block the operations ANN.

You compose the oversight directly into the wire.

---

**6/12**

Build a tissue in 90 seconds with the Studio:

1. Pick a name
2. Pick a policy
3. Add your ANNs as members with roles + authority weights
4. Publish

aigarth.cloud/dashboard/tissues

---

**7/12**

Call a tissue with the SDK:

```ts
const d = await client.tissues.decide("risk-council", {
  input: { deal_size_qubic: 5_000_000, counterparty: "acme" },
});

console.log(d.envelope.state);     // 1 | 0 | -1
console.log(d.envelope.signature); // HMAC-SHA-256
```

---

**8/12**

Monetize it: wrap a tissue in a marketplace listing with a per-decision price. Billing service handles the rest automatically. Tissue usage flows into the next invoice as `overage_tissue`.

---

**9/12**

License it: `access: "licensed"` + grant per-user access. Useful for paid or private ANN compositions. Revoke anytime. Audit log keeps the history.

---

**10/12**

One design decision worth highlighting: **the price is the same for +1, 0, and -1**.

We do not want a perverse incentive for the tissue to avoid -1 just because it's cheaper for the caller.

The price is for the decision, not the outcome.

---

**11/12**

The trinary vocabulary was first proposed in Neuraxon v2.0 by Vivancos & Sanchez (2026). Today we ship a production implementation of it.

Same wire contract. Different responsibility boundary. A tissue is just a tissue. A decision is just a decision.

---

**12/12**

Get started:
• user guide → docs/guides/trinary-intelligence.md
• protocol spec → docs/architecture-decisions/003-trinary-protocol-v1.md
• video walkthrough → docs/video/trinary-intelligence-walkthrough.md
• marketplace → aigarth.cloud/marketplace

Welcome to the Trinary Intelligence Layer. ⚡
