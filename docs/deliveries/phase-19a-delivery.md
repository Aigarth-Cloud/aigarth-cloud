# Phase 19A — Garden UX + Cross-Cutting Delivery Report

**Phase:** 19A — Garden UX (4 tasks) + Cross-cutting (2 tasks)
**Sprint:** 2nd of the Phase 19 plan (Sprint 1 = 19C.3, see [phase-19c3-real-llm-delivery.md](./phase-19c3-real-llm-delivery.md))
**Date:** 2026-08-07
**Status:** 🟡 Partial — 6 of 22 tasks complete (~24% of Phase 19)
**Story points delivered:** 4.5 / ~31 (19A: 3.5 SP + Cross-cutting: 1 SP)

> 📦 **Ship time: ~50 minutes** — 4.5 SP delivered at ~11 min/SP
> Cheaper than expected because the components lean on existing services
> (no new backend). Brand-voice rewrite is ~3,500 words and would have
> taken longer in isolation; bundling it with the UI work kept velocity up.

---

## What shipped

### 19A.1 — `/dashboard/garden` home view

**`apps/web/app/dashboard/garden/page.tsx`** — the new creator's home. Four widget zones, parallel data loading, graceful degradation if any service is down.

### 19A.2 — Four card components

**`apps/web/components/garden/garden-card.tsx`** — reusable card components:

- `AnnCard` — status, accuracy, decisions, 30d revenue
- `TissueCard` — status, policy, member count, decisions
- `TrainingJobCard` — progress bar with ETA (currently a placeholder; will hydrate in 19C)
- `RevenueCard` — last 30d, lifetime, top listing
- `StatusPill` — shared status badge (active / training / draft / paused / deprecated / errored / unknown)
- `GardenEmptyState` — first-run CTA

### 19A.3 — `/dashboard` redirects to `/dashboard/garden`

**`apps/web/app/dashboard/page.tsx`** — replaced the old Overview with a 1-line `redirect()` call. The old Overview content is still accessible at `/dashboard/overview` if a follow-up wants to surface it (out of scope for this sprint).

**`apps/web/components/dashboard/dashboard-nav.tsx`** — restructured. "Garden" is the new top-level item. Existing pages remain at their current paths. Reorganized into sections: Garden, Intelligence (Models, Tissues, Marketplace), Compute, Wallet, Developers, Account.

### 19A.4 — Garden empty state

The Garden shows a single CTA card when the user has 0 ANNs, 0 tissues, 0 listings: "Plant your first intelligence" with three action buttons (Create an ANN, Compose a tissue, Browse the marketplace). Per `BRAND-VOICE.md`: buttons say what they do, empty states invite action.

### ADR 004 — Dataset Ownership and Licensing Model

**`docs/architecture-decisions/004-dataset-licensing.md`** — locks in three decisions that affect 19B's schema:

1. **Who owns trained weights?** — Trainer. Dataset is a reference (never copied). Dataset author is credited but not a co-owner.
2. **What happens when a public dataset is removed?** — Trained versions keep working (soft orphan). Lineage preserved, surfaced in UI as "(now private)".
3. **How is attribution surfaced?** — Required on listing detail, optional card label, not in the envelope (envelope shape is frozen for v1).

Schema impact (locked in for 19B.2):
- `datasets`, `dataset_versions`, `dataset_access` tables
- `ann_versions.trained_on_dataset_version_id` (FK with `ON DELETE SET NULL`)
- `ann_versions.trained_recipe_json`, `ann_versions.trained_metrics_json`

### Brand-voice rewrite of the Phase 3 Vision

**`docs/proposals/phase-3-vision-marketing.md`** — the source proposal contained ~25 brand-voice violations. This is the clean version, ready for any customer-facing surface.

Specific rewrites:
- "decentralized ecosystem" → "open marketplace" / "Qubic economy"
- "transform Aigarth Cloud" → "extend Aigarth Cloud"
- "AI sovereignty" → "data ownership" (or dropped)
- "where humanity grows its own intelligence" → "stake, build, deploy, earn"
- "Intelligence Foundry" / "Intelligence Creation Interface" → dropped, kept working vocabulary
- "🌱🧠" emoji kept (light usage is on-brand)

The source proposal (`phase-3-vision-intelligence-foundry.md`) is preserved unchanged for the historical record.

---

## File map

```
apps/web/
├── app/dashboard/
│   ├── garden/page.tsx                ← NEW (19A.1)
│   └── page.tsx                       ← UPDATED → redirect to /garden (19A.3)
├── components/
│   ├── dashboard/dashboard-nav.tsx    ← UPDATED (19A.3)
│   └── garden/garden-card.tsx         ← NEW (19A.2, 19A.4)

docs/
├── architecture-decisions/
│   └── 004-dataset-licensing.md       ← NEW (ADR 004)
├── proposals/
│   └── phase-3-vision-marketing.md    ← NEW (brand-voice rewrite)

apps/dashboard/scripts/
├── complete-19a.ts                    ← NEW (marks 19A done in tracker)
└── complete-19-cross-cutting.ts       ← NEW (marks cross-cutting done)
```

