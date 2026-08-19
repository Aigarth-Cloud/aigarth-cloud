# Trinary Intelligence — User Guide

> A short, working guide to building, calling, and monetizing a tissue
> on Aigarth Cloud. Assumes you have an account, an API key, and the
> Aigarth SDK installed (`npm install @aigarth/sdk`).

## What is a tissue?

A **tissue** is a composition of ANNs that produces a single signed
**trinary decision** — one of three outcomes:

| State | Meaning | Typical action |
|-------|---------|----------------|
| `+1`  | Proceed | "yes, do the thing" |
| `0`   | Continue observing | "we don't know yet, gather more" |
| `-1`  | Block | "no, do not proceed" |

The tissue calls every member ANN in parallel, collects their envelopes,
combines them with a consensus policy, signs the combined result, and
returns a `decision_id` plus the envelope. The envelope is the canonical
record of the decision — store it, replay it, audit it.

## 1. Create a tissue

```ts
import { Aigarth } from "@aigarth/sdk";

const client = new Aigarth({ apiKey: process.env.AIGARTH_API_KEY! });

// 1a. Create a draft tissue.
const tissue = await client.tissues.create({
  name: "Risk Council",
  tagline: "Multi-ANN safety review",
  description: "Sales, risk, and finance vote; risk has veto power.",
  visibility: "public",
  access: "open", // or "licensed" for grant-only access
  policy: { kind: "veto_aware", threshold: 0.4 },
});

// 1b. Add ANN members.
await client.tissues.addMember(tissue.slug, {
  annSlug: "ann_sales_v1",
  role: "voting",
  authorityWeight: 0.4,
});
await client.tissues.addMember(tissue.slug, {
  annSlug: "ann_risk_v1",
  role: "veto",
  authorityWeight: 0.3,
});
await client.tissues.addMember(tissue.slug, {
  annSlug: "ann_finance_v1",
  role: "voting",
  authorityWeight: 0.3,
});

// 1c. Publish.
await client.tissues.publish(tissue.slug);
```

The tissue is now reachable at `/v1/tissues/risk-council` and answerable
at `/v1/tissues/risk-council/decide`.

## 2. Call a tissue

```ts
const decision = await client.tissues.decide("risk-council", {
  request_id: "deal-2026-0001",
  input: {
    deal_size_qubic: 5_000_000,
    counterparty: "acme",
    region: "tt",
  },
  reversibility: "soft",
  time_horizon: "session",
});

console.log(decision.envelope.state);       // 1 | 0 | -1
console.log(decision.envelope.confidence);  // 0.0 .. 1.0
console.log(decision.envelope.authority);   // 0.0 .. 1.0
console.log(decision.envelope.signature);   // HMAC-SHA-256
console.log(decision.contributors);         // per-ANN contribution records
console.log(decision.ignored);              // per-ANN failure records
```

`tissues.decide()` always returns a single envelope — the tissue itself
is a black box. You do not have to know which members participated,
what they voted, or how the policy combined their votes. You just see
the outcome and the signature.

If you want the per-member detail (for audit / debugging), it's there
in `contributors[]`. If a member failed (timeout, network, schema),
it's in `ignored[]` and a single member failure never blocks the
tissue — the decision still goes out.

## 3. The 5 consensus policies

| Policy            | When `state = +1`                              |
|-------------------|-----------------------------------------------|
| `majority`        | most members vote `+1`                        |
| `unanimous`       | every member votes `+1`                       |
| `any`             | the first non-zero contribution wins          |
| `veto_aware`      | any `veto` member returning `-1` blocks       |
| `short_circuit`   | the first decisive (`+1` or `-1`) wins        |

`veto_aware` is the most common choice for safety reviews: the regular
members vote, but a single veto overrides. `short_circuit` is for
fast-path decisions where you want to short-circuit on the first
decisive signal.

The `threshold` field is a tie-breaker for `majority` and the confidence
cutoff for `short_circuit` — pick a value that matches the use case
(0.4–0.5 is a good default for risk reviews).

## 4. Open vs licensed

By default, a tissue is `access: "open"`: any signed-in user can call it.
For a paid or private composition, set `access: "licensed"` and grant
per-user access:

