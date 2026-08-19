---
title: "Use case — Aigarth Cloud as a collaborative ANN lab for material science"
description: "A specialized-intelligence approach to material discovery, where 8 small ANNs (Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation) collaborate to plan, predict, and validate new materials — without replacing the scientist."
author: "Aigarth Cloud"
date: "2026-08-02"
readTimeMinutes: 24
category: "Use cases"
status: "final"
---

# Use case — Aigarth Cloud as a collaborative ANN lab for material science

*How a team of small, specialized AIs can help a materials research lab
discover new materials faster — without trying to replace the scientists.*

---

## The problem with how material science works today

Finding a new material is slow. The traditional workflow looks like this:

1. A research question. *"Find a battery cathode that holds more charge
   and costs less to manufacture."*
2. Months of literature review — read the papers, see what others have
   tried, identify gaps.
3. A hypothesis. *"Maybe a manganese-rich layered oxide."*
4. Months of simulation — run the structure through DFT, see if it
   holds together, check the predicted energy.
5. More months of physical experiment — synthesize the material, build
   a battery, test it.
6. Analyze. Iterate. Go back to step 2.

This can take **years** for a single material. And most of the time,
the hypothesis is wrong, and the iteration starts over.

It does not have to be this slow. The pieces of the workflow are
already there: papers exist, simulation tools exist, experimental
methods exist. What is missing is a *coordinator* — a way to glue
all the pieces together so each step builds on the last one, the
feedback from the experiment actually updates the next prediction,
and the literature is checked instead of assumed.

Aigarth is a platform built for that kind of coordinator. The same
architecture that lets a Director ANN plan a video, a Camera ANN
pick the angle, and a Quality ANN keep it honest — can let a
Literature ANN read the papers, a Simulation ANN run the DFT, a
Physics ANN check the answer, and a Validation ANN update the
scoreboard.

The goal is not to replace scientists. The goal is to give scientists
a tool that reads the papers faster, runs the simulations in the
background, and tells them which experiments are most likely to
succeed.

---

## The proposal in one sentence

Instead of one general "AI for science" model, build a **research
collaborator** that hands off a research question to a team of
small, specialized AIs — each one excellent at exactly one part of
the discovery workflow.

---

## Meet the team

Picture a small materials research lab. Every lab has the same
roles. What if each of those roles was its own AI, living in
Aigarth Cloud as a published "ANN" (an Artificial Neural Network —
our term for any AI module on the platform)?

| Role | What it does |
| --- | --- |
| **Research Director ANN** | Reads the research question, plans the workflow. *"To find a new battery cathode, we need: 30 papers on layered oxides, 100 candidate structures, DFT relaxation, a Pareto sort."* |
| **Literature ANN** | Ingests scientific papers. Extracts composition, property values, measurement method, citation. Builds a knowledge graph the other ANNs can query. |
| **Simulation ANN** | Runs the actual science. DFT relaxation (VASP, Quantum ESPRESSO), molecular dynamics (LAMMPS, GROMACS), or fast ML surrogates (MACE, Allegro). Knows which engine to use and when. |
| **Physics Reasoning ANN** | Sanity-checks predictions against first principles. Catches the case where the DFT result is numerically wrong, or where the candidate structure is physically impossible. |
| **Material Design ANN** | Generates candidate materials. New alloys, new polymers, new battery cathodes. The output is a structure + a predicted property. |
| **Optimization ANN** | Finds the best tradeoff. Maximum energy density, minimum cost, minimum environmental impact. Multi-objective Pareto. |
| **Experiment Planning ANN** | Converts a candidate material into a lab protocol. *"Synthesize by solid-state reaction at 950 °C for 12 h. Characterization by XRD, SEM, galvanostatic cycling."* |
| **Validation ANN** | Compares predictions against reality. Cross-checks the prediction against the literature. Logs the result so the next iteration starts from a better baseline. |

Each of these is **small**. Each can be trained, fine-tuned, or
replaced independently. Each is published on the Aigarth ANN
marketplace, versioned like software, and rated by researchers.

This is not a new idea. Labs have always worked this way — chemists
specialize in molecules, physicists specialize in theory, engineers
specialize in applications. The question is whether a software
platform can be built that lets a research lab *compose* this team
for a particular kind of material, and then rent the team out to
other labs.

---

## Why this fits Aigarth's vision

Aigarth Cloud was designed around a few core ideas:

- **Specialized intelligence, not one model to rule them all.** A
  small ANN that is excellent at one thing is cheaper to run, easier
  to improve, and easier to trust than a giant model that is OK at
  everything.
