---
title: "Your first ANN — build, train, deploy"
date: 2026-08-09
author: Aigarth DevRel
tags: [tutorial, ann, training, deployment, trinary]
difficulty: beginner
estimatedMinutes: 25
runnable: true
---

# Your first ANN — build, train, deploy

This tutorial builds the smallest useful ANN on Aigarth Cloud end
to end. By the end you'll have a working trinary decision ANN,
deployed to a cluster, answering real `/v1/anns/:id/decide`
requests with signed IntentEnvelopes.

## What you'll build

A "spam-vs-ham" classifier with the trinary protocol:

- `+1` → proceed (looks like ham)
- `0`  → continue observing (uncertain)
- `-1` → block (looks like spam)

Three states, signed, replayable. Not a fuzzy score, not a
probability distribution — a decision and a signature.

## Step 1 — create the ANN

The fastest path is the **Train from recipe** flow in the studio
at `http://localhost:3003/studio/anns/new`.

1. Pick a name. Anything.
2. Pick a category. **Text** is the right choice for this tutorial.
3. Pick the **Text classifier (small)** recipe. It's the
   trinary-tuned version of the Phase 19C recipe catalog.
4. Hit **Create**.

The studio builds the ANN shell (with the trinary
`DecisionProtocol` set) and routes you to the training page.

## Step 2 — train

The studio auto-routes you to **Train**. Hit **Start training**.

What happens under the hood:

1. The studio POSTs `/v1/training/jobs` on `services/training`
   (port 7011).
2. The training service picks the recipe + a small synthetic
   dataset (200 examples of "spam" / "ham" strings — seeded by
   the recipe itself; no external data needed for this tutorial).
3. The job runs in `services/training`'s worker pool. The
   `services/compute` bridge (Phase 19C.4) allocates a stub
   capacity slot.
4. The studio's **Training queue** widget (Phase 19C.5) shows
   live progress over SSE.
5. On success, the training service auto-publishes a new ANN
   version (Phase 19C.6) and bumps the version on the registry.

Training takes about 2 minutes on a laptop. You'll see the SSE
stream tick up in real time.

## Step 3 — deploy

Once the version is published, the studio routes you to
**Deploy**.

1. Pick a cluster. The default is `local-stub` — fine for this
   tutorial.
2. Hit **Deploy**.

The deploy flow:

- POSTs `/v1/compute/deployments` on `services/compute` (port 7003).
- The compute service allocates a cluster slot.
- The deploy becomes `running` within a few seconds.

You'll see the deployment on the ANN detail page with a green
"running" pill.

## Step 4 — call it

From the ANN detail page, click **Try it**. The studio POSTs to
the gateway's chat-completions endpoint with
`response_format: "trinary"`. You'll get an IntentEnvelope back:

```json
{
  "decision": "+1",
  "confidence": 0.91,
  "reasons": ["low-keyword-density", "no-link-pattern"],
  "signature": "K12:...",
  "ann_id": "...",
  "version_id": "..."
}
```

Three fields, signed, replayable. That's the trinary protocol.

## Step 5 — submit outcomes

The whole loop only closes when the world tells the ANN what
happened. From the ANN detail page's **Decisions** tab, click a
decision and mark it `accepted` or `overridden`. That's the
Phase 19D.1 outcome — the input the auto-retrain trigger
(Phase 19D.2) reads from to decide when to retrain.

## Next steps

- Read [TRD 003 — Trinary protocol v1](../architecture-decisions/003-trinary-protocol-v1.md)
  for the protocol spec.
- Try the [A/B shadow deployment](../deliveries/phase-19d-delivery.md)
  walkthrough to ship a v2 alongside v1.
- Wire your ANN into a tissue: [tissues by example](../guides/trinary-intelligence.md).