```ts
const tissue = await client.tissues.create({
  name: "Compliance Brief",
  // ...
  access: "licensed",
});

// Later: grant to a specific user.
await client.tissues.grantLicense(tissue.slug, {
  granteeUserId: "00000000-0000-0000-0000-000000000001",
  source: "owner_grant",
});
```

The license is permanent unless you set `expiresAt` (time-bounded grant)
or `maxDecisions` (cap — coming in v2). Revoke with `revokeLicense()`;
the row stays in the table for audit, but `revoked_at` blocks new calls.

## 5. Monetize with a marketplace listing

A tissue alone is the protocol surface. To sell per-decision access, wrap
it in a marketplace listing:

```ts
const listing = await client.marketplace.tissueListings.create({
  title: "Risk Council — pay per decision",
  description: "1,000 QUBIC per call. Same envelope, billed.",
  tissueSlug: "risk-council",
  tissueName: "Risk Council",
  pricePerDecisionQubic: "1000000000", // 1,000 QUBIC in smallest unit
  access: "open",
  visibility: "public",
});
```

Then users call the tissue through the listing, and the price flows
through automatically:

```ts
const decision = await client.tissues.decide("risk-council", {
  input: { /* ... */ },
  tissue_listing_id: listing.id,
  cost_qubic: "1000000000", // must match the listing's price
});
```

Two things happen behind the scenes:

1. The tissue service emits a `TissueUsageEvent` to the billing service.
   It lands in `billing_tissue_usage_events` and rolls up into the
   next invoice as an `overage_tissue` line item.
2. The tissue service increments the marketplace listing's
   `total_decisions` and `total_revenue_qubic` counters.

Both hooks are best-effort — the `/decide` response is never blocked
on them. If the billing service is down, the decision still goes out;
the usage event is retried in v2 (currently a one-shot best-effort).

## 6. Audit and replay

Every tissue-level decision is signed, persisted, and replayable:

```ts
const history = await client.tissues.listDecisions("risk-council", {
  limit: 50,
  state: 1, // optional filter
});
```

Each row has:

- `envelope` (the full signed `IntentEnvelope`)
- `signature` (HMAC-SHA-256 of the canonical envelope)
- `contributors[]` (per-ANN envelope + decision_id + latency)
- `ignored[]` (per-ANN failure reason + latency)
- `issued_at` and `created_at` (decision time + write time)

To verify a decision offline, recompute the canonical JSON, recompute
the HMAC, compare. The same canonical bytes → the same signature.

## 7. Calling through the gateway

The gateway is trinary-aware too. If you're using the OpenAI-compatible
chat completions endpoint, you can opt in to trinary mode:

```ts
const res = await client.chat.completions.create({
  model: "aigarth-meridian-1",
  messages: [{ role: "user", content: "Approve this deal?" }],
  aigarth_intent: "trinary", // opt in
});
```

The gateway will route through an appropriate ANN, generate a trinary
envelope, and return:

```ts
res.choices[0].message.aigarth_intent;        // "trinary"
res.choices[0].message.aigarth_intent_delta;  // the trinary state
```

Same wire contract as before for non-trinary requests; opt-in is per-call.
See [the user guide section on the gateway](../README.md) for the full
request shape.

## 8. Cross-cutting: the price is the same for all 3 states

A design decision worth highlighting: **the per-decision price is the
same whether the tissue returns `+1`, `0`, or `-1`**. This is intentional.
We do not want a perverse incentive for the tissue to *avoid* `-1`
just because it's cheaper for the caller. The price is for the decision
itself, not for the outcome.

If you want a different model — e.g. "free for `0`, paid for `±1`" —
v2 will add per-state pricing on the marketplace listing.

## Where to go next

- **Build a tissue** with the Studio at `https://aigarth.cloud/dashboard/tissues`
- **Browse the marketplace** at `https://aigarth.cloud/marketplace?kind=tissue`
- **Read the spec** in [ADR 003](../architecture-decisions/003-trinary-protocol-v1.md)
- **Watch the video walkthrough** in the [companion doc](../video/trinary-intelligence-walkthrough.md)
