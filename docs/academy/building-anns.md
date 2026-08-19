---
title: "Building ANNs"
difficulty: intermediate
estimatedMinutes: 120
description: "A curated 4-lesson path through the ANN builder, training orchestrator, deployment model, and feedback loops. By the end you'll know how to ship a versioned, monitorable, auto-retrain-capable ANN on Aigarth."
lessons: ../../docs/architecture-decisions/003-trinary-protocol-v1.md, ../../docs/deliveries/phase-19c-training-delivery.md, ../../docs/deliveries/phase-19d-delivery.md, ../../docs/guides/trinary-intelligence.md
---

# Building ANNs

This path is the second one most builders take. It assumes you've
already read the [Getting Started path](./getting-started.md) and
want to go deeper on the ANN surface specifically.

## Who this is for

- ANN creators about to ship their first version
- Engineers responsible for keeping a deployed ANN healthy
- Anyone who needs to understand the trinary protocol spec
  before they can read the rest of the platform

## How to use it

Read in order. The first two lessons are spec; the third is the
operations model; the fourth is the runtime walkthrough.

## The lessons

1. **Trinary protocol v1** (ADR 003) — the protocol that turns
   every ANN from a "best-guess generator" into a signed, trinary
   decision-maker. 12 min.
2. **Phase 19C — Training Orchestration delivery** — the wiring
   around the real LLM invocation. 18 min.
3. **Phase 19D — Feedback Loops delivery** — the outcome
   tracking, the auto-retrain trigger, the A/B shadow
   deployment. 14 min.
4. **Trinary Intelligence walkthrough** — a guided tour of the
   runtime, from `/decide` to signed IntentEnvelope to
   tissue-level composition. 9 min.

## What to do next

- Wire your trained ANN into a tissue: [tissues by example](../guides/trinary-intelligence.md).
- Read the [AigarthPool contract spec](../aigarthpool/contract.md)
  to see how stake-weighted reward distribution works.
- Take the [Your first ANN tutorial](../tutorials/first-ann.md)
  end to end — it's the 25-minute hands-on version of this path.
