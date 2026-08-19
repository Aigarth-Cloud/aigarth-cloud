# Phase 17 — Material Science Intelligence ANN use case delivery report

> File matches the dashboard's `phase-N-delivery` slug pattern. URL:
> `/deliveries/phase-17-delivery`.

**Phase:** 17 — Material Science Intelligence ANN (use case evaluation)
**Sprint:** Phase 0 only — documentation, no code in production
**Date:** 2026-08-02

---

## What shipped

Triggered by the **"Aigarth Cloud Material Science Intelligence ANN Use
Case Evaluation"** proposal: a coordinator-based approach to material
discovery where a small Research Director ANN plans the workflow, then
Literature, Simulation, Physics, Design, Optimization, Experiment, and
Validation ANNs do their part.

We did not build a material discovery platform. We built **the
foundation** to decide whether to build one, and to start collecting
interest while the engineering work begins.

### Artifacts (5)

| Artifact | Path | Status |
| --- | --- | --- |
| Architecture evaluation | `docs/use-cases/material-science-eval.md` | Final, ~5,500 words, 8 sections |
| Blog article | `docs/use-cases/material-science.md` | Final, ~3,200 words, plain English |
| Dashboard `/material-science` page | `apps/dashboard/src/app/material-science/page.tsx` + `components/pages/material-science.tsx` | Live at `localhost:4000/material-science` |
| Marketing use case page | `apps/web/app/(marketing)/use-cases/material-science/page.tsx` | Live at `localhost:3003/use-cases/material-science` |
| Blog index update | `apps/web/app/(marketing)/blog/page.tsx` | New post on top (Aug 2, 2026) |

### Tracker (1 phase + 13 tasks + 2 docs)

- `phase-17` "Material Science Intelligence ANN" inserted, `in_progress` at
  25% (Phase 0 is done; Phases 1–4 are backlog).
- 13 tasks: 5 done (the Phase 0 deliverables), 8 backlog (Phases 1–4
  implementation tasks).
- 2 docs upserted into the docs table.

### Links

- Dashboard: <http://localhost:4000/material-science>
- Doc (eval): <http://localhost:4000/docs/use-case-material-science>
- Doc (blog): <http://localhost:4000/docs/use-case-material-science-blog>
- Delivery: <http://localhost:4000/deliveries/phase-17-delivery>
- Marketing: <http://localhost:3003/use-cases/material-science>
- Blog index (new post on top): <http://localhost:3003/blog>

---

## Architecture compatibility verdict

| Dimension | Score | Verdict | Gap |
| --- | --- | --- | --- |
| ANN compatibility | 8/10 | Extend | Add `material_domain` enum, `material_knowledge_nodes` + `_edges`, `material_predictions` + `_validation_results` + `_feedback_events` |
| Compute architecture | 6/10 | Extend | Add 8 new compute kinds, `compute_simulation_results` table, `input_deck_hash` caching, capability-tagged workers with GPU counts |
| Continuous learning | 5/10 | Greenfield | Add 3 new tables for per-prediction provenance + validation + feedback. Material science adds uncertainty calibration + negative feedback as first-class signals. |
| Qubic integration | 9/10 | Blocked | On-chain ANN ownership, worker registry, reputation, rewards, and the new `discovery_attribution` contract. Same K12 signature verification blocker as Phase 16. |

**The proposal is well-aligned with the current architecture — and
arguably *better* suited to Qubic than video.** Qubic's
`outsourced-computing` contract is designed for exactly this kind of
work: distributed simulation compute, paid per job, attested on chain.

**The largest single architectural risk is the cost story.** A
"find a new battery cathode" workflow is **~52 QU**, dominated by
DFT refinement at **87%** of the total. The platform can support it,
but the cost must be visible to the user *before* they commit — not
after. Per-stage pre-flight estimates, per-stage credit deduction,
MLIP surrogates, and input-deck caching are not optional. They are
the difference between a useful product and a $1,000 surprise.

**The largest external blocker is still K12 signature verification.**
This is shared with the Phase 16 (video) use case. The fix is small
(~3 SP using `@noble/curves`, already a dep). It blocks the on-chain
portion of every Qubic-integrated use case; solving it once unlocks
both.

---

## Required changes (concise)

### Schema

- `services/ann`:
  - Add `material_domain` enum to `anns` (battery, alloy, polymer, catalyst, semiconductor, coating, composite, pharmaceutical, generic)
  - Add `material_knowledge_nodes` + `material_knowledge_edges` (knowledge graph)
  - Add `material_predictions` (per-prediction provenance + uncertainty)
  - Add `material_validation_results` (experimental + literature validation)
  - Add `material_feedback_events` (positive + negative + cross-ANN corrections)
