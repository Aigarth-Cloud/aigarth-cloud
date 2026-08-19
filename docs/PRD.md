# Product Requirements Document

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Product
**Last updated:** 2026-07-27
**Source docs:** [`ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md), [`ROADMAP.md`](../../../ROADMAP.md)

---

## 1. Problem

AI infrastructure is controlled by a handful of centralized providers. Developers rent intelligence. Enterprises rent compute. Communities have no path to participate. The result: extraordinary compute capability is locked behind recurring bills and a small club of approved participants.

Simultaneously, Qubic has technically distinctive capabilities — Useful Proof of Work, sub-second finality, zero transaction fees, native ANN execution — that have no commercial access layer. The capability exists; the marketplace for it does not.

## 2. Vision

> A global AI ecosystem where computation, intelligence creation, and infrastructure participation are connected.

Aigarth Cloud is the commercial gateway through which the world accesses Qubic-powered intelligence. Anyone can build AI applications, publish ANNs, access decentralized compute, stake QUBIC for infrastructure access, monetize AI products, and participate in the growth of the network.

## 3. Users

### 3.1 Primary

- **Developers** — Build AI products on top of Aigarth. Need OpenAI-compatible APIs, SDKs, clear docs, fair pricing.
- **Enterprises** — Need private infrastructure, compliance, SLAs, dedicated clusters, predictable spend.
- **Researchers** — Need model marketplace, training, fine-tuning, version-controlled ANNs, benchmarks.
- **ANN creators** — Train, publish, license, and earn from ANNs they build. Need version control, revenue splits, and distribution.

### 3.2 Secondary

- **Node operators** — Provide verified compute capacity. Need monitoring, earnings visibility, and clean onboarding.
- **Stakers** — Hold QUBIC and want yield plus infrastructure access. Need transparent yield mechanics and clear allocation tables.
- **Investors / Genesis participants** — Provide capital at the formative stage. Need a credible proposal and a transparent allocation.
- **Community** — Contributors, ambassadors, learners. Need education, recognition, and a path to deeper participation.

## 4. Product surfaces

Aigarth Cloud is composed of the following user-facing surfaces, each of which can be developed and shipped independently.

| Surface | Audience | Purpose |
|---|---|---|
| Marketing site (`/`) | All | Brand, vision, product positioning, acquisition |
| Useful Proof of Staking (`/useful-proof-of-staking`) | Stakers, investors | Explain the staking economy and the network incentive model |
| Pricing (`/pricing`) | Developers, enterprises | Stake-based plan tiers and add-ons |
| ANNs (`/anns`) | Developers, researchers | Explain what an ANN is, how it lives, how to publish |
| ANN Marketplace (`/marketplace`) | Developers, enterprises | Discover, license, deploy ANNs |
| Products (`/products`) | Hardware buyers | Hardware ecosystem catalogue (Seed, Grove, Forest, etc.) |
| IPO / Genesis (`/ipo`) | Investors | Founding-round participation, vision, allocation |
| Dashboard (`/dashboard`) | Authenticated users | Stake, compute, models, ANNs, billing, governance, settings |
| Enterprise (`/enterprise`) | Enterprise buyers | Compliance, dedicated infra, SLAs |
| Developers (`/developers`) | Developers | SDKs, quickstart, examples |
| API Gateway (`/v1/...`) | Machines | OpenAI-compatible inference, embeddings, etc. |
| Studio (`/studio`) | Creators | Train, fine-tune, publish ANNs |

## 5. Core jobs to be done

### 5.1 For developers

- **"I want to call an LLM from my code right now."** → 5-line quickstart, OpenAI-compatible endpoint, no signup required for trial.
- **"I want to embed millions of documents."** → Dedicated embedding API with batch and async endpoints.
- **"I want to fine-tune a model on my data."** → Studio UI for training, evaluation, deployment.
- **"I want to publish an ANN."** → Version, sign, price, list, monitor.
- **"I want predictable costs."** → Stake-based plans with no per-request surprise bills.

### 5.2 For enterprises

- **"I want a private cluster."** → Single-tenant deployment with custom SLAs.
- **"I want audit trails."** → Signed receipts for every inference, on-chain settlement.
- **"I want SOC 2 / ISO 27001 / HIPAA."** → Compliance posture published, audits in progress.
- **"I want a dedicated CSM."** → Named contact, quarterly reviews, 15-min P1 response.

### 5.3 For ANN creators

- **"I want to publish an ANN and earn from it."** → Marketplace listing, version control, revenue share, on-chain settlement.
- **"I want to license restrictively."** → Open / Commercial / Restricted license types.
- **"I want to track usage."** → Real-time analytics, earnings, geographic distribution.

### 5.4 For tissue builders (Phase 18)

- **"I want to compose multiple ANNs into one decision."** → Studio tissue builder: pick the policy, add members, publish. See [`guides/trinary-intelligence.md`](./guides/trinary-intelligence.md).
- **"I want veto power for one ANN in a multi-ANN review."** → `veto` role on a member — any `-1` blocks the tissue.
- **"I want to sell per-decision access to a tissue."** → Marketplace tissue listing with a per-decision price; billing flows through automatically.
- **"I want to license a tissue to specific users only."** → `access: "licensed"` + `tissues.grantLicense(slug, { granteeUserId })`.

### 5.5 For stakers

- **"I want to earn from my QUBIC."** → Stake, get yield from protocol fees.
- **"I want to use my stake for compute."** → Reserve capacity proportional to stake.
- **"I want to vote on the protocol."** → Stake-weighted governance.

## 6. Differentiators

- **Stake, don't rent.** Capacity belongs to the staker. Recurring bills disappear.
- **Earn on idle.** Capacity you don't use is offered on the market automatically.
- **OpenAI-compatible.** Drop-in replacement. Migration in an afternoon, not a quarter.
- **ANN-native.** The marketplace is the product, not an afterthought.
- **Cryptographically verifiable.** Every inference has a signed receipt. Every ANN is provably yours.
- **Qubic-native.** Sub-second finality, zero tx fees, native ANN execution, Useful Proof of Work.

## 7. Success metrics (Year 1)

Tracked via the tracker dashboard, sourced from `ENDGAME-PROTO-PROPOSAL.md`:

- **Developer growth:** 10,000 accounts / 5,000 API users / 1,000 deployed apps
- **ANN ecosystem:** 500 published / 250 creators / 25,000 marketplace users / 10M+ interactions
- **Compute utilisation:** 1,000 active contributors / 1M+ compute hours / 100,000 marketplace transactions
- **Enterprise adoption:** 25 pilots / 10 deployments / 5 strategic partnerships
- **Funding milestone delivery:** 4 milestones × 25B QUBIC, gated on acceptance criteria

## 8. Non-goals (Year 1)

We explicitly do **not** pursue the following in the first year:

- **Our own foundation model.** We route to, fine-tune, and serve existing models. We don't train a frontier LLM.
- **Our own chip / silicon.** Hardware is a roadmap; the Aigarth Seed/Grove/Forest products are "Coming Soon" for Year 1.
- **Consumer-facing chat products.** We build infrastructure, not a chatbot.
- **A native mobile app.** Mobile is web-responsive. Native is Year 2+.
- **Token launch.** The "IPO" is a Genesis capital formation round, not a public token sale. See `ENDGAME-PROTO-PROPOSAL.md`.

## 9. Open questions

| Question | Owner | Decision needed by |
|---|---|---|
| Do we self-host inference in Year 1 or partner with hyperscalers? | Engineering | End of Month 1 |
| Which Qubic network do we anchor to — mainnet, testnet, or both? | Qubic integration | End of Month 1 |
| What's the legal structure of the Genesis pool? | Legal / Founders | End of Month 2 |
| How do we handle geographic data residency for enterprise? | Enterprise | End of Month 3 |
| What's our SOC 2 audit partner? | Security | End of Month 1 |

## 10. Linked documents

- [`ROADMAP.md`](../../../ROADMAP.md) — Engineering phases, build order
- [`BRD.md`](./BRD.md) — Business model, revenue, costs
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System design
- [`DATA-MODEL.md`](./DATA-MODEL.md) — Domain objects
- [`API-SPEC.md`](./API-SPEC.md) — Endpoint contracts
- [`SECURITY.md`](./SECURITY.md) — Security and compliance posture
- [`SPRINT-PLAN.md`](./SPRINT-PLAN.md) — Iteration plan
- [`RISK-REGISTER.md`](./RISK-REGISTER.md) — Risk register
- [`TEAM-AND-ROLES.md`](./TEAM-AND-ROLES.md) — Team structure
- [`GOVERNANCE.md`](./GOVERNANCE.md) — Decision-making
- [`GLOSSARY.md`](./GLOSSARY.md) — Domain terms
- [`BRAND-VOICE.md`](./BRAND-VOICE.md) — Voice and content guidelines
- [`architecture-decisions/003-trinary-protocol-v1.md`](./architecture-decisions/003-trinary-protocol-v1.md) — Trinary Intelligence Layer protocol (Phase 18A)
- [`guides/trinary-intelligence.md`](./guides/trinary-intelligence.md) — Trinary user guide (Phase 18F)
- [`launches/phase-18-trinary-launch.md`](./launches/phase-18-trinary-launch.md) — Phase 18 launch summary (Phase 18F)