- **Marketplace for ANNs.** A platform where ANNs are listed,
  rated, sold, and re-used. The Battery Cathode Design ANN lives
  next to the Alloy Design ANN. The Perovskite Literature ANN is
  authored by a researcher in Zurich and used by a lab in Tokyo.
- **Feedback that improves the system.** When an experiment
  disproves a prediction, that is *more* valuable than a positive
  result — it tells the platform which ANNs to trust less. Aigarth
  captures that feedback, attributes it to the right ANN, and uses
  it to rank ANNs in the marketplace.
- **Compute as a first-class resource.** Heavy work (DFT, MD)
  runs on workers. Aigarth schedules the work, pays the workers,
  and tracks who did what. A research lab that runs a DFT cluster
  can register it as a worker and earn QUBIC when other labs use
  it.

Material science is a perfect fit because expertise is already
divided. Aigarth mirrors that division with software. We are not
inventing a new model of research — we are giving the existing
model a platform to live on.

---

## How a research workflow actually flows

A researcher types: *"Find a low-cost, high-cycle-life cathode
for sodium-ion batteries. I want a candidate in 1 week, with a
DFT-validated energy density above 400 Wh/kg."*

Behind the scenes, the system produces a research plan — a JSON
document that describes the whole workflow:

```json
{
  "research_question": "Low-cost, high-cycle-life Na-ion cathode",
  "domain": "battery",
  "constraints": {
    "max_cost_per_kg": 12,
    "min_cycle_life": 2000,
    "min_energy_density_wh_kg": 400
  },
  "stages": [
    {
      "id": "lit",
      "name": "Literature",
      "task": "Ingest 30 most-cited Na-ion cathode papers (2020-2026)",
      "estimated_cost_qu": 0.10,
      "estimated_minutes": 5
    },
    {
      "id": "design",
      "name": "Material Design",
      "task": "Generate 100 candidate compositions (layered oxides, polyanions)",
      "estimated_cost_qu": 1.00,
      "estimated_minutes": 30
    },
    {
      "id": "dft_surrogate",
      "name": "MLIP screening",
      "task": "Run MACE on all 100 candidates, keep top 10",
      "estimated_cost_qu": 5.00,
      "estimated_minutes": 60
    },
    {
      "id": "dft_full",
      "name": "DFT refinement",
      "task": "VASP relaxation + band structure on top 10",
      "estimated_cost_qu": 45.00,
      "estimated_minutes": 6000
    },
    {
      "id": "physics",
      "name": "Physics Reasoning",
      "task": "Sanity-check predictions (formation energy, stability, synthesizability)",
      "estimated_cost_qu": 0.20,
      "estimated_minutes": 5
    },
    {
      "id": "optimize",
      "name": "Optimization",
      "task": "Pareto sort on (energy density, cost, cycle life)",
      "estimated_cost_qu": 0.10,
      "estimated_minutes": 1
    },
    {
      "id": "experiment",
      "name": "Experiment Planning",
      "task": "Generate lab protocol for the top 3 candidates",
      "estimated_cost_qu": 0.05,
      "estimated_minutes": 2
    },
    {
      "id": "validate",
      "name": "Validation",
      "task": "Cross-check top 3 against historical literature",
      "estimated_cost_qu": 0.05,
      "estimated_minutes": 1
    }
  ],
  "total_estimated_cost_qu": 51.50,
  "total_estimated_hours": 102
}
```

The researcher sees this plan *before* they commit. They can
delete a stage, add a constraint, swap in a more accurate (and
more expensive) DFT engine, or ask the system to run 1,000
candidates instead of 100. The cost is not a surprise at the end
— it is the first thing on the screen.

Once they click "Run," the workflow executes:

1. **Director** writes the plan (above).
2. **Literature** ingests 30 papers, extracts structured property
   values, populates the knowledge graph.
3. **Material Design** generates 100 candidate compositions.
4. **Simulation** runs MACE on all 100 (fast, ML surrogate), then
   VASP on the top 10 (slow, full DFT).
5. **Physics** sanity-checks every DFT result. Catches the case
   where the candidate structure collapsed during relaxation, or
   where the formation energy is impossibly low.
6. **Optimization** Pareto-sorts the survivors on
   (energy density, cost, cycle life).
7. **Experiment Planning** generates a lab protocol for the top
   3.
8. **Validation** cross-checks the top 3 against historical
   literature. *"Has anyone synthesized this composition before?
   What was the measured cycle life?"*

The researcher gets a report: the top 3 candidates, the DFT
results, the predicted uncertainty on every property, the
literature cross-references, and a lab protocol they can hand
to a graduate student.