- `services/compute`:
  - Extend `jobs.kind` enum with 8 new kinds (lit_ingest, dft_relax, md_run, mlip_predict, design_generate, optimize_pareto, experiment_plan, validation_compare)
  - Add `compute_simulation_results` table (trajectories, logs, structures, determinism checks)
  - Add `input_deck_hash` column on `jobs` (caching)
- `services/marketplace` (additive):
  - Add `kind = 'research_pipeline'` listing type for pre-composed workflows

### Endpoints (services/ann)

- `GET /v1/materials/anns` — list ANNs filtered by material_domain
- `GET /v1/materials/anns/:slug` — retrieve (includes material_domain)
- `POST /v1/materials/knowledge/nodes` — add a node
- `GET /v1/materials/knowledge/nodes/:id`
- `POST /v1/materials/knowledge/edges` — add an edge
- `GET /v1/materials/knowledge/nodes/:id/edges`
- `POST /v1/materials/predictions` — record a prediction
- `GET /v1/materials/predictions` — list
- `GET /v1/materials/predictions/:id`
- `POST /v1/materials/predictions/:id/validate`
- `GET /v1/materials/predictions/:id/validations`
- `POST /v1/materials/feedback` — attach a feedback event
- `GET /v1/materials/feedback/ann/:id` — rollup
- `GET /v1/materials/feedback/prediction/:id` — for a specific prediction

### Endpoints (services/compute)

- Same as Phase 16:
  - `POST /v1/workers` (register with capabilities + GPU)
  - `GET /v1/workers`
  - `POST /v1/workers/:id/heartbeat`
  - `POST /v1/jobs/next` (long-poll, capability-matched)
  - `POST /v1/jobs/:id/progress`
  - `POST /v1/jobs/:id/complete`
- New for material science:
  - `GET /v1/simulations/cache-lookup?input_deck_hash=X` — is there a cached result?
  - `POST /v1/simulations/:job_id/verify` — re-run + compare (for determinism)
  - `GET /v1/simulations/:job_id/artifacts` — list artifact URLs

### SDK (packages/sdk)

- `client.materials.anns.list({ material_domain })`
- `client.materials.knowledge.{addNode, addEdge}`
- `client.materials.predictions.{create, validate}`
- `client.materials.feedback.create`
- `client.compute.simulations.cacheLookup`

### Apps

- Dashboard `/material-science` page ✅ (this phase)
- Marketing `/use-cases/material-science` page ✅ (this phase)
- Blog index post on top ✅ (this phase)
- New customer dashboard page `/dashboard/research` (Phase 1) — research question
  input + structured answer with citations

---

## Implementation strategy

Five phases. Re-evaluation gate at the end of Phase 1.

- **Phase 0 — Documentation (this phase, 25% complete, 10 SP).**
  Evaluation, blog, dashboard, marketing, tracker. ✅
- **Phase 1 — Knowledge prototype (next, ~16 SP).** Schemas +
  Literature + Research Director ANNs + research-assistant UI +
  1,000-paper ingestion. Re-evaluation gate.
- **Phase 2 — Simulation integration (~31 SP).** 8 new compute kinds,
  `compute_simulation_results`, simulation worker images, end-to-end
  "find a battery cathode" workflow.
- **Phase 3 — ANN marketplace (~8 SP).** Publish 8 ANNs as listings,
  `material_ann_quality` rollup with uncertainty calibration,
  per-ANN quality ranking.
- **Phase 4 — Distributed research network (~19 SP).** K12 verification
  first (precondition, shared with Phase 16), then on-chain contracts
  + the new `discovery_attribution` + daily rollups + rewards.

Total estimated: **~84 SP** across 5 phases.

---

## Risks (top 3, full list in the eval doc)

1. **Cost is brutal — DFT is hours-to-days, full workflows are ~52
   QU.** Mitigation: per-stage pre-flight estimates, MLIP surrogates
   before DFT, input-deck caching, reservations, cancel + partial
   refund.
2. **Scientific correctness is non-negotiable.** Mitigation: Physics
   Reasoning ANN as a sanity checker, uncertainty quantification on
   every prediction, conservative defaults, never auto-publish.
3. **K12 signature verification is still TODO** — blocks Phase 4
   entirely. Mitigation: ship K12 verification first as a 3-SP
   precondition task. Shared with Phase 16.

---

## ⏱ Time-to-Ship

| Step | Time | Notes |
| --- | --- | --- |
| Read existing dashboard patterns + register scripts (reuse from Phase 16) | ~3 min | Consistency check |
| Write architecture evaluation doc | ~12 min | 8 sections, 4 dimensions, 8-row risk register, 9-row cost model |
| Write blog article (10-page, plain English) | ~6 min | 8-role specialist team framing, no abstract nouns |
| Build `/material-science` dashboard page (8 components, 1 client view) | ~15 min | 8-role grid (2x4), 4-dim matrix, 5-phase roadmap, cost table, risk register |
| Build `/use-cases/material-science` marketing page + blog index update | ~6 min | Hero + 7 sections + new post on top |
| Write `register-material-science-use-case.ts` (Phase 17 + 13 tasks + 2 docs) | ~4 min | Idempotent INSERT/REPLACE + upsert, 4 activity logs |
| Write `register-material-science-delivery.ts` (delivery doc + mark task done) | ~1 min | |
| Run scripts + verify in DB + dedupe-docs | ~3 min | |
| Write delivery report | ~5 min | This doc |
| **Total** | **~55 min** | **~13 SP** |

