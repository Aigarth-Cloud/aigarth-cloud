# Aigarth Cloud Evolution PEP — Executive Summary

> Short summary of the full Product Evolution Proposal. Read this first.
> Full document: [`aigarth-cloud-evolution-pep.md`](./aigarth-cloud-evolution-pep.md) (~38 min)
> Roadmap impact: [`aigarth-cloud-evolution-pep-roadmap-impact.md`](./aigarth-cloud-evolution-pep-roadmap-impact.md) (~5 min)

---

## What we keep

Everything shipped in Phases 0-24. Specifically:

- **Trinary Intelligence Layer** (Phase 18) — `@aigarth/trinary` package, `services/tissue` (port 7008), 5 consensus policies, signed envelopes. **This is already the "Tissue" primitive the conversation asks for**, but for ANN composition, not evolution.
- **Training Orchestration** (Phase 19) — `services/training` (port 7011), 5 training recipes (incl. `trinary_classifier`), real LLM invocation in 19C.3, auto-publish to ANN, decision outcome tracking, auto-retrain, A/B shadow deployment, predicted-vs-actual UI.
- **Datasets** (Phase 19B) — first-class datasets, schema sniff, public catalog, connectors, SDK resource.
- **AigarthPool** (Phase 20) — on-chain settlement, QPI contract + TypeScript simulator, 30/60/10 default split.
- **Multi-sig Treasury** (Phase 22), **Pre-mainnet gates** (Phase 23), **Hardware Presale** (Phase 24).
- **Phase 17 Material Science** — 8-ANN coordinator already designed and evaluated. The 8-role specialist team (Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation) is **the same architecture the conversation calls "Materials Brain."**

## What we add

| Phase | What | Why | SP |
|---|---|---|---|
| 26 | **Organism primitive** (genome, environment, fitness, lineage) | The genuine new layer. ANNs are cells, Tissues are organs, Organisms are bodies. The conversation's "growing intelligence" claim requires a stateful, evolvable, lineaged primitive that doesn't exist today. | ~10 |
| 27 | **Work Runtime** (Tier 1, local) | The substrate for distributed, verified work. Work item envelope, scheduler, verifier (replication + challenge + reputation), accountant, billing hook. First algorithm: `awork-1` (a deterministic numerical benchmark). | ~12 |
| 28 | **Federated Work Runtime** (Tier 2) | Multiple Aigarth deployments share work via signed RPC. | ~8 |
| 29 | **Qubic OC Processor** (Tier 3) | Aigarth registers as an OC processor. Qubic smart contracts invoke Aigarth for off-chain work. 451/676 computor signature is the trust root. | ~6 |
| 30 | **Multi-workload Work Runtime** (Tier 4) | Multiple workload types in one scheduler. Cross-workload economic balance. | ~10 |
| 31 | **Neuraxon Runtime Integration** | `neuraxon_classifier` training recipe; sandboxed worker; GPU via cuNxon. | ~8 |

## What we kill

- "Universal mining algorithm" — not what Qubic provides
- "Dynamic switching between mining algorithms" — not Qubic's design, out of Aigarth's control
- "Outsourced Computing as a compute marketplace" — OC is outbound, not inbound; Aigarth is the *processor*, not the *renter*
- "Replace ANN with Neuraxon" — Neuraxon is not production-ready; the Trinary envelope is the contract, Neuraxon can be a backend
- "Google Play Store for artificial organisms" — wrong scope
- "LLM-in-the-loop as the substrate" — the fitness function is deterministic; LLMs are hints, not the substrate
- ZK proofs, TEE attestation, staking/slashing in v1 — earn the right by demonstrating MVP fails first
- "Aigarth invents a new tire compound" — not a deliverable; the deliverable is the *loop*

## Five critical corrections to the conversation thread

1. **The Tissue primitive already exists** (Phase 18, live). It composes ANNs into a signed decision. The conversation's "Tissue primitive" claim is already built.
2. **Neuraxon 2.0 is NOT integrated in any Aigarth service.** Per ADR 003: "Neuraxon v2.0 is a research paper (not deployed)... Aigarth is described in §8 of the paper as a separate framework that would be hybridized with Neuraxons in a 'Neuraxon-ITU.' That hybridization has not happened." Treat Neuraxon as a research target, not a dependency.
3. **Qubic OC is OUTBOUND.** Smart contracts send authorized instructions to external systems. Aigarth would register as an OC *processor*, not call Qubic for compute. The 451/676 computor signature bundle is the trust primitive.
4. **BPP-9000 is the current uPoW** (Epoch 224, late July 2026). It is *one* algorithm, not a precedent for "heterogeneous useful mining." The "Universal Useful Work Protocol" idea is a genuine Aigarth R&D project, not a Qubic integration.
5. **Materials Science is already designed.** Phase 17's 8-ANN coordinator is the same architecture the conversation calls "Materials Brain." The 8 tissues (Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation) are already proposed. We build on Phase 17, not duplicate it.

## The Aigarth Thesis

Aigarth is a platform for **growing useful computational intelligences**. The Organism is the new primitive: a stateful, evolvable, lineaged computational identity that lives in an environment, has a fitness function, retains episodic memory, and can reproduce. The Work Runtime is the substrate for distributed cognition. The first organism is TireMind-001, researching non-pneumatic, recyclable tire materials. The killer demo is a candidate material with a measured fitness curve, not a chatbot.

The platform is not a "neural network marketplace." It is a laboratory, a nervous system, and an ecosystem for growing intelligence. Qubic is the trust root, not the UI. The Trinary envelope is the contract. Neuraxon is one possible substrate among several.

## The first 10 engineering tasks

All concrete, all sized to one sprint, all startable immediately:

1. Schema migration for `organisms` (1 SP)
2. Organism CRUD routes (2 SP)
3. Lineage and fitness history routes (1.5 SP)
4. Episodic memory + manual mutation (2 SP)
5. Organism marketplace listing (2 SP)
6. Garden Organism view (UI) (2 SP)
7. Work Runtime skeleton (2 SP)
8. Work Runtime scheduler (2 SP)
9. Work Runtime verifier + accountant (2 SP)
10. First algorithm: `awork-1` + TireMind scaffolding (1.5 SP)

**Total: ~25 SP = 2-3 sprints at recent velocity (~19 min/SP).**

The decision: approve Phase 26 (Organism) + Phase 27 (Work Runtime) as the next two phases. Defer Phases 28-31 pending Phase 27 success.

---

See [`aigarth-cloud-evolution-pep.md`](./aigarth-cloud-evolution-pep.md) for the full engineering specification.