The whole workflow is observable end to end. Every prediction is
attributed. Every failure is recorded. Every success is rated.
And if the graduate student runs the experiment 6 months from
now and the measured cycle life turns out to be 1,800 (not the
2,000 the platform predicted) — that feedback flows back, the
Simulation ANN's reputation is updated, and the next time the
researcher asks the same kind of question, the system ranks
ANNs differently.

That is the *evolutionary* part. That is what makes this not
just a workflow tool.

---

## What it costs (illustrative)

A "find a new battery cathode" workflow on a single CPU worker:

| Stage | Cost (QU) | Time | Note |
| --- | --- | --- | --- |
| Literature (30 papers) | 0.10 | 5 min | LLM call |
| Research Director (plan) | 0.05 | 1 min | LLM call |
| Material Design (100 candidates) | 1.00 | 30 min | Generative model |
| MLIP screening (MACE) | 5.00 | 60 min | 100× cheap DFT |
| DFT refinement (VASP, top 10) | 45.00 | 100 h | 10× ~10 CPU-h each |
| Physics Reasoning | 0.20 | 5 min | Rule-based |
| Optimization (Pareto) | 0.10 | 1 min | Local CPU |
| Experiment Plan | 0.05 | 2 min | LLM |
| Validation | 0.05 | 1 min | Knowledge graph |
| **Total** | **~51.55** | **~102 h** | |

These numbers are **illustrative placeholders** — they will change
as we ship and measure. The point is:

- The cost is dominated by **DFT refinement** (87% of the total).
  This is the honest story: a single material discovery is not
  cheap.
- **MLIP surrogates** (MACE, Allegro) cut the wall time by 10×
  for the screening pass. Only the top candidates pay for full
  DFT. This is the single biggest cost optimization.
- A monthly **reservation** of 1,000 QU covers ~20 cathode
  discoveries per month for a small research lab. That is a
  realistic budget.
- The cost is **visible to the user before they commit**. No
  $1,000 surprise at the end.

Material science is more expensive than video (a 30-second
video render is ~1.16 QU; a material discovery is ~52 QU).
That is real, and the platform has to be honest about it. But
the per-stage breakdown means a researcher can choose: pay for
the full DFT pass, or skip it and accept lower confidence on
the top candidates.

---

## What we have to build

Aigarth Cloud is a production-grade platform with 7 backend
services and 258 story points already shipped. The material
science use case fits on top. We don't need to rebuild — we
need to extend.

**What already works (no changes):**

- ANN registry, versioning, reviews — `services/ann`
- Marketplace listings, offers, auctions (Dutch, English,
  sealed-bid) — `services/marketplace`
- Job submission, clusters, regions, reservations, idempotency
  — `services/compute`
- LLM gateway with streaming and key-based auth —
  `services/gateway`
- Wallet link + Qubic network status — `services/qubic`
- Tracker, dashboard, marketing site, SDK with a CLI — the apps
  layer

**What we need to add:**

1. **Material domain tagging.** Add a `material_domain` enum to
   ANNs so the platform can tell a Battery Design ANN from a
   Polymer Design ANN.
2. **Knowledge graph.** A new `material_knowledge_nodes` +
   `material_knowledge_edges` table for the Literature ANN.
3. **Per-prediction provenance.** A new `material_predictions`
   table that records every prediction (which ANN, what input,
   predicted value, predicted uncertainty).
4. **Validation results.** A new `material_validation_results`
   table for cross-checking predictions against experiments
   and literature.
5. **Negative feedback.** A new `material_feedback_events`
   table that treats negative results as first-class signals
   (an experiment that disproves a prediction is *more* valuable
   than one that confirms it).
6. **Simulation result storage.** A new
   `compute_simulation_results` table for trajectories, logs,
   structures, determinism checks.
7. **Input-deck caching.** A new `input_deck_hash` column on
   `jobs` so the same simulation is never paid for twice.
8. **Capability-tagged workers.** A new
   `compute_workers` table + `/v1/workers/*` namespace. Each
   worker advertises its capabilities (`dft.vasp_relax`,
   `md.lammps_nvt`, `mlip.mace`).
9. **Worker container images.** `aigarth/worker-dft` (VASP,
   Quantum ESPRESSO), `aigarth/worker-md` (LAMMPS, GROMACS),
   `aigarth/worker-mlip` (MACE, Allegro), and the lighter
   `aigarth/worker-lit` (paper ingestion, no HPC).
10. **On-chain discovery attribution.** A new
    `discovery_attribution` contract — when a material
    discovery is published, the on-chain attribution is fixed
    immediately (not via a daily rollup).
11. **Real K12 signature verification.** Currently the Qubic
    integration is format-only. To put any of this on-chain
    safely, we need real K12 cryptographic verification first.
    (This is the single hard precondition for the on-chain
    portion. It is also the blocker for the video proposal —
    we will solve it once and reuse it.)

