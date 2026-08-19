# Phase 3 Vision — Evaluation

**Proposal:** `docs/proposals/phase-3-vision-intelligence-foundry.md`
**Reviewed by:** Principal Architect
**Date:** 2026-08-05
**Companion to:** [phase-3-vision-intelligence-foundry.md](./phase-3-vision-intelligence-foundry.md)

---

## TL;DR

**Strategic direction: yes. Adoption: partial. The vision is right; the proposal is mostly describing what we've already shipped.**

Out of the proposal's 4 strategic pillars (Creation, Marketplace, Network Effects, Sovereignty), 3 are already live in code and tested. The 4th (the "Intelligence Garden" UX) is the only real gap.

The proposal's copy clashes with our brand voice on almost every rule. Before this lands in any customer-facing surface, the language needs a rewrite, not the roadmap.

My recommendation: **adopt the vision, reject the wording, build the actual gaps.**

---

## What's actually already built

I'm going to map the proposal's claims to the code, because "vision documents" are worthless if they don't match the system.

### "Create intelligence" → ✅ Already shipped (Phases 5, 18)

The "Intelligence Creation" path is the existing ANN service. Creation flow:

| Proposal step                  | Existing capability                                            | Code                                       |
|--------------------------------|----------------------------------------------------------------|--------------------------------------------|
| Define purpose (predict / etc.)| `POST /v1/anns` with `kind`, `description`, `category`        | `services/ann/src/services/anns.ts:33`     |
| Add knowledge / versions       | `POST /v1/anns/:id/versions` — versioned model records        | `services/ann/src/services/versions.ts`    |
| Publish                        | `POST /v1/anns/:id/publish` — draft → published               | `services/ann/src/services/anns.ts:221`    |
| License / monetize             | `POST /v1/anns/:id/licenses/grant` + marketplace listings      | `services/ann/src/services/licenses.ts`    |
| Rate / review                  | `POST /v1/anns/:id/ratings` + marketplace reviews              | `services/ann/src/services/ratings.ts`     |
| Discover / publish to market   | `POST /v1/listings` (marketplace service)                      | `services/marketplace/src/services/listings.ts` |

The proposal's "Intelligence Creation Wizard" maps almost 1:1 to **Phases 5 (ANN Platform) and 6 (Marketplace)** of the existing roadmap, both of which are shipped.

The "Grow Intelligence" progress bar in the proposal is exactly what the **trinary training pipeline** (Phase 18) already does for tissue composition: dataset analysis → member training → consensus derivation → deployment.

### "Intelligence Marketplace" → ✅ Already shipped (Phase 6 + 18E)

| Proposal surface         | Existing surface                                  | Code                                        |
|--------------------------|---------------------------------------------------|---------------------------------------------|
| ANN listings             | `GET/POST /v1/listings`                          | `services/marketplace/src/routes/listings.ts` |
| Offers + purchases       | `GET/POST /v1/listings/:id/offers`               | `services/marketplace/src/routes/offers.ts`  |
| Auctions (Dutch/English) | `GET/POST /v1/auctions`, `/v1/auctions/:id/bids` | `services/marketplace/src/routes/auctions.ts` |
| Reviews + ratings        | `GET/POST /v1/listings/:id/reviews`             | `services/marketplace/src/routes/reviews.ts` |
| Tissue listings          | `GET/POST /v1/tissue-listings`                   | `services/marketplace/src/routes/tissueListings.ts` |
| Sales / usage metering   | `tissue_usage_events` + `overage_tissue` invoice | `services/billing/src/services/tissueUsage.ts` |

**We have 7 marketplace services and 23+ endpoints. The proposal is describing what they do.**

### "Qubic economic layer" → ✅ Partially shipped

| Proposal claim                  | Status                                                |
|---------------------------------|-------------------------------------------------------|
| Training paid in Qubic          | ⏳ Qubic service wired (`services/qubic/`), billing not yet settled on-chain for training |
| Hosting paid in Qubic           | ⏳ Same as above                                      |
| Licensing / access paid in Qubic| ⏳ QUBIC is the unit (`total_credit_qubic`), settlement layer still fiat/off-chain |
| Intelligence transactions       | ✅ Marketplace uses QUBIC throughout; on-chain settlement is a future phase |

**Status:** the *unit* is Qubic; the *settlement* is still off-chain. This is fine and called out in the existing roadmap as Phase 4 (Billing) and Phase 3 (Qubic integration).

