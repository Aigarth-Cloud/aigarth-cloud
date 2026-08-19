# Aigarth Cloud Evolution PEP — Roadmap Impact

> Companion to the full PEP. Maps the proposed changes to existing phases and the proposed Phase 26-31.
> Full document: [`aigarth-cloud-evolution-pep.md`](./aigarth-cloud-evolution-pep.md)
> Executive summary: [`aigarth-cloud-evolution-pep-summary.md`](./aigarth-cloud-evolution-pep-summary.md)

---

## Existing phases preserved (no changes)

| Phase | Status | What it does | How the PEP relates |
|---|---|---|---|
| 0-15 | Live | Foundation, identity, Qubic, billing, ANN, marketplace, gateway, dev platform, dashboard, genesis, hardware, enterprise, observability, governance, knowledge | Untouched. The PEP is additive. |
| 17 | Phase 0 done | Material Science 8-ANN coordinator design + marketing pages | The PEP **builds on** Phase 17. The Organism primitive (Phase 26) will be the runtime that runs the 8-ANN coordinator as a stateful, evolvable system. |
| 18 | Live | Trinary Intelligence Layer (envelope, tissue service) | The PEP **extends** this. Stateful Tissue (per-organism) and Tissue-as-organ are additive. |
| 19A-D | ~92% | Garden UX, Datasets, Training Orchestration, Feedback loops | The PEP **consumes** the training service, the dataset service, the predicted-vs-actual UI. The Organism's training recipe is `trinary_classifier` (already exists) or `neuraxon_classifier` (Phase 31). |
| 20 | 5/6 done | AigarthPool on-chain settlement | Untouched. Future use: lineage attestation on chain (Phase 29). |
| 21 | Done | MetaMask Qubic snap | Untouched. |
| 22-23 | Done | Multi-sig treasury, pre-mainnet gates | Untouched. |
| 24 | Done | Hardware node presale | Untouched. |

## Proposed phases (Phase 26-31)

| Phase | What | Depends on | SP | Demo |
|---|---|---|---|---|
| **26** | Organism Primitive (schema, CRUD, lineage, fitness, memory, marketplace, Garden UI) | Phase 19 (training) | ~10 | "TireMind v0 → v3" with measured fitness curve |
| **27** | Work Runtime — Tier 1 (local) | Phase 26 (organism) | ~12 | "Aigarth Evolution Run #001" — 1,000 generations, 1M work items, measured cost |
| **28** | Federated Work Runtime — Tier 2 | Phase 27 | ~8 | "Aigarth Federation #001" — 3 deployments, 100 workers |
| **29** | Qubic OC Processor — Tier 3 | Phase 28, AIO Dev Kit | ~6 | "Qubic smart contract invokes TireMind; Aigarth returns 3 DFT results; Qubic records the attestation" |
| **30** | Multi-workload Work Runtime — Tier 4 | Phase 29 | ~10 | "TireMind + ClimateMind + DrugMind on the same Work Runtime" |
| **31** | Neuraxon Runtime Integration | Phase 30, Neuraxon maturity | ~8 | "TireMind tissue v0 trained on Neuraxon vs transformer; benchmark delta" |

**Total proposed: ~54 SP** = 5-6 sprints at recent velocity. Spans roughly 6-9 months at the recent cadence.

## What it adds to the platform surface

- 1 new primitive: **Organism** (alongside ANN, Tissue)
- 1 new service: **`services/work`** (port 7012 proposed)
- 1 new package: **`@aigarth/oc-processor`**
- 1 new training recipe: **`neuraxon_classifier`** (Phase 31)
- 1 new Garden view: **`/dashboard/garden/organism/[slug]`** (Phase 26.D)
- 3 new ADRs: **005 Organism Primitive**, **006 Work Runtime**, **007 OC Processor**
- New marketplace surface: **Organism listings** (lineaged, versioned, fitness-scored)

## What it defers (NOT in the engineering roadmap)

These go in the Research Backlog (§23 of the full PEP). They are explicitly **not** promised in 2026-2027.

- "Universal Useful Work Protocol" as a Qubic consensus change
- TEE attestation (SGX/SEV) for workers
- ZK proofs for arbitrary work
- Staking + slashing for workers
- Multi-organism symbiosis (organisms share tissue libraries)
- On-chain lineage attestation in Phase 26 (deferred to Phase 29)
- Replacing the Trinary envelope with a Neuraxon-native envelope (the Trinary envelope IS the contract; Neuraxon can be a backend)

## What it kills

These ideas are explicitly **not** pursued:

- "Replace Aigarth's ANN primitive with Neuraxon"
- "Universal mining algorithm" (misnomer for what Qubic provides)
- "Outsourced Computing as a compute marketplace" (it's outbound, not inbound)
- "Aigarth invents a new tire compound" (the deliverable is the *loop*, not a product)
- "Build a Google Play Store for artificial organisms" (wrong scope)

## The decision needed

**Approve Phase 26 (Organism Primitive) and Phase 27 (Work Runtime) as the next two engineering phases.**

- Phase 26 begins after the current Phase 19 closeout delivery report ships
- Phase 27 begins after Phase 26.A (CRUD) ships; the Work Runtime skeleton (27.A) can be parallelized with 26.B-C
- Phases 28-31 are deferred pending Phase 27 success
- All decisions recorded in new ADRs (005, 006, 007)
- All deliverables follow the Time-to-Ship standard (active build time, SP velocity, breakdown, comparison)

## Impact on existing commitments

- **Year 1 targets from PRD §7:** unaffected. The PEP is additive; the existing 16-phase roadmap continues to ship.
- **Materials Science flagship:** accelerated. Phase 17's backlog (Phases 1-4) is unblocked by Phase 26 (the Organism primitive).
- **Video Generation use case:** deferred to Phase 30+. Materials Science is the flagship.
- **ANN marketplace (Phase 6):** unaffected. The new Organism listing type extends the marketplace, not replaces it.
- **Genesis / IPO / Hardware presale:** unaffected.

## Risk summary

Top three risks (full register in §24 of the PEP):

1. **Neuraxon is not production-ready when we need it** — mitigation: treat as research target, not dependency. Phase 31 is contingent.
2. **Work Runtime is gamed by collusion** — mitigation: reputation decoupled from creator; cross-deployment replication (Phase 28); challenge tasks; eventual ZK proofs in Tier 4.
3. **TireMind's DFT cost surprises users** — mitigation: per-stage pre-flight estimates (already flagged in Phase 17 eval); per-stage credit deduction; MLIP surrogates.

**Critical shared blocker (already known):** K12 signature verification (~3 SP using `@noble/curves`). Solving it once unlocks the on-chain portion of every Qubic-integrated use case (Phases 16, 17, and the future OC integration in Phase 29).

## Links

- Full PEP: [`aigarth-cloud-evolution-pep.md`](./aigarth-cloud-evolution-pep.md)
- Executive summary: [`aigarth-cloud-evolution-pep-summary.md`](./aigarth-cloud-evolution-pep-summary.md)
- Phase 17 Material Science evaluation: [`../use-cases/material-science-eval.md`](../use-cases/material-science-eval.md)
- ADR 003 — Trinary Protocol v1: [`../architecture-decisions/003-trinary-protocol-v1.md`](../architecture-decisions/003-trinary-protocol-v1.md)
- Phase 18 launch: [`../launches/phase-18-trinary-launch.md`](../launches/phase-18-trinary-launch.md)
- ROADMAP.md: [`../../ROADMAP.md`](../../ROADMAP.md)
