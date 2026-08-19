---
title: "Use case — Aigarth Cloud as a coordinator for AI video production"
description: "A specialized-intelligence approach to AI video, where a Director ANN plans the shot, Camera and Motion ANNs animate the frame, FX and Audio ANNs polish it, and Quality ANN keeps the whole thing honest."
author: "Aigarth Cloud"
date: "2026-08-01"
readTimeMinutes: 22
category: "Use cases"
status: "final"
---

# Use case — Aigarth Cloud as a coordinator for AI video production

*How a swarm of small, specialized AIs can produce useful video —
without training one giant model that does everything.*

---

## The problem with how AI video works today

Most AI video systems work like this:

1. You write a prompt.
2. The system pushes that prompt through one enormous model.
3. Out comes a video.

This works. It also has three problems that don't go away:

- **It is expensive.** A state-of-the-art video model costs a lot to
  run, and the bill is paid whether the output is good or bad.
- **It is opaque.** When the video is wrong — wrong framing, wrong
  motion, wrong timing — there is no clean place to fix it. You
  re-roll the whole thing.
- **It cannot specialize.** A "tourism video" model and a "real
  estate video" model are not actually different. They are the same
  giant model, prompted slightly differently.

We think there is a different way to do this. A way that fits what
Aigarth Cloud was built for: a platform where small, specialized
intelligence modules can collaborate, improve, and evolve.

---

## The proposal in one sentence

Instead of one giant video model, build a **coordinator** that
hands off a job to a team of small, specialized AIs — each one
excellent at exactly one part of making a video.

---

## Meet the team

Picture a small video studio. Every studio has the same roles.
What if each of those roles was its own AI, living in Aigarth
Cloud as a published "ANN" (an Artificial Neural Network — our term
for any AI module on the platform)?

| Role | What it does |
| --- | --- |
| **Director ANN** | Reads the prompt, plans the shots. "30-second restaurant ad. Wide → push in. Cut to detail of pasta. Steam rising. Music swells at 18s." |
| **Camera ANN** | Picks the cinematic move. Slow push in? Dolly left? Whip pan? It knows 50 ways to move a camera and when to use each. |
| **Motion ANN** | Animates the still. Given a keyframe and a camera move, generates the in-between frames. Pure optics — no new content. |
| **Depth ANN** | Separates foreground from background. Lets the rest of the pipeline do parallax and depth-of-field correctly. |
| **FX ANN** | Adds the weather, particles, lighting, atmosphere. Steam. Rain. Lens flare. Sunset glow. |
| **Audio ANN** | Aligns narration, music, and sound effects to the timeline. Knows when to dip the music under a voice. |
| **Quality ANN** | Watches the result. Spots artifacts, weird motion, dropped frames. Decides whether to ship or to re-run a stage. |

Each of these is **small**. Each can be trained, fine-tuned, or
replaced independently. Each is published on the Aigarth ANN
marketplace, versioned like software, and rated by users.

This is not a new idea. Studios have always worked this way. The
question is whether a software platform can be built that lets
**anyone** compose this team for a particular kind of video, then
rent it out to others.

---

## Why this fits Aigarth's vision

Aigarth Cloud was designed around a few core ideas:

- **Specialized intelligence, not one model to rule them all.** A
  small ANN that is excellent at one thing is cheaper to run, easier
  to improve, and easier to trust than a giant model that is OK at
  everything.
- **Marketplace for ANNs.** A platform where ANNs are listed,
  rated, sold, and re-used. The Tourism Video ANN lives next to
  the Real Estate Video ANN. The Restaurant Ad Camera ANN is
  authored by a cinematographer in Lisbon and used by an ad agency
  in Tokyo.
- **Feedback that improves the system.** When a user watches the
  final video and rates it, that rating flows back to the specific
  ANNs that made the difference — not just the pipeline as a whole.
  Next time, the platform can pick better ANNs.
- **Compute as a first-class resource.** Heavy work (FFmpeg,
  OpenCV, PyTorch) runs on workers. Aigarth schedules the work,
  pays the workers, and tracks who did what.

Video is the canary use case. If we can build a working video
pipeline on Aigarth, we have proven that any multi-step creative
workflow — image editing, music production, document drafting,
research — can run on the same platform.

---

## How a render actually flows

A user types: *"30-second ad for a small restaurant in Lisbon.
Show the kitchen, the chef, the dining room. Warm light. Soft
music."*

Behind the scenes, the system produces a shot list — a JSON
document that describes the whole video:

