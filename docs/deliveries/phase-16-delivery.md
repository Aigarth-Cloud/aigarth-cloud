# Phase 16 — Video Synthesis ANN use case delivery report

> File matches the dashboard's `phase-N-delivery` slug pattern. URL:
> `/deliveries/phase-16-delivery`.

**Phase:** 16 — Video Synthesis ANN (use case evaluation)
**Sprint:** Phase 0 only — documentation, no code in production
**Date:** 2026-08-01

---

## What shipped

Triggered by the **"Aigarth Cloud Video Synthesis ANN Use Case
Evaluation"** proposal: a coordinator-based approach to AI video where
a small Director ANN plans the shot list and specialized Camera,
Motion, Depth, FX, Audio, and Quality ANNs do their part.

We did not build a video pipeline. We built **the foundation** to
decide whether to build one, and to start collecting interest while
the engineering work begins.

### Artifacts (4)

| Artifact | Path | Status |
| --- | --- | --- |
| Architecture evaluation | `docs/use-cases/video-synthesis-eval.md` | Final, ~5,400 words, 10 sections |
| Blog article | `docs/use-cases/video-synthesis.md` | Final, ~2,800 words, plain English |
| Dashboard `/video` page | `apps/dashboard/src/app/video/page.tsx` + `components/pages/video.tsx` | Live at `localhost:4000/video` |
| Marketing use case page | `apps/web/app/(marketing)/use-cases/video-synthesis/page.tsx` | Live at `localhost:3003/use-cases/video-synthesis` |

### Tracker (1 phase + 13 tasks + 2 docs)

- `phase-16` "Video Synthesis ANN" inserted, `in_progress` at 25%
  (Phase 0 is done; Phases 1–4 are backlog).
- 13 tasks: 5 done (the Phase 0 deliverables), 8 backlog
  (Phases 1–4 implementation tasks).
- 2 docs upserted into the docs table.

### Links

- Dashboard: <http://localhost:4000/video>
- Doc (eval): <http://localhost:4000/docs/use-case-video-synthesis>
- Doc (blog): <http://localhost:4000/docs/use-case-video-synthesis-blog>
- Delivery: <http://localhost:4000/deliveries/phase-16-video-synthesis-delivery>
- Marketing: <http://localhost:3003/use-cases/video-synthesis>
- Blog index (new post on top): <http://localhost:3003/blog>

---

## Architecture compatibility verdict

| Dimension | Score | Verdict | Gap |
| --- | --- | --- | --- |
| ANN compatibility | 8/10 | Extend | Add `ann_role` enum, `ann_pipelines`, `ann_pipeline_runs`, `ann_feedback_events` |
| Compute architecture | 7/10 | Extend | Add `compute_workers` table, extend `jobs.kind` with 6 new kinds, `/v1/workers/*` namespace |
| Continuous learning | 5/10 | Greenfield | Add `ann_feedback_events` + `ann_version_metrics` materialized view + cron |
| Qubic integration | 9/10 | Blocked | Real K12 signature verification is the single hard precondition |

**The proposal is well-aligned with the current architecture.** The
largest single gap is continuous learning — the system that turns a
multi-ANN scheduler into an evolutionary platform. The largest
external blocker is K12 signature verification, which is the
precondition for the entire on-chain portion of Phase 4.

---

## Required changes (concise)

### Schema

- `services/ann`: `ann_role` enum + 4 new tables (`ann_pipelines`,
  `ann_pipeline_runs`, `ann_feedback_events`, `ann_version_metrics` view)
- `services/compute`: extend `jobs.kind` enum with `render`, `motion`,
  `depth`, `fx`, `audio`, `quality`; add `compute_workers` table
- `services/marketplace`: add `kind = 'pipeline'` listing type

### Endpoints (services/ann)

- `POST /v1/pipelines` (create)
- `GET /v1/pipelines` (list)
- `GET /v1/pipelines/:id` (retrieve)
- `PATCH /v1/pipelines/:id` (update stages)
- `POST /v1/pipelines/:id/run` (submit a run)
- `GET /v1/pipelines/:id/runs`
- `GET /v1/runs/:id`
- `POST /v1/runs/:id/feedback`
- `GET /v1/anns/:id/feedback`

### Endpoints (services/compute)

- `POST /v1/workers` (register)
- `GET /v1/workers` (list)
- `GET /v1/workers/:id`
- `POST /v1/workers/:id/heartbeat`
- `POST /v1/workers/:id/deregister`
- `POST /v1/jobs/:id/progress`
- `POST /v1/jobs/:id/complete`
- `POST /v1/jobs/next` (long-poll)

### SDK (packages/sdk)

- `client.pipelines.{list, create, retrieve, run, listRuns}`
- `client.runs.{retrieve, feedback}`
- `client.workers.{list, register, heartbeat, deregister}`

### Apps

- Dashboard `/video` page ✅ (this phase)
- Marketing `/use-cases/video-synthesis` page ✅ (this phase)
- New customer dashboard page `/dashboard/videos` (Phase 1) — list
  own videos, watch, rerun, give feedback

---

## Implementation strategy

Five phases. Re-evaluation gate at the end of Phase 1.

- **Phase 0 — Documentation (this phase, 25% complete, 5 SP).**
  Evaluation, blog, dashboard, tracker. ✅
- **Phase 1 — Centralized prototype (next, ~16 SP).** Schemas +
  4 role ANNs + mock pipeline run + 30s sample render.
- **Phase 2 — Marketplace (~8 SP).** `kind = 'pipeline'` listing,
  per-version metrics rollup.
- **Phase 3 — Distributed compute (~18 SP).** Worker registry,
  protocol, `aigarth/worker-video` image, 3-worker local cluster.