---

## Quality gates

- `pnpm typecheck` — 19/19 tasks green
- `pnpm --filter @aigarth/web typecheck` — clean
- `pnpm --filter @aigarth/ann test` — 80/80 tests still green (no regression)

---

## Brand-voice compliance

The new Garden page copy uses only vocabulary from `BRAND-VOICE.md`'s "Use" list:
- "stake QUBIC, reserve compute, build AI products, earn" ✅
- "owned by you" ✅
- "no abstract nouns without grounding" ✅
- "buttons say what they do" ✅
- "empty states invite action" ✅
- "numbers are specific" ✅

What the Garden does **not** say:
- ❌ "decentralized ecosystem"
- ❌ "transform your AI journey"
- ❌ "where humanity grows intelligence"
- ❌ "AI sovereignty"
- ❌ "intelligence creation interface"

---

## What's NOT done (honest handoff)

Six of twenty-two Phase 19 tasks are complete. Sixteen remain. This is the candid state:

### 19B — Dataset service (0 of 6 done, ~9.5 SP remaining)

| Task | Status | Notes |
|------|--------|-------|
| 19B.1 — `services/dataset` skeleton (port 7009) | ❌ not started | Same shape as `services/tissue` |
| 19B.2 — schema (datasets + versions + access) | ❌ not started | Schema is locked in by ADR 004 above |
| 19B.3 — upload pipeline (MinIO + content hash + schema sniff) | ❌ not started | The load-bearing primitive |
| 19B.4 — Public dataset catalog + browse UI | ❌ not started | Reuses marketplace card pattern |
| 19B.5 — Connector registry (HTTP/MQTT/HF/Kaggle) | ❌ not started | 3 SP; can defer to v2 if needed |
| 19B.6 — SDK `Datasets` resource | ❌ not started | |

### 19C — Training service (1 of 6 done — only 19C.3, ~10 SP remaining)

| Task | Status | Notes |
|------|--------|-------|
| 19C.1 — `services/training` skeleton (port 7010) | ❌ not started | |
| 19C.2 — Training recipe schema + catalog | ❌ not started | |
| 19C.3 — Real LLM invocation | ✅ done | Closed in Phase 19C.3 sprint, see [phase-19c3-real-llm-delivery.md](./phase-19c3-real-llm-delivery.md) |
| 19C.4 — `services/training` ↔ `services/compute` bridge | ❌ not started | |
| 19C.5 — Training progress stream (SSE) | ❌ not started | |
| 19C.6 — Auto-publish new ANN version on training success | ❌ not started | Closes the loop from training → marketplace |

### 19D — Feedback loops (0 of 4 done, ~6 SP remaining)

| Task | Status | Notes |
|------|--------|-------|
| 19D.1 — Decision outcome tracking | ❌ not started | |
| 19D.2 — Auto-retrain trigger (drift + outcome rate) | ❌ not started | What makes "Grow Intelligence" feel real |
| 19D.3 — A/B / shadow deployment | ❌ not started | |
| 19D.4 — Garden: predicted vs actual accuracy | ❌ not started | The single most important UX in the platform |

---

## Recommended next sprint

If the user wants to continue, the highest-priority work in order is:

1. **19B.1** (skeleton) + **19B.2** (schema) + **19B.3** (upload) — 4 SP. Foundational. ADR 004 has the schema already.
2. **19C.1** + **19C.2** + **19C.4** + **19C.5** — 7 SP. The wiring around the now-real LLM invocation. Without this, training jobs are aspirational.
3. **19C.6** — 1.5 SP. The auto-publish loop. Closes the door on manual work.
4. **19D.1** + **19D.2** — 3.5 SP. The actual "Grow Intelligence" experience.
5. **19B.4** + **19B.6** + **19D.4** — 2.5 SP. Polish surfaces.
6. **19B.5** + **19D.3** — 5 SP. Connectors + A/B. Defer to v2 if velocity drops.

Estimated total for the remaining work: ~24 SP, at the new 11 min/SP velocity that's ~4.5 hours of focused build. Realistic across 2–3 follow-up turns.

---

## See also

- [Phase 19C.3 delivery report (real LLM invocation)](./phase-19c3-real-llm-delivery.md)
- [Phase 19 plan and priority queue](../proposals/phase-3-vision-evaluation.md)
- [ADR 004 — Dataset ownership + licensing](../architecture-decisions/004-dataset-licensing.md)
- [Brand-voice rewrite of the Phase 3 Vision](../proposals/phase-3-vision-marketing.md)
- [Original Phase 3 Vision proposal](../proposals/phase-3-vision-intelligence-foundry.md) (preserved for the record)