The total scope is small. Most of the heavy lifting is in
`services/ann` (3 new tables, 9 new endpoints) and
`services/compute` (1 new table, 1 new column, 3 new
endpoints). The worker container images are the biggest
non-code cost — VASP alone is a many-hour build.

---

## How we'd ship it — five phases

**Phase 0 — Documentation (now).** The architecture evaluation
(this article and its longer companion), the dashboard
`/material-science` page that visualizes the concept, and a
waitlist so we know who is interested. No code in production.

**Phase 1 — Knowledge prototype.** Ingest 1,000 papers. Answer
a research question in < 5 minutes with citations and
structured property values. No simulation, no blockchain. Goal:
**prove the literature and knowledge graph end to end**.

**Phase 2 — Simulation integration.** Wire up DFT, MD, and MLIP
workers. Run a "find a battery cathode" workflow end to end. A
researcher gets 3 candidate materials + a lab protocol. ~52 QU
per run, ~102 hours wall-clock on a single CPU worker.

**Phase 3 — ANN marketplace.** Publish the 8 ANNs as real
listings. Per-ANN quality ranking. Reviews and ratings flow
into the feedback table.

**Phase 4 — Distributed research network.** On-chain ANN
ownership, worker registry, reputation, rewards, and
`discovery_attribution`. Off-chain rollups commit to chain
once per day; the publish action is one-way and immediate.

**Re-evaluation at the end of Phase 1.** If we can ingest
1,000 papers and answer a research question in < 5 minutes, the
architecture has proven itself. We commit to Phase 2 with real
numbers. If not, the prototype becomes an internal tool, the
architecture stands, and we tell the use case honestly: the
pieces are real, the experience is not yet there.

---

## What could go wrong

We are honest about the risks:

- **Material science is expensive.** A single workflow is ~52 QU.
  We mitigate with per-stage pre-flight estimates, MLIP surrogates,
  input-deck caching, and pre-purchased capacity.
- **Scientific correctness is non-negotiable.** A wrong prediction
  is worse than no prediction. We mitigate with a Physics
  Reasoning ANN as a sanity checker and uncertainty quantification
  on every prediction.
- **Validation is the long pole.** Real experiments take weeks.
  We mitigate with cross-simulation validation and literature
  validation as a first pass, then experiment planning so a real
  lab can run it.
- **Workers are untrusted code.** We mitigate with Docker /
  Singularity sandboxes, no network egress except to Aigarth
  APIs, resource caps, and reputation + slashing.
- **K12 signature verification is the single hard blocker** for
  the on-chain portion. Until that ships, the Qubic integration
  is a research prototype.
- **Cold start.** Material science ANNs need domain expertise to
  author. We seed with 3–5 partner labs that ship the first 8
  production-quality ANNs before opening the marketplace.
- **Open data licensing.** Materials Project, OQMD, and similar
  datasets are CC-BY; commercial use is unclear. We mitigate with
  provenance tracking on every artifact and a takedown workflow.

The full risk register is in the architecture evaluation
companion document.

---

## What this is *not*

This is **not** automated science. Aigarth cannot run a real
experiment. Aigarth cannot replace a materials scientist. Aigarth
*can*:

- Plan an experiment.
- Predict its outcome (with uncertainty).
- Validate the prediction against historical literature and
  prior experiments.
- Find the next candidate material faster than a human can by
  reading papers.

That is a real product, and it is genuinely valuable. The
value is in *accelerating* the human research loop, not in
replacing it.

This is also **not** a replacement for dedicated materials
software. VASP, Quantum ESPRESSO, LAMMPS, GROMACS, the
Materials Project web UI — those tools are excellent. Aigarth's
job is to make them composable, attributable, and rateable. The
user still picks the engine; Aigarth handles the workflow.

---

## Try it

We're building this in public. The architecture evaluation and
this article are the first artifacts. Next: a
`/material-science` page on our tracker dashboard that shows the
concept, the compatibility verdicts, the roadmap, and the live
risk register. Then the knowledge prototype, then the
simulation, then the marketplace, then the chain.

If you're a materials researcher who wants to test the
knowledge prototype, a computational lab that wants to register
a DFT or MD worker, or a research group that wants to be on
the waitlist, the dashboard has a button. Otherwise, watch this
space — we'll post the Phase 1 demo as soon as the prototype
is real.

---

*This article is illustrative and forward-looking. Numbers,
phases, and product surfaces are placeholders that will change
as we ship and measure. Aigarth Cloud is a build-in-public
project; the dashboard at `localhost:4000/material-science` is
the source of truth for what is real today.*