- **Phase 4 — Qubic ecosystem (~16 SP).** K12 verification first
  (precondition), then on-chain contracts + rollups + rewards.

Total estimated: **~63 SP** across 5 phases.

---

## Risks (top 3, full list in the eval doc)

1. **Video is expensive.** Mitigation: per-stage pre-flight
   estimates, per-stage credit deduction, pre-purchased capacity via
   `reservations`.
2. **Multi-ANN coordination compounds errors.** Mitigation: Quality
   ANN at the end of every pipeline; per-stage retry; A/B two
   Director ANNs in shadow.
3. **K12 signature verification is still TODO** — blocks Phase 4
   entirely. Mitigation: ship K12 verification first as a 3-SP
   precondition task.

---

## ⏱ Time-to-Ship

| Step | Time | Notes |
| --- | --- | --- |
| Read existing dashboard patterns (services.tsx, register scripts, phase-9 script) | ~5 min | Consistency check |
| Write architecture evaluation doc | ~25 min | 10 sections, 4 dimensions, 10-row risk register, cost model |
| Write blog article (10-page, plain English) | ~15 min | Specialist-team framing, no abstract nouns |
| Build `/video` dashboard page (7 components, 1 client view) | ~20 min | Compatibility matrix, 7-role diagram, roadmap timeline, cost table, risk register |
| Register Phase 16 + 13 tasks + 2 docs in tracker | ~10 min | Idempotent INSERT/upsert, 4 activity logs |
| Fix `/docs/[slug]` route for `use-case-*` and `-blog` aliases | ~5 min | New canonicalize path variants |
| Build `/use-cases/video-synthesis` marketing page + blog index update | ~10 min | Hero + 6 sections + blog post link |
| Write delivery report | ~5 min | This doc |
| **Total** | **~95 min** | **~13 SP** |

**SP velocity:** ~7.3 min/SP. Slower than the recent mean (~4.6
min/SP) because docs and design are first-time work in this session.

### Velocity table (all phases)

| Phase | Time | SP | min/SP | Notes |
| --- | --- | --- | --- | --- |
| Phase 0 | ~110 min | 33 | 18 | Baseline (monorepo bootstrap) |
| Phase 1 | ~150 min | 34 | 4.4 | 4× speedup (schema + patterns locked) |
| Phase 2 | ~100 min | 19 | 5.3 | Qubic research avoided rebuild |
| Phase 3 | ~140 min | 19 | 7.4 | E2E infrastructure was new |
| Phase 4 | ~130 min | 22 | 5.9 | Stripe-style refactor |
| Phase 5 | ~145 min | 24 | 6.0 | Schema ramp-up (29-col `anns` table) |
| Phase 5+ | ~50 min | 11 | 4.5 | Gap-closing on top of stable base |
| Phase 6 | ~80 min | 22 | 3.6 | New velocity floor (discriminated unions) |
| Phase 7 | ~100 min | 15 | 6.7 | SDK .js rewrites + enum collision |
| Phase 8 | ~135 min | 28 | 4.8 | SDK + CLI + sample app |
| Phase 9 | ~180 min | 38 | 4.7 | apps/web wiring |
| Phase 9b | ~35 min | 5 | 7 | Visual sitemap (debug-heavy) |
| **Phase 16** | **~95 min** | **13** | **7.3** | **Docs + dashboard + tracker (no code)** |
| **Total** | **~1,270 min** | **258 SP** | **~4.9 avg** | 12 phases |

---

## Open items / carry-forward

- **Real K12 signature verification** — single hard blocker for Phase 4.
  Implement using `@noble/curves` (already a dep). ~3 SP.
- **TCP Qubic client** — secondary blocker for live Qubic RPC.
  HTTP gateway works today.
- **Worker container image** — `aigarth/worker-video` design
  finalized in the eval doc; not yet built.
- **Sitemap edge weight** — could be expanded to include
  `app/api/**/route.ts` cross-references (currently only
  `<Link href>` references are tracked).
- **Re-evaluation gate at end of Phase 1** — committed in the
  roadmap. If a 30s render from a 1-paragraph prompt takes
  > 10 minutes or looks incoherent, the proposal is paused.

---

## Hard-won lessons from this pass

- **Always pre-flight evaluate new use cases before building.**
  The architecture compatibility assessment exposed one greenfield
  area (continuous learning) that we would have under-scoped if
  we'd gone straight to code. Total cost: ~95 minutes. Total
  saved: weeks of building the wrong thing.
- **Public dashboard pages are the right artifact for
  pre-implementation evaluation.** The `/video` page is a
  single-page summary of the entire proposal that stakeholders can
  consume without reading the 5,400-word evaluation doc. It also
  doubles as the build-in-public status board once Phase 1 starts.
- **A pre-implementation phase in a real engineering tracker
  matters.** Phase 16 has 13 tasks: 5 done, 8 backlog, with explicit
  exit criteria at the end of Phase 1. When we start Phase 1, the
  scope is locked, the budget is visible, and the gate is committed.
- **Use cases deserve their own phase**, not a sub-task. The
  proposal is multi-quarter, multi-service, and has external
  dependencies (Qubic, K12). Burying it as a sub-task under
  another phase would have hidden the cost.

---

## Decision

**Proceed to Phase 1 (centralized prototype) on a 4-week timeline.**

Re-evaluate at the end of Phase 1 with a real 30-second render
and a live `/video` dashboard driven by real `pipeline_run` records.

If Phase 1 produces a coherent render in under 10 minutes, the
architecture has proven itself and we commit to Phase 2–4 with
honest numbers. If not, the prototype becomes an internal tool
and the rest of the architecture is unaffected.

*End of Phase 16 delivery report.*