### "Intelligence Garden dashboard" → ❌ Genuine gap

This is the only real product gap in the proposal. The current dashboard is operator-oriented:

- `apps/web/app/dashboard/portfolio` — stakes + positions
- `apps/web/app/dashboard/models` — ANN list
- `apps/web/app/dashboard/marketplace` — listings
- `apps/web/app/dashboard/tissues` — tissue list (Phase 18)

There is no single "home" view that frames the user's AI as a living garden. The closest is `portfolio` but it skews toward stake + revenue, not "your ANNs as crops."

This is **worth building** but it's a UI/UX job, not a platform re-architecture.

---

## What's missing or vague in the proposal

These are the real gaps the proposal doesn't address (or hand-waves):

### 1. Dataset management

"Provide Knowledge" mentions "upload datasets, connect APIs, public datasets, research data, IoT devices." None of this exists. The ANN service has `trinaryPromptTemplate` (a string, max 20K chars) but no first-class dataset table, no API integration registry, no IoT connector framework.

**Effort estimate:** 2–3 phases. This is real work.

### 2. Training orchestration

"Grow Intelligence" assumes the system handles "architecture selection, training, validation, optimization, deployment." We have a deterministic hash-based stub for envelope generation in `services/ann/src/services/trinary.ts`. Real LLM invocation is the next major work item per Phase 18E's "What didn't make it" section.

**Effort estimate:** significant. This is the actual hard AI work.

### 3. Feedback loops

The proposal mentions "feedback loops" once and never again. Self-improving ANNs (Phase 3 of the proposal) requires:
- Decision outcome tracking
- Reward signal collection
- Periodic retraining triggers
- A/B / shadow deployment

None of this exists.

**Effort estimate:** 1–2 phases.

### 4. "Intelligence-to-intelligence interactions"

The proposal's Phase 3 is the most hand-wavy. Our existing **tissue** primitive (Phase 18) is the closest thing — multiple ANNs compose into a single decision via consensus policies. That's real. "Intelligence-to-intelligence" beyond that is currently undefined.

### 5. The "Chat vs Create" framing is wrong

The proposal says Aigarth should not be "another ChatGPT." Agreed. But the proposal frames this as "Ask vs Create," which is also wrong. The real distinction is **consumption vs authorship**:

