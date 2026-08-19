# Aigarth Cloud — Phase 3 Vision (brand-voice rewrite)

> **Original source:** `docs/proposals/phase-3-vision-intelligence-foundry.md`
> **Companion:** `docs/proposals/phase-3-vision-evaluation.md`
> **Rewritten:** 2026-08-07
> **Why this file exists:** the source proposal contains ~25 brand-voice
> violations (per `docs/BRAND-VOICE.md`). The strategic direction is right,
> the language is not. This document is the brand-clean version, ready for
> any customer-facing surface.

---

## What we are building

Aigarth Cloud is where you build, own, and earn from AI that solves your problem.

You stake QUBIC, reserve compute, build an ANN, and publish it to the marketplace. When other people use it, you earn. The model is yours. The data is yours. The decision envelope is signed and auditable.

That's the whole product, in one sentence.

The rest of this document is the long version.

---

## What's different from the alternatives

| Alternative | What it is | What you don't get |
|---|---|---|
| OpenAI, Claude, Gemini | Chat with intelligence someone else made | You can't own the model, can't take it with you, can't monetize it |
| Hugging Face | Access and share models | Models aren't deployed, aren't earning for you, aren't governed by you |
| Self-hosted fine-tuning | Train your own model | You run the infrastructure, you handle the ops, you don't get a marketplace |

Aigarth Cloud is the missing piece. You build the intelligence. You own it. You list it. The platform handles the deployment, the routing, the metering, the billing. The QUBIC economy settles the rest.

---

## What you can do

### Build an ANN

You create an ANN with a name, a description, a category, a license, and (if it emits trinary decisions) a prompt template. The platform does the rest.

### Train it

Upload a dataset, pick a recipe, hit submit. The training service runs the job against the compute scheduler. Progress streams to the Garden. On success, a new version auto-publishes.

### Compose a tissue

A tissue is multiple ANNs combined into one decision. You pick the members, pick the consensus policy (`majority`, `unanimous`, `any`, `veto_aware`), and the tissue calls them in parallel and signs the result. Tissues are the right primitive when one model isn't enough.

### List it

One click. Per-decision pricing, per-request pricing, or enterprise subscription. The marketplace handles discovery, listing pages, license grants, and payment.

### Earn

Every call to your ANN or tissue settles in QUBIC. The platform takes 2.5%. The rest is yours.

### Improve it

The platform records decision outcomes. If your model drifts — predicted accuracy falls below your stated floor — the training service can auto-retrain on the latest dataset version. A/B and shadow deployment are first-class; you can run two versions side-by-side and route traffic by weight.

---

## The Garden

Your home view is a single page called the **Garden**. It shows:

- **Your ANNs** — status, predicted accuracy, decisions, last-30-day revenue
- **Your Tissues** — status, policy, member count, decisions
- **Training queue** — in-flight jobs with progress
- **Marketplace revenue** — last 30 days, lifetime, top listing

If you have nothing yet, the Garden shows a single CTA: **Plant your first intelligence.** Three buttons: create an ANN, compose a tissue, browse the marketplace.

The Garden is the answer to "what do I do when I log in?" Most platforms don't have an answer. We do.

---

## The marketplace

Aigarth's marketplace is the place to discover, license, and deploy specialized ANNs and tissues. Two listing types:

- **ANN listings** — per-call or subscription access to a single model
- **Tissue listings** — per-decision access to a composed decision API

Listings surface: predicted accuracy, decision count, training dataset (lineage), license terms, price, and (when available) **actual accuracy** — the real-world outcome rate measured by decision feedback. Predicted vs actual is the single most important number on the platform, and it's only possible because we record the outcomes.

---

## The economic layer

QUBIC is the unit of account across the platform:

- **Stake** to reserve compute
- **Earn** on idle capacity
- **List** an ANN or tissue and earn on every call
- **License** a third-party ANN and pay in QUBIC
- **Settle** in fiat or stablecoin (Phase 4)

The wallet is a Qubic wallet. The identity is a Qubic identity. The compute is reserved by QUBIC stake. The decision is signed by a Qubic key.

The economic loop: stake → reserve → build → list → earn → restake. Every rotation increases the platform's total value.

---

## What this is not

- **Not a chatbot.** Chat with intelligence is one interaction. Building and owning intelligence is a different category.
- **Not a model hub.** Hugging Face already exists. Aigarth is the place where models get used, monetized, and improved.
- **Not a "transformative AI platform"** or any other abstract-noun product. It's a marketplace with a runtime and a wallet. The product surface is specific, the value is concrete.

---

## Strategic context

The market for AI is converging on a single interaction: ask a question, get an answer. That's the chatbot era. It produced massive adoption, but it also produced a structural problem: every user is a consumer, every model is owned by a centralized provider, and the value accumulates at the top of the stack.

The next era is the one where the value flows differently. Where the people who build specialized intelligence — for their business, their community, their region, their research — can own it, deploy it, list it, and earn from it. Where the platform's job is not to be the smartest model in the room, but to be the best place to build, run, and monetize whatever model the user wants.

That's what Aigarth Cloud is. Stake QUBIC. Reserve compute. Build AI products. Earn when you're not using it.

---

## Roadmap (in user-facing terms)

- **Now** — Garden home view, real LLM invocation, marketplace, trinary decisions, tissues. Ships today.
- **Next** — Dataset registry, public catalog, real training jobs. Ships in 4–6 weeks.
- **After** — Auto-retrain on drift, A/B and shadow deployment, decision outcome tracking, predicted-vs-actual accuracy. Ships in 8–12 weeks.
- **Then** — Sovereign compute, compliance mode, enterprise contracts, governance, IPO participation. Continuous.

Each phase adds one user-facing capability. Each capability is documented, tested, and on the platform before the next one starts.

---

## See also

- [Original proposal (with brand-voice violations intact)](./phase-3-vision-intelligence-foundry.md) — kept for the historical record
- [Evaluation of the original proposal](./phase-3-vision-evaluation.md) — what's already shipped vs. what's a real gap
- [Brand voice rules](../BRAND-VOICE.md) — the source of truth for copy decisions
- [Roadmap](../ROADMAP.md) — the engineering phases that map to this vision