**SP velocity:** ~4.2 min/SP. Faster than Phase 16 (~7.3 min/SP) and
in line with the recent mean (~4.6 min/SP). The Phase 16 video
template absorbed most of the design work; this run is primarily
content adaptation.

### Velocity table (selected phases)

| Phase | Time | SP | min/SP | Notes |
| --- | --- | --- | --- | --- |
| Phase 0 | ~110 min | 33 | 18 | Baseline (monorepo bootstrap) |
| Phase 5 | ~145 min | 24 | 6.0 | Schema ramp-up (29-col `anns` table) |
| Phase 8 | ~135 min | 28 | 4.8 | SDK + CLI + sample app |
| Phase 9 | ~180 min | 38 | 4.7 | apps/web wiring |
| Phase 16 | ~95 min | 13 | 7.3 | First use-case eval (docs + dashboard + tracker, no code) |
| **Phase 17** | **~55 min** | **~13** | **~4.2** | **Second use-case eval — reused Phase 16 template** |
| **Running total** | **~1,325 min** | **~271 SP** | **~4.9 avg** | **13 phases** |

---

## Open items / carry-forward

- **Real K12 signature verification** — single hard blocker for Phase 4,
  shared with Phase 16. Implement using `@noble/curves` (already a
  dep). ~3 SP. Solve once, reuse.
- **TCP Qubic client** — secondary blocker for live Qubic RPC. HTTP
  gateway works today.
- **Worker container images** — `aigarth/worker-dft` (VASP, Q-E),
  `aigarth/worker-md` (LAMMPS, GROMACS), `aigarth/worker-mlip`
  (MACE, Allegro) — not yet built. VASP alone is a many-hour build
  and requires a license.
- **Open data licensing** — Materials Project, OQMD are CC-BY;
  commercial use is unclear. Provenance tracking on every artifact
  is the mitigation; partner with a research lab that has clarified
  licensing for the first real workload.
- **Re-evaluation gate at end of Phase 1** — committed in the
  roadmap. If 1,000 papers cannot be ingested and a research
  question answered in < 5 minutes, the proposal is paused.

---

## Hard-won lessons from this pass

- **The Phase 16 template is genuinely reusable.** The structure
  (eval doc → blog doc → dashboard page → marketing page → tracker
  registration → delivery doc) maps directly to every use-case
  evaluation. We shaved ~40 minutes off the Phase 16 time by
  reusing the patterns, the look-and-feel, and the script shapes.
  Total cost: ~55 minutes. Total saved: weeks of deciding what to
  build and how to show it.
- **Use-case evaluations should be a series, not a one-off.** Phase
  16 (video) and Phase 17 (material science) both yielded the same
  4-dimension compatibility verdict, the same K12 blocker, the same
  greenfield continuous-learning gap. This is a *pattern* — it
  tells us that the platform's "shape" is right for specialized
  intelligence across very different domains, and that the
  remaining gaps (continuous learning, on-chain attribution) are
  universal. A future use case (drug discovery, climate modeling,
  financial research) can reuse the template *and* the verdicts.
- **The cost story is a feature, not a bug.** For material science
  the cost story is harder than video (~52 QU vs ~1.16 QU). The
  *honest* approach — per-stage pre-flight estimates, surrogate-first
  routing, visible total cost before commit — is what makes the
  product trustworthy. A user who is told "this workflow will cost
  ~52 QU, dominated by DFT refinement, here is the breakdown" is
  making an informed choice. A user who finds out at the end is
  furious. The platform has to be on the right side of that line.
- **A `discovery_attribution` contract is a meaningful new
  primitive.** It is not in the video proposal; it is a
  material-science-specific addition. Once a discovery is published,
  the attribution is fixed on chain — and that *immutability* is
  what makes it useful as a citation in a real research paper.
  This is a candidate for a Phase 4 primitive that other
  high-stakes use cases (drug discovery, clinical trials) could
  reuse.

---

## Decision

**Proceed to Phase 1 (knowledge prototype) on a 4-week timeline.**

Re-evaluate at the end of Phase 1 with 1,000 ingested papers and a
research question answered in < 5 minutes, with structured property
values and citations.

If Phase 1 passes, the architecture has proven itself for the
*knowledge* half of material science and we commit to Phase 2
(simulation) with honest numbers. If not, the prototype becomes an
internal tool, the architecture stands, and the rest of the
platform is unaffected.

*End of Phase 17 delivery report.*