- ChatGPT, Claude, Gemini = you consume intelligence someone else made
- Aigarth = you **own and operate** intelligence you made (or someone else's)

That's a sharper positioning than "create" (which sounds like a training UI) vs "chat." The brand line "build, deploy, monetize" already exists and is more accurate.

---

## Brand voice issues

The proposal's copy breaks almost every rule in `docs/BRAND-VOICE.md`. Direct quotes from the proposal vs. brand-voice violations:

| Proposal phrase                          | Violates                                       |
|------------------------------------------|------------------------------------------------|
| "decentralized ecosystem"                | "Decentralized" used as a buzzword             |
| "empowers individuals..."                | Avoid "empower"                                |
| "transform Aigarth Cloud into..."        | Avoid "transform"                              |
| "foundational platform"                  | "Cutting-edge" / vague superlative             |
| "game-changing frontier"                 | Avoid "disrupting / revolutionary / game-changing" |
| "AI sovereignty"                         | Abstract noun without grounding                |
| "Intelligence Creation Interface"        | Abstract noun + aspirational labeling          |
| "where humanity grows its own intelligence" | Cringe (per user profile: copy is "plain English, no abstract nouns") |
| "🌱🧠" em-dash-free copy, but emoji-heavy | OK on emoji, bad on abstract noun density     |

**This is a serious problem.** This proposal reads like a sales pitch from a Web3 AI agency, not a document from a platform that says "Stake QUBIC. Reserve compute. Build AI products. Earn when you're not using it."

If the *vision* lands in marketing copy, it will undermine the brand. The substance is right; the language needs a rewrite before it goes near the public site or any deck.

---

## Value assessment

**Is the vision worth building?**

The vision (people create, own, deploy, and monetize specialized AI on Qubic rails) is **already the existing roadmap**. The 16-phase ROADMAP.md is organized around exactly this. The "Intelligence Foundry" framing is a marketing restatement of Phases 5, 6, 7, 8, 9.

**Are there real gaps worth filling?**

Yes, three:

1. **"Intelligence Garden" home view** — UI/UX work. Replace the operator's portfolio page with a creator's home: "your ANNs, your tissues, your revenue, your training queue" as first-class widgets. ~1 phase of work.
2. **Dataset management** — first-class `Dataset` table, upload pipeline, public/private dataset catalog, API/IoT connector registry. ~2 phases.
3. **Real training orchestration** — replace the trinary stub with real model invocation, fine-tuning triggers, and a job queue that ties into the compute service. ~2 phases.

**Does it fit cleanly with what we've built?**

Yes. The architecture is already there. Adding `Dataset`, `TrainingRun`, `TrainingJob` domain objects to the existing ANN service + a `garden` dashboard surface would slot in without disrupting anything shipped. The marketplace, billing, and SDK already support the new entity types.

---

## Recommendations

### 1. Adopt the vision, rewrite the language

The strategic direction is correct — we are already executing it. Don't re-name the platform "Intelligence Foundry." Don't ship "Intelligence Creation Interface" as a UI label. Keep the working vocabulary (`ANN`, `Tissue`, `Listing`, `Decision`) and let "Intelligence Foundry" be a marketing slogan in the IPO deck, not a product surface name.

### 2. Don't add a new "Phase 3 — Intelligence Foundry" to ROADMAP.md

The 16-phase plan already covers this. The proposal would create phase numbering chaos (we already shipped 18 phases on top of the original 16). If we need a new phase, call it **Phase 19 — Datasets & Training Orchestration** with these deliverables:

- `Dataset` registry (upload, public catalog, API/IoT connector framework)
- `TrainingJob` orchestration (replaces the trinary stub with real model invocation)
- `FeedbackLoop` (decision outcome tracking, retraining triggers)
- "Intelligence Garden" home view in `apps/web/app/dashboard/garden`

### 3. Sequence the work

- **Phase 19A — Garden UX** (1–2 weeks): ship the home view. Cheap, high impact, makes the existing ANNs feel like a portfolio.
- **Phase 19B — Dataset registry** (3–4 weeks): first-class datasets, upload pipeline, public catalog. Foundational for the next two.
- **Phase 19C — Training orchestration** (4–6 weeks): real model invocation + training queue. This is the hard AI work.
- **Phase 19D — Feedback loops** (3–4 weeks): outcome tracking, retraining, A/B.

Rough total: ~3 months of focused engineering. Aligns with the 23–30 min/SP velocity we've been hitting.

### 4. Reject the proposal's copy in all public surfaces

Before any sentence from this document lands on the marketing site, a copy pass against `BRAND-VOICE.md` is required. Specific rewrites:

- "decentralized ecosystem" → "open marketplace"
- "transform Aigarth Cloud into" → "extend Aigarth Cloud with"
- "AI sovereignty" → "data ownership" (or skip — it's a slogan, not a feature)
- "where humanity grows its own intelligence" → "stake, build, deploy, earn"
- "Intelligence Creation Interface" → drop the label, just say "create, deploy, monetize"

### 5. Do not retire the tissue primitive

The proposal doesn't mention tissues, but **tissues are the closest thing we have to "intelligence-to-intelligence" interactions** and they shipped in Phase 18. Any Phase 19 work should compose with tissues, not replace them. The tissue is the natural unit for the "tissue of ANNs" mental model the proposal gestures at.

---

## What to do this week

If the user wants to act on this immediately, here's the minimum viable next step:

1. Land the proposal in `docs/proposals/` ✅ (this document)
2. Land the evaluation in `docs/proposals/` ✅ (this document)
3. Update `ROADMAP.md` to add a "Phase 19 — Datasets & Training Orchestration" stub, with the four sub-phases above
4. Decide: is Phase 19A (Garden UX) the next sprint? If yes, file a phase-19a-delivery.md outline
5. Schedule a brand-voice rewrite of the proposal before any of it touches marketing

The vision is sound. The plan is sound. The work is real. Let's not get distracted by the buzzword layer.

---

## See also

- [phase-3-vision-intelligence-foundry.md](./phase-3-vision-intelligence-foundry.md) — the source proposal
- [../ROADMAP.md](../ROADMAP.md) — the existing 16-phase plan this maps to
- [../BRAND-VOICE.md](../BRAND-VOICE.md) — copy rules the proposal violates
- [../deliveries/phase-18e-18f-delivery.md](../deliveries/phase-18e-18f-delivery.md) — most recent delivery, what's live today
- [../launches/phase-18-trinary-launch.md](../launches/phase-18-trinary-launch.md) — what was just launched