```json
{
  "title": "Lisbon Restaurant Ad",
  "duration_seconds": 30,
  "style": "warm cinematic",
  "shots": [
    {
      "id": "s1",
      "duration": 4,
      "scene": "exterior at dusk, warm light from windows",
      "camera": "slow dolly forward",
      "audio": "soft fado guitar"
    },
    {
      "id": "s2",
      "duration": 6,
      "scene": "kitchen, chef plating",
      "camera": "overhead slow push in",
      "audio": "sizzle sound effect"
    },
    {
      "id": "s3",
      "duration": 8,
      "scene": "close-up of pasta, steam rising",
      "camera": "macro dolly right with rack focus",
      "audio": "music swells, voice begins"
    },
    {
      "id": "s4",
      "duration": 12,
      "scene": "dining room, customers, candles",
      "camera": "slow pan across tables",
      "audio": "voice-over, music underneath"
    }
  ]
}
```

This shot list is the **contract** between stages. Each stage
consumes it and produces an artifact:

1. **Director** writes the shot list (above).
2. **Camera** turns each shot into camera path data (a 3D curve
   through space, plus lens parameters).
3. **Depth** produces per-shot depth maps (foreground / background
   layers).
4. **Motion** generates the in-between frames for the camera path
   — pure interpolation, deterministic, fast.
5. **FX** layers in particles, steam, light glows, atmosphere.
6. **Audio** aligns narration + music + sound effects to the
   timeline.
7. **Quality** watches the result. If a shot is bad, it marks the
   stage that caused it; the system re-runs only that stage.
8. **Render** (FFmpeg) encodes the final MP4.

The whole pipeline is observable end to end. Every stage is
attributed. Every failure is recorded. Every success is rated.

---

## What it costs (illustrative)

A 30-second 1080p render on a single CPU worker, with all stages
running once:

| Stage | Cost (QU) | Time |
| --- | --- | --- |
| Director (LLM call) | 0.05 | 2 s |
| Camera (rule-based) | 0.01 | < 1 s |
| Motion (OpenCV) | 0.50 | 60 s |
| Depth (MiDaS) | 0.30 | 45 s |
| FX (compositing) | 0.10 | 10 s |
| Audio (alignment) | 0.05 | 5 s |
| Quality (model) | 0.10 | 15 s |
| Render (FFmpeg) | 0.05 | 30 s |
| **Total** | **~1.16 QU** | **~3 min** |

These numbers are **illustrative placeholders** — they will change
as we ship and measure. The point is that the cost is dominated by
Motion and Depth (because they touch every frame), and that the
**per-stage cost is visible to the user before they commit**. No
$100 surprise at the end.

The cost structure matters more than the number. When a stage is
expensive, the user gets to choose: pay for a faster worker, swap
in a cheaper ANN, or skip the stage entirely.

---

## What we have to build

Aigarth Cloud is a production-grade platform with 7 backend
services and 245 story points already shipped. The video use case
fits on top. We don't need to rebuild — we need to extend.

**What already works (no changes):**

- ANN registry, versioning, reviews — `services/ann`
- Marketplace listings, offers, auctions (Dutch, English, sealed-bid)
  — `services/marketplace`
- Job submission, clusters, regions, reservations, idempotency —
  `services/compute`
- LLM gateway with streaming and key-based auth — `services/gateway`
- Wallet link + Qubic network status — `services/qubic`
- Tracker, dashboard, marketing site, SDK with a CLI — the apps
  layer

**What we need to add:**

1. **Specialized ANN roles.** Add a `role` enum to ANNs so the
   platform can tell a Director from a Camera.
2. **Pipelines.** A new `ann_pipelines` table that lists ordered
   stages. A pipeline is what gets sold in the marketplace.
3. **Pipeline runs.** A new `ann_pipeline_runs` table that records
   every execution: per-stage status, per-stage cost, final
   artifact URL.
4. **Feedback events.** A new `ann_feedback_events` table that
   captures every user rating, thumb, retry, and error, attributed
   to a specific ANN version. This is what makes the system
   *evolve*.
5. **Per-version metrics.** A materialized view that rolls up
   feedback into per-ANN-version quality scores. The marketplace
   uses these to rank.
6. **Worker registry.** A new `/v1/workers/*` namespace on
   `services/compute` for tracking who can do what.
7. **Long-poll job delivery.** `POST /v1/jobs/next` so a worker
   pulls the next job it can do, and `POST /v1/jobs/:id/progress`
   for streaming progress back.
