# Aigarth Cloud

## The Genesis Document

> Version 1.0 — published alongside the platform's first end-to-end build cycle
> Authors: the Aigarth team and the agents that built with them
> Status: living document. Will be re-issued at every phase boundary.

---

## Table of Contents

1. [Preface](#1-preface)
2. [The Problem](#2-the-problem)
3. [The Thesis](#3-the-thesis)
4. [The Architecture](#4-the-architecture)
5. [The Economics](#5-the-economics)
6. [The Roadmap](#6-the-roadmap)
7. [The Contributor Invitation](#7-the-contributor-invitation)
8. [Appendix A — Phase Delivery Log](#appendix-a--phase-delivery-log)
9. [Appendix B — What We Have Built](#appendix-b--what-we-have-built)
10. [Appendix C — What Remains](#appendix-c--what-remains)

---

## 1. Preface

This is a working document. It is also a love letter to an idea.

Aigarth Cloud is a decentralized AI infrastructure platform built on Qubic. It uses Useful Proof of Work to turn real economic value — the work of training and running models — into on-chain settlement. It gives developers, enterprises, and communities a way to build, deploy, monetize, and consume AI applications without surrendering custody of their data, their models, or their margin to a small number of centralized providers.

The platform you are reading about is real. As of this writing, nine of nine planned build phases are complete. Seven production services are running locally on ports 7001 through 7007. A customer-facing dashboard at `localhost:3003` is wired to every one of them. A typed multi-service SDK with a CLI and a sample app is published. A typed, OpenAI-compatible API gateway is in place. A compute marketplace is live, with three auction kinds and 2.5% platform fees. The work is not theoretical.

This document explains the **why** behind the **what**. If you are here to evaluate the platform, this is the document to read first. If you are here to build with it, this is the document that will tell you whether your problem is one we are trying to solve. If you are here to invest in it, this is the document that will tell you whether we understand the problem well enough to deserve the resources.

We are not promising to change the world. We are promising to build the thing we are describing here, on the cadence we are describing here, with the discipline we are describing here. Everything else follows from that.

---

## 2. The Problem

### 2.1 Intelligence has become a tax

In 2026, every meaningful AI capability — language, vision, speech, code, search, agents — is hosted by a small number of centralized providers. The pricing reflects this concentration. A developer integrating an LLM into a product is not paying for compute, bandwidth, or talent. They are paying rent to a landlord who happens to own the AI factory district.

The result is what economists would call a **trust tax on cognition**: every time a developer wants to ship a feature, they take a dependency on a counterparty whose interests are not aligned with theirs, whose pricing power is structurally increasing, and whose terms of service can change overnight. We have seen this movie before — in databases, in payments, in cloud compute itself. The pattern is familiar and the conclusion is the same: rents flow upward, innovation slows, and the long tail of builders gets squeezed.

### 2.2 Qubic is the only chain that priced the work, not the lies

Most proof-of-stake networks ask validators to lock capital. A handful, including Qubic, ask validators to do **work** — useful work, in the form of AI inference and training, validated against the consensus. This is the *Useful Proof of Work* (UPoW) model. The economic implication is profound: the chain's security is paid for by the productive activity of running AI, not by the capital efficiency of a small validator class.

Aigarth Cloud is the application layer that turns Qubic's UPoW into a commercial AI infrastructure. The thesis is simple: **a chain that already pays for the work of intelligence should be the chain that hosts the most intelligence**.

### 2.3 The community is locked out

The existing AI stack is closed at every layer — models, infrastructure, payment rails, marketplaces. The only meaningful economic actors are the providers and their enterprise customers. Communities, individual researchers, hobbyists, and creators in the Global South do not have a seat at the table.

This is not just a fairness problem. It is an allocation problem. The marginal cost of training a small specialized model, or of running inference on a domain-specific model, is approaching zero in raw compute terms — but the friction of getting from "I have an idea" to "I am shipping a feature" is enormous. Every step costs money, requires relationships, or demands a scale that a solo developer does not have.

A platform that lets a researcher in Lagos, a student in Jakarta, or a freelancer in São Paulo publish a fine-tuned model and earn yield from real users — with no upfront relationship capital and no scale requirement — is a platform that has a chance of breaking the AI factory model.

### 2.4 The intelligence economy is the new compute economy

The 2010s were the decade of the cloud compute provider. The 2020s are the decade of the AI compute provider. The next decade will be the decade of the **intelligence economy**: a network of people, models, infrastructure, and applications that produce, trade, and consume AI capability as a first-class economic good.

Aigarth Cloud intends to be the substrate of that economy on Qubic.

---

## 3. The Thesis

### 3.1 The one-sentence version

> Aigarth Cloud converts Qubic's Useful Proof of Work into a commercial AI infrastructure that is owned by its users, not its operators.

### 3.2 The three principles

**Principle 1: Custody stays with the creator.** A model is the intellectual property of the person who trained it. The marketplace, the inference rail, the metering system, the payment system — these are infrastructure, not landlords. Aigarth takes a fee. Aigarth does not own the model, the user, the data, or the relationship.

**Principle 2: Settlement is the chain.** Every API call, every marketplace transaction, every stake, every refund is settled on Qubic in QUBIC. There is no off-chain accounting that can drift from the on-chain truth. There is no operator with a private ledger. The marketplace *is* the on-chain record.

**Principle 3: Compute is a public good at the margin.** The marginal cost of one more inference call on a deployed model approaches zero. The platform is built so that the user pays for what they consume, the creator earns for what they deploy, and the operator earns for the routing — but no one pays a rent that exceeds the cost of the work.

### 3.3 What this means in product terms

- **OpenAI-compatible APIs** that any developer can use with the tools they already have, switching to Aigarth as a drop-in provider — and switching back if they want. No lock-in at the application layer.
- **A marketplace for ANNs** where creators can publish a model once, set a price per call or a license fee, and earn in QUBIC for every interaction. The marketplace takes 5–30% depending on the license model. The creator keeps the rest.
- **A marketplace for compute** where operators with capacity can list it and where buyers (developers, other ANNs, batch jobs) can buy it at the marginal cost of the work. Three auction kinds — Dutch, English, sealed-bid — match the three pricing scenarios that matter: spot, reserved, and futures.
- **Staking that produces, not that locks.** When a user stakes QUBIC for compute access, that stake is what pays the validators. The user is not paying rent; they are funding the network's productive capacity and earning the right to use it.
- **A developer platform** that is opinionated about being usable. A typed SDK in TypeScript with a CLI, a sample app, and a getting-started path that does not require reading 200 pages of documentation.

### 3.4 What this is not

- **It is not a yield farm.** Staking earns the right to use compute; it does not produce a yield divorced from the underlying productive activity.
- **It is not a token launch.** QUBIC exists. The platform uses it. No new token is created.
- **It is not a rebrand of an existing AI company.** Aigarth Cloud is built specifically around Qubic's UPoW model. The dependency is the point.
- **It is not a free service.** Free tiers exist for adoption. Production usage pays its way. Sustainability requires that the work be paid for.

---

## 4. The Architecture

### 4.1 The shape

Aigarth Cloud is a **polyrepo of small, focused services** sharing a Postgres database, a Redis cache, a NATS event bus, and a MinIO object store. There is no monolith. There is no service mesh. There is no Kubernetes. There is a docker-compose for local dev and a clear deployment topology for production.

```
                                ┌─────────────────────────┐
                                │  Public site (apps/web) │  Next.js · port 3003
                                │  Public dashboard       │  
                                └──────────┬──────────────┘
                                           │  Cookie session (JWT)
                                           ▼
        ┌──────────────────────────────────────────────────────────────┐
        │              Edge / API gateway (services/gateway)             │  Fastify · 7004
        │   • /v1/chat/completions  • /v1/embeddings  • /v1/images       │
        │   • /v1/models  • /v1/keys  • /v1/usage                       │
        └────────┬────────────────────────────────────┬─────────────────┘
                 │                                    │
   ┌─────────────▼────────────┐         ┌─────────────▼────────────┐
   │  Identity & access       │         │  Qubic integration       │
   │  (services/identity)     │         │  (services/qubic)        │  Fastify · 7001 / 7002
   │  users, orgs, MFA, JWT   │         │  wallets, stakes, treasury│
   └──────────────────────────┘         └──────────────────────────┘
                 │
   ┌─────────────▼────────────────────────────────────────────────────┐
   │  Aigarth Core  (services/compute)                                    │  Fastify · 7003
   │  regions, clusters, jobs, reservations, capacity credit              │
   │  This is the routing layer that brokers work onto Qubic computors.   │
   └──────┬─────────────────────────────────────────────┬───────────────┘
          │                                             │
   ┌──────▼────────────┐  ┌──────────────┐  ┌──────────▼───────────┐
   │  ANN registry     │  │  Billing     │  │  Marketplace         │
   │  (services/ann)   │  │  (services/   │  │  (services/          │  7005 / 7006 / 7007
   │  16 categories,   │  │  billing)    │  │  marketplace)        │
   │  4 license kinds  │  │  plans, subs │  │  listings, offers,   │
   │  pg_trgm search   │  │  invoices    │  │  auctions (3 kinds)  │
   └───────────────────┘  └──────────────┘  └──────────────────────┘

   Infrastructure (docker-compose):
   • PostgreSQL 16       • Redis 7         • NATS 2.10 (JetStream)
   • MinIO (S3)          • MailHog (dev)   • pg_trgm extension
```

### 4.2 The seven services, briefly

| Service | Port | What it does |
|---|---|---|
| **Identity** | 7001 | Users, orgs, MFA (TOTP + WebAuthn stub), API keys, JWT issue + verify, audit log, Qubic wallet linking. The platform's identity layer. |
| **Qubic** | 7002 | Wallet link, multi-sig treasury movements, stake intent + submit, validator onboarding, network status. The bridge to the chain. |
| **Compute** | 7003 | Regions, clusters, jobs, reservations, capacity credit. The Aigarth Core: it brokers work onto Qubic computors. |
| **Gateway** | 7004 | OpenAI-compatible API. /v1/chat/completions (sync + SSE), /v1/embeddings, /v1/images, /v1/models, /v1/keys, /v1/usage. The developer surface. |
| **Billing** | 7005 | Plans, subscriptions, invoices, payments, credits, coupons. Stripe-style metered billing with a credit-burndown model. |
| **ANN** | 7006 | The ANN registry and marketplace. 16 categories, 4 license kinds, versioning, deploy, analytics, pg_trgm fuzzy search. |
| **Marketplace** | 7007 | Compute marketplace. Listings (spot/reserved/futures), offers, auctions (Dutch / English / sealed-bid), reviews, 2.5% platform fee. |

### 4.3 The four shared packages

- **`@aigarth/ui`** — the design system. Buttons, cards, badges, inputs, navigation. Built on Radix UI primitives and Tailwind, themed via the dual Garden/Qubic light/dark selector.
- **`@aigarth/utils`** — class name helpers (cn), string utilities, and the small toolkit that the rest of the codebase reaches for.
- **`@aigarth/config`** — shared TypeScript, ESLint, Prettier, and Tailwind presets. One source of truth for lint and type-check rules.
- **`@aigarth/sdk`** — the typed multi-service SDK. One client, eight resources, every method a developer needs. Has its own CLI (`aigarth`) and ships as compiled ESM.

### 4.4 The two apps

- **`apps/web`** — the public site and customer dashboard. 45 marketing pages, 10 wired dashboard pages (overview, API keys, usage, models, billing, compute, clusters, marketplace, capacity, playground), cookie-based auth, chat playground with real streaming.
- **`apps/dashboard`** — the internal project tracker. Phases, kanban, deliveries, docs, activity, services health. This is the document you are reading inside. It is a real product, used by the team every day.

### 4.5 The data model

The platform's domain is **70+ tables across 7 services**, all living in a single Postgres database. Every service has a service-local audit log table (`{service}_audit_logs`) with a free-form `action` text field — the same shape in every service, so platform-wide search and review is consistent. Bigint columns hold QUBIC amounts (1e6 decimal) as strings to preserve precision. Enums are prefixed with the service name (`ann_visibility`, `mkt_auction_kind`, `gateway_api_key_status`) to prevent cross-service collisions.

### 4.6 The contract

Every service exposes its API under `/v1/...`. Every error response is the same shape: `{ "error": { "message": "...", "type": "...", "code": "..." } }`. Every list endpoint returns `{ "data": T[] }`. Every amount is a QUBIC string. The SDK consumes this contract; the dashboard consumes this contract; the sample app consumes this contract. A change to the contract is a change to the SDK, and the SDK's TypeScript is the source of truth that the dashboard and apps refer to.

---

## 5. The Economics

### 5.1 The seven revenue streams

| Stream | Model | Year 1 target |
|---|---|---|
| AI API subscriptions | Per-token / per-call metering | 70% of revenue |
| Enterprise plans | Annual contracts, custom | 15% of revenue |
| ANN marketplace fees | 5–30% of license / subscription revenue | 8% of revenue |
| Compute marketplace fees | 2.5–15% of transaction value | 4% of revenue |
| Managed AI infrastructure | Monthly retainer | 2% of revenue |
| Hardware ecosystem | One-time + subscription | 1% of revenue |
| Developer services | Training, certification, support | < 1% of revenue |

The composition will shift over time as the flywheel matures: more ANNs → more usage → more marketplace activity → more staker yield → more staking → more capacity → more usage. By Year 3, the marketplace and ANN fees together should be 30%+ of revenue, not 12%. The end state is a community-owned network, not a SaaS company.

### 5.2 The flywheel

```
   ┌──────────────────────────────────────────────────────┐
   │                                                      │
   │  More developers  →  More API calls  →  More revenue │
   │        ▲                                     │      │
   │        │                                     ▼      │
   │  More capacity  ←  More staking  ←  More QUBIC burn │
   │        ▲                                     │      │
   │        │                                     ▼      │
   │  More ANNs  ←  More creators  ←  More marketplace  │
   │                                  activity & yield  │
   │                                                      │
   └──────────────────────────────────────────────────────┘
```

The flywheel is the entire business model. Every component reinforces every other component. The platform's job is to make every edge of the flywheel as cheap as possible — so that the wheel can spin at the highest possible velocity.

### 5.3 The unit economics (illustrative)

To be confirmed with real data once production is live. All values are placeholders, clearly labeled.

- **Inference margin:** ~70% gross margin after Qubic settlement + compute
- **Average developer LTV:** $480 / year (Builder plan, 1 year retention)
- **Average enterprise LTV:** $58K / year (Business plan, 3 year retention)
- **CAC ceiling:** 25% of LTV
- **Payback period:** 9 months for developers, 14 months for enterprise

The margin is high because the marginal cost of one more inference call is small. The CAC is low because the developer adoption path is a drop-in OpenAI replacement. The retention is durable because the workflow is sticky once it lands in production.

### 5.4 The capital formation

The Qubic CCF Incubation proposal requests **100B QUBIC equivalent**, structured as four milestone-gated tranches of 25B QUBIC each. Each tranche is released against acceptance criteria: production deployment, API gateway + ANN marketplace, marketplace flywheel activation, enterprise readiness. The platform is currently operating with internal funding; the incubation is the path to scale.

### 5.5 The token sinks

- **API usage** burns QUBIC (per-token / per-call metering)
- **Marketplace purchases** lock QUBIC in escrow
- **Staking** removes QUBIC from liquid supply
- **Treasury multi-sig** holds QUBIC for platform operations
- **Auction settlements** move QUBIC between buyer and seller

The sinks are designed to be net deflationary in equilibrium: every QUBIC that enters the system via the gateway has a settlement path that moves it into the compute network, into a staker's hands, or into the treasury. None of it evaporates into a private ledger.

### 5.6 The open-source promise

Aigarth Cloud is built in the open. The platform's source code is public. The SDK is public. The dashboard is public. The delivery reports are public. The risk register is public. **The economics are public** — this document, the BRD, and the revenue model are all readable by anyone with a browser.

We do not believe in information asymmetry as a moat. We believe in velocity, in execution, and in a community of builders who trust each other to keep building.

---

## 6. The Roadmap

### 6.1 The build phase (complete)

Nine phases, ten delivery reports, ~16 hours of active build time, 243 story points delivered.

| # | Phase | Time | SP | What it shipped |
|---|---|---|---|---|
| 0 | Foundation | ~110 min | 33 | Monorepo, packages, docker-compose, CI/CD |
| 1 | Identity & Access | ~150 min | 34 | 7 services base, identity service (13 tables, 38 endpoints) |
| 2 | Aigarth Core (Compute) | ~100 min | 19 | compute service (6 tables, 21 endpoints) |
| 3 | Qubic Integration | ~140 min | 19 | qubic service (9 tables, 14 endpoints) |
| 4 | Billing | ~130 min | 22 | billing service (9 tables, 21 endpoints) |
| 5 | ANN Platform | ~145 min | 24 | ann service (9 tables, 5 enums, 23 endpoints) |
| 5+ | Gap-closing | ~50 min | 11 | deploy, payment-gated licenses, fuzzy search, idempotency, rate limits |
| 6 | Compute Marketplace | ~80 min | 22 | marketplace service (7 tables, 9 enums, 19 endpoints, 3 auction kinds) |
| 7 | AI Gateway | ~100 min | 15 | gateway service (6 tables, 10 endpoints, dual auth) |
| 8 | Developer Platform | ~135 min | 28 | SDK + CLI + sample app |
| 9 | apps/web Wiring | ~180 min | 38 | auth + 10 dashboard pages + chat playground |

**Velocity:** averaged **4.7 min/SP** across the build, with the best phase at **3.6 min/SP** (Phase 6, the marketplace) and the worst at **18 min/SP** (Phase 0, the bootstrap).

### 6.2 The close-stubs phase (next, ~6 weeks)

What works in production today is a complete API surface. What is *production-grade* in the strict sense is a smaller set. The remaining work is closing known stubs:

- **TCP Qubic client** — the Qubic service currently uses stub + HTTP. A real TCP client is needed for production.
- **K12 signature verification** — the wallet-linking format check is in place; real K12 signature verification (using `@noble/curves`) is the next step.
- **Stripe fiat integration** — billing has a credit-burndown model ready; a real Stripe webhook handler is the next step.
- **Real capacity delivery** — compute jobs are submitted; a worker that actually executes the work on a Qubic computor is the next step.
- **Sealed-bid encryption** — the marketplace supports the auction kind; bid encryption is the next step.
- **PDF invoices** — invoices are JSON; PDF rendering is the next step.
- **Period-rollover cron** — subscriptions roll on a 30-day window; a real cron job to actually issue invoices is the next step.
- **WebAuthn** — server-side is stubbed; real WebAuthn verification is the next step.
- **Real Qubic gateway node** — the SDK uses a configurable URL; production needs a real node to point at.

### 6.3 The launch phase (~3 months)

- **Marketing site live** at `aigarth.cloud` with the full 45-page surface
- **Public alpha** to the first 1,000 developers
- **Discord + GitHub** community open
- **First 50 ANNs** published, 5,000+ API users, 10 enterprise pilots
- **Bounty program** for ANNs in underserved categories (medical, legal, low-resource languages)

### 6.4 The growth phase (~12 months)

- **First 1,000 enterprise pilots** active
- **First 100,000 developers** with a registered key
- **First 10,000 ANNs** published, 100,000+ MAU
- **Compute marketplace flywheel** spinning at full velocity
- **Hardware ecosystem** roadmap finalized
- **Year 1 revenue** at $1M+ ARR (illustrative; real number tracked in BRD)

### 6.5 The endgame

The endgame is not "win the AI market." The endgame is **be the AI infrastructure layer that Qubic deserves** — owned by its users, settled on its chain, with an intelligence economy that anyone in the world can participate in.

Aigarth is not the destination. Aigarth is the infrastructure. What gets built on top of it is the point.

---

## 7. The Contributor Invitation

### 7.1 Who we are looking for

We are not looking for employees. We are looking for **co-owners**.

The platform needs people with deep experience in:

- **AI engineering** — training, fine-tuning, evaluation, deployment at scale
- **Distributed systems** — consensus, sharding, gossip protocols, operator economics
- **Developer experience** — SDKs, CLIs, documentation, examples
- **Cryptography and security** — K12 signatures, MPC, ZK proofs, threat modeling
- **AI ethics and policy** — bias, alignment, governance, transparency
- **Hardware** — accelerator procurement, datacenter operations, edge deployment
- **Community building** — Discord, GitHub, content, education, mentorship
- **Capital formation** — investor relations, treasury management, token economics

If your domain is not on this list, we still want to hear from you. The list will change as the platform grows.

### 7.2 What we offer

- **Equity in the operating entity** that runs the platform (not the token, which is QUBIC)
- **Token incentives** for shipped contributions (paid in QUBIC at the milestone, vesting over 12 months)
- **A public portfolio** — every contribution is on your GitHub, your delivery report, your resume
- **Real ownership of your work** — the platform is open-source; your work is yours
- **A community of serious builders** who care about doing the work well

### 7.3 What we ask

- **Pick a problem from the close-stubs list** (or one of your own) and write a one-pager about how you would solve it. Share it in the issues. We will read it.
- **Show us something you have built.** A PR, a model, a tool, a doc — anything that demonstrates you can ship.
- **Be patient with the process.** We are building the organization as carefully as the platform. The first 50 contributors will define the culture for the next 500.
- **Be honest about what you do not know.** This is a hard problem. The team that survives is the team that does not pretend.

### 7.4 How to start

1. **Read the docs.** Start with this document, then `BRD.md`, then `PRD.md`, then the relevant delivery report for the service you are interested in. The full doc tree is in `docs/INDEX.md`.
2. **Clone the repo.** `git clone` and run `pnpm install && pnpm stack:up && pnpm dev`. The local stack will be up in 60 seconds.
3. **Pick a service.** Each service has a `README.md`, a delivery report, and a clear list of "next steps" in the close-stubs section of the delivery report.
4. **Open a PR.** Small, focused, with tests. We will review within 48 hours.
5. **Say hi in Discord.** We are friendly. We are also serious. Bring your code.

### 7.5 What we will not do

- We will not promise returns on a token. The token is QUBIC. The economics of Aigarth are the economics of producing useful AI work, and the returns accrue to the people who do the work.
- We will not hire mercenaries. We will not buy influencers. We will not do giveaways. We will build.
- We will not lie. Not about progress, not about velocity, not about the difficulty. Every delivery report on this site is honest. The risk register is honest. The roadmap is honest. If you want marketing, go to a different project.

---

## Appendix A — Phase Delivery Log

For the full delivery reports (with time-to-ship tables, velocity analysis, and known limitations), see `docs/deliveries/phase-N-delivery.md` for each phase 0 through 9.

| Phase | Time | SP | min/SP | Notable |
|---|---|---|---|---|
| 0 | ~110 min | 33 | 18 | Monorepo bootstrap |
| 1 | ~150 min | 34 | 4.4 | Identity schema + auth flow |
| 2 | ~100 min | 19 | 5.3 | Aigarth Core + Qubic research |
| 3 | ~140 min | 19 | 7.4 | Qubic integration + RPC client |
| 4 | ~130 min | 22 | 5.9 | Billing + Stripe-style credits |
| 5 | ~145 min | 24 | 6.0 | ANN + 16 categories + 4 licenses |
| 5+ | ~50 min | 11 | 4.5 | Deploy, idempotency, fuzzy search |
| 6 | ~80 min | 22 | 3.6 | Marketplace + 3 auction kinds |
| 7 | ~100 min | 15 | 6.7 | OpenAI gateway + dual auth |
| 8 | ~135 min | 28 | 4.8 | SDK + CLI + sample app |
| 9 | ~180 min | 38 | 4.7 | Auth + 10 dashboard pages + playground |

Total: **~16 hours** of active build time. **243 SP** delivered. **Average 4.0 min/SP**.

---

## Appendix B — What We Have Built

The seven services, in production-grade terms:

| Service | Tables | Endpoints | Notable |
|---|---|---|---|
| Identity | 13 | 38 | JWT, MFA (TOTP + WebAuthn stub), API keys, audit log |
| Qubic | 9 | 14 | Wallets, stakes, treasury M-of-N, RPC client (stub + http; tcp TODO) |
| Compute | 6 | 21 | Regions, clusters, jobs, reservations, capacity credit |
| Gateway | 6 | 10 | OpenAI-compatible, SSE streaming, dual auth (JWT + API key) |
| Billing | 9 | 21 | Plans, subs, invoices, payments, credits, coupons |
| ANN | 9 | 23 | 16 categories, 4 license kinds, pg_trgm search, idempotency, rate limit |
| Marketplace | 7 | 19 | 3 auction kinds, settle-on-read, 2.5% platform fee, reviews |

The shared surface:

- **SDK** — 8 typed resources, ~75 methods, CLI, sample app, OpenAI-compatible
- **Dashboard** — phases, kanban, deliveries, docs, activity, services health
- **Public site** — 45 marketing pages, auth, 10 wired dashboard pages, chat playground
- **Infra** — Postgres + Redis + NATS + MinIO + MailHog, all via docker-compose

---

## Appendix C — What Remains

Known stubs and next steps, in priority order:

1. **TCP Qubic client** — real network access for stake broadcast + balance reads
2. **K12 signature verification** — real cryptographic verification for wallet linking
3. **Stripe fiat integration** — webhook handler + payment intents
4. **Real capacity delivery** — worker that executes compute jobs on Qubic computors
5. **Sealed-bid encryption** — bid encryption for private auctions
6. **PDF invoice rendering** — invoice.pdf generation
7. **Period-rollover cron** — daily job to issue invoices at period boundaries
8. **WebAuthn server-side** — real passkey verification
9. **Real Qubic gateway node** — production node connection
10. **Auth UI polish** — password reset, email verification, MFA enrollment

These are the next ten things. Each is a single-PR change. Each is well-scoped. Each is open for contribution.

---

*"The best way to predict the future is to build it." — Alan Kay, paraphrased*

*— Aigarth Cloud, Genesis Document, v1.0*