8. **A worker container image.** `aigarth/worker-video` with Python,
   OpenCV, FFmpeg, and PyTorch pre-installed. Operators run this
   image; the platform finds it.
9. **On-chain registry.** A Qubic smart contract that records
   ANN ownership, worker registration, and reputation. The
   off-chain platform commits rollups of feedback metrics once
   per day.
10. **Real K12 signature verification.** Currently the Qubic
    integration is format-only. To put any of this on-chain safely,
    we need real K12 cryptographic verification first. (This is
    the single hard precondition for the on-chain portion.)

The total scope is small. Most of the heavy lifting is in
`services/ann` (3 new tables, 6 new endpoints) and
`services/compute` (1 new table, 1 new enum variant, 5 new
endpoints). Everything else is new product surface on top of
existing infrastructure.

---

## How we'd ship it — four phases

**Phase 0 — Documentation (now).** The architecture evaluation
(this article and its longer companion), the dashboard `/video`
page that visualizes the concept, and a waitlist so we know who
is interested. No code in production.

**Phase 1 — Centralized prototype.** A single Python process that
acts as Director + Camera + Motion + Render. A user prompt goes in,
a 30-second MP4 comes out, and every stage is recorded. No workers,
no blockchain, no distributed anything. Goal: **prove the workflow
end to end**.

**Phase 2 — ANN marketplace integration.** Publish the Director,
Camera, Motion, Render ANNs as real listings. Let users buy a
pre-composed pipeline ("Tourism Video Pack"). Wire up per-version
metrics and reviews.

**Phase 3 — Distributed compute.** Ship the worker registry,
the worker protocol, and the `aigarth/worker-video` image. Run a
3-worker local cluster. Workers earn reputation from real feedback
events. Per-stage cost becomes real.

**Phase 4 — Qubic ecosystem integration.** Deploy the on-chain
`ann_registry`, `worker_registry`, `reputation`, and `rewards`
contracts. Off-chain rollups commit to chain once a day. Workers
and ANN authors get paid in QUBIC.

**Re-evaluation at the end of Phase 1.** If a 30-second render
comes out coherent in under 10 minutes from a one-paragraph
prompt, the architecture has proven itself. We commit to Phase 2
with real numbers. If not, we back off — the prototype becomes an
internal tool, the architecture stands, and we tell the use case
honestly: the pieces are real, the experience is not yet there.

---

## What could go wrong

We are honest about the risks:

- **Video is expensive.** Even a "cheap" render takes minutes of
  CPU time. We mitigate with per-stage cost estimates, per-stage
  credit deduction, and pre-purchased capacity.
- **Multi-ANN coordination compounds errors.** A bad Director output
  ruins every downstream stage. We mitigate with a Quality ANN at
  the end and a per-stage retry — only the failing stage re-runs.
- **Workers are untrusted code.** We mitigate with Docker
  sandboxes, no network egress except to Aigarth APIs, resource
  caps, and reputation + slashing.
- **K12 signature verification is the single hard blocker** for
  the on-chain portion. Until that ships, the Qubic integration
  is a research prototype.
- **Cold start.** Zero ANNs at launch means zero value. We seed
  with 5–8 production-quality ANNs before opening the marketplace.

The full risk register is in the architecture evaluation
companion document.

---

## What this is *not*

This is **not** a replacement for big video models. Big models are
good at the things big models are good at: rough first drafts,
imagination, surprise. Aigarth is good at the things Aigarth is
good at: controllable, attributable, evolvable, monetizable
pipelines built from small specialists.

If you want a one-prompt, 5-second, "wow that's cool" video, you
should still use the big model. If you want a 30-second
restaurant ad that a small business can afford to re-render 12
times until the chef's plating is just right, Aigarth is the tool
for that.

---

## Try it

We're building this in public. The architecture evaluation and
this article are the first artifacts. Next: a `/video` page on
our tracker dashboard that shows the concept, the compatibility
verdicts, the roadmap, and the live risk register. Then the
centralized prototype, then the marketplace, then the workers,
then the chain.

If you're an operator with idle GPU capacity, a filmmaker who
wants to ship a Camera ANN, or a small business that wants to be
on the waitlist, the dashboard has a button. Otherwise, watch
this space — we'll post the Phase 1 demo as soon as the
prototype is real.

---

*This article is illustrative and forward-looking. Numbers,
phases, and product surfaces are placeholders that will change as
we ship and measure. Aigarth Cloud is a build-in-public project;
the dashboard at `localhost:4000/video` is the source of truth
for what is real today.*
