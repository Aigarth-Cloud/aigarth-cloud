# Aigarth Cloud — Engineering Roadmap

> **Status:** Phase 15 — Knowledge layer v1 (done, 100%)
> **Last updated:** 2026-08-09

## Vision

Aigarth Cloud is an operating system for decentralized AI, not a single web application. The platform is composed of independent services that can be developed by multiple teams (human or AI) in parallel and converged into a unified experience powered by Qubic.

This roadmap describes the systems, their order of construction, and the domain objects that wire them together. The estimated surface area: **120–180 domain objects** and **300–500 REST/GraphQL endpoints** — comparable to mature AI cloud platforms.

---

## Architecture principles

1. **Service-oriented, not monolithic.** Each phase is a bounded context with its own data, deploy pipeline, and team.
2. **Monorepo for cohesion, polyrepo for autonomy.** A TurboRepo/Nx workspace holds shared code (SDK, UI, design system) while individual services can be lifted out into their own repos when they need independent release cadence.
3. **Single shared design system.** All UIs (marketing, dashboard, studio, enterprise portal) consume one component library.
4. **Qubic is the source of truth for stake, settlement, and identity.** Off-chain services mirror but never override on-chain state.
5. **OpenAI-compatible gateway from day one.** Every model, every backend, every routing decision happens behind a stable external surface so consumers never have to know which subsystem they touched.

---

## Phase 0 — Foundation

**Goal:** Establish the monorepo, shared infrastructure, and developer experience before any product code is written.

- [ ] Monorepo setup (TurboRepo or Nx)
- [ ] Shared UI component library (extracted from the existing `components/ui/`)
- [ ] Design system tokens (extracted from `app/globals.css` + `tailwind.config.ts`)
- [ ] Shared TypeScript SDK (`@aigarth/sdk`)
- [ ] API client SDK (typed OpenAPI/GraphQL clients)
- [ ] Authentication package (consumed by every UI)
- [ ] Configuration management (12-factor + per-env overrides)
- [ ] Secrets management (Vault / AWS Secrets Manager / Doppler)
- [ ] Logging (structured JSON, correlation IDs)
- [ ] Feature flags (LaunchDarkly, Unleash, or self-hosted)
- [ ] CI/CD pipelines (build, test, lint, preview deploys)
- [ ] Infrastructure as Code (Terraform or Pulumi)
- [ ] Local Docker environment (docker-compose for the full stack)
- [ ] Kubernetes manifests (optional, can start with Compose for dev)

**Exit criteria:** `pnpm dev` brings up the entire stack locally. A new service can be scaffolded from a template in under 10 minutes.

---

## Phase 1 — Identity & Access

**Goal:** One identity across the platform — humans, organisations, machines.

**Deliverables:**
- [ ] User accounts
- [ ] Organisations (multi-tenant root)
- [ ] Teams (sub-groups within organisations)
- [ ] Roles (Owner, Admin, Member, Guest, Service)
- [ ] Permissions (resource-scoped RBAC)
- [ ] API Keys (per-project, per-environment, scoped)
- [ ] OAuth 2.1 (Google, GitHub, Microsoft, Apple)
- [ ] Wallet authentication (Qubic)
- [ ] MFA (TOTP, hardware keys)
- [ ] Session management (refresh, rotation, revocation)
- [ ] Audit logs (every privileged action)

**Domain objects:**
`User`, `Organisation`, `Team`, `Role`, `Permission`, `Wallet`, `APIKey`, `Session`, `AuditEvent`

---

## Phase 2 — Aigarth Core

**Goal:** The compute substrate. The thing everything else sits on.

**Deliverables:**
- [ ] Compute reservation engine (stake → capacity)
- [ ] Capacity allocator (placement, fairness, burst)
- [ ] Queue manager (priority, preemption, backpressure)
- [ ] Scheduler (placement, packing, gang, topology-aware)
- [ ] Node registry (join, heartbeat, attest, leave)
- [ ] Region management (47 regions, replication policy)
- [ ] Health monitoring (liveness, readiness, dependency checks)
- [ ] Capacity forecasting (predict demand, scale preemptively)

**Domain objects:**
`ComputeNode`, `Cluster`, `Region`, `Reservation`, `ComputePool`, `Queue`, `Job`, `Capacity`, `Allocation`

---

## Phase 3 — Qubic Integration

**Goal:** The bridge between Aigarth and the underlying Qubic network.

**Deliverables:**
- [ ] Wallet integration (connect, sign, broadcast)
- [ ] Staking service (lock, delegate, withdraw, cool-down)
- [ ] Smart contract interface (typed bindings to the Aigarth core contract)
- [ ] Transaction monitor (mempool watch, confirmations, finality)
- [ ] Reward calculations (per-block, per-tick, per-day)
- [ ] Validator interface (operator onboarding, slashing events)
- [ ] Treasury wallet (controlled by governance)

**Domain objects:**
`Stake`, `StakePool`, `Wallet`, `Transaction`, `Reward`, `Treasury`, `Validator`

---

## Phase 4 — Billing

**Goal:** Money in, money out — clean, auditable, settled on Qubic where possible.

**Deliverables:**
- [ ] Subscription engine (plans, terms, renewals)
- [ ] Usage billing (metering, aggregation, rating)
- [ ] Invoice generation (PDF, structured, branded)
- [ ] Payment gateway (Stripe or equivalent for fiat)
- [ ] Stablecoin settlement (USDC, USDT, on-chain)
- [ ] Fiat settlement (ACH, SEPA, cards)
- [ ] Coupons and promo codes
- [ ] Credits (free grants, promotional, earned)

**Domain objects:**
`Customer`, `Subscription`, `Invoice`, `Payment`, `Credit`, `UsageRecord`, `Plan`, `Product`

---

## Phase 5 — ANN Platform

**Goal:** The biggest subsystem. Intelligence that can be trained, versioned, owned, and monetized.

**Deliverables:**
- [ ] ANN Registry (canonical record for every ANN)
- [ ] ANN Builder (UI + CLI for training, fine-tuning, packaging)
- [ ] ANN Deployment (one-click deploy to any cluster)
- [ ] ANN Versioning (immutable history, branch, rollback)
- [ ] ANN Marketplace (discover, license, deploy)
- [ ] ANN Ratings (peer + benchmark-based)
- [ ] ANN Licensing (Open, Commercial, Restricted, custom)
- [ ] ANN Analytics (calls, latency, errors, revenue)

**Domain objects:**
`ANN`, `ANNVersion`, `ANNDeployment`, `Category`, `License`, `Rating`, `Benchmark`, `UsageStats`

---

## Phase 6 — Marketplace

**Goal:** The two-sided market — ANNs and Compute.

**Deliverables:**
- [ ] ANN Marketplace (Phase 5 surfaces)
- [ ] Compute Marketplace (spot, reserved, futures)
- [ ] Capacity Auctions (Dutch, English, sealed-bid)
- [ ] Revenue Dashboard (creators + operators)
- [ ] Marketplace Search (semantic, faceted, ranked)
- [ ] Categories and Tags
- [ ] Reviews and ratings

**Domain objects:**
`Listing`, `Offer`, `Purchase`, `Auction`, `Bid`, `Review`, `Seller`, `Buyer`

---

## Phase 7 — AI Gateway

**Goal:** The OpenAI-compatible layer. Every model, every backend, one stable external surface.

**Deliverables:**
- [ ] Chat API (`/v1/chat/completions`)
- [ ] Embeddings API (`/v1/embeddings`)
- [ ] Image API (`/v1/images/generations`, edits, variations)
- [ ] Video API (generate, extend, inpaint)
- [ ] Audio API (TTS, STT, real-time voice)
- [ ] Fine-tuning API (SFT, DPO, RLHF)
- [ ] Batch API (async, 24h SLA)
- [ ] Rate limiting (per-key, per-org, per-model)

**Domain objects:**
`Model`, `Request`, `Response`, `TokenUsage`, `Endpoint`, `Deployment`

---

## Phase 8 — Developer Platform

**Goal:** The fastest way to go from zero to first inference.

**Deliverables:**
- [ ] SDKs (Python, TypeScript, Go, Rust, Java, C#)
- [ ] CLI (`aigarth init`, `deploy`, `logs`, `login`)
- [ ] Documentation (searchable, versioned, runnable)
- [ ] Playground (try any model, in browser, with your key)
- [ ] API Explorer (Swagger/GraphiQL/Insomnia-style)
- [ ] Sample Apps (one per language, runnable in 5 min)
- [ ] Templates (Next.js, FastAPI, Go service, edge function)

**Domain objects:**
`SDK`, `Example`, `Guide`, `APIReference`, `PlaygroundProject`

---

## Phase 9 — Dashboard

**Goal:** The operator's cockpit. Where users see their stake, their compute, their spend, their ANNs.

**Deliverables:**
- [ ] Portfolio overview
- [ ] Stake dashboard (active positions, rewards, cool-down)
- [ ] Compute dashboard (utilization, allocation, routing)
- [ ] Marketplace dashboard (revenue, top ANNs, trends)
- [ ] Usage dashboard (spend, requests, tokens, error rates)
- [ ] Analytics (cohort, retention, LTV)
- [ ] Notifications (in-app, email, webhook)

**Domain objects:**
`Dashboard`, `Widget`, `Metric`, `Alert`, `Notification`

---

## Phase 10 — IPO / Genesis

**Goal:** Capital formation that feels like a Stripe product launch, not a token sale.

**Deliverables:**
- [ ] Genesis campaign page (the existing `/ipo` page)
- [ ] Participation flow (expression of interest → verification → allocation)
- [ ] Allocation calculator
- [ ] Governance onboarding
- [ ] Progress tracker (public, transparent)
- [ ] FAQs

**Domain objects:**
`GenesisRound`, `Participant`, `Allocation`, `VestingSchedule`, `GovernanceEligibility`

---

## Phase 11 — Hardware

**Goal:** A real product line. Edge nodes to data-center accelerators.

**Deliverables:**
- [ ] Product catalogue (Seed, Grove, Forest, Canopy, Root, Atlas, Core)
- [ ] Reservation system (pre-order, queue, deposit)
- [ ] Device management (register, ownership transfer, retire)
- [ ] Firmware updates (signed, verified, rollback)
- [ ] Remote monitoring (telemetry, alerts, health)

**Domain objects:**
`Device`, `Firmware`, `Reservation`, `Shipment`, `Registration`

---

## Phase 12 — Enterprise

**Goal:** Multi-tenant everything. Compliance, contracts, custom infrastructure.

**Deliverables:**
- [ ] Multi-tenancy isolation (data, network, compute)
- [ ] Dedicated clusters (private, single-tenant, custom SLAs)
- [ ] SSO (SAML, OIDC, SCIM)
- [ ] Compliance (SOC 2, ISO 27001, HIPAA, FedRAMP roadmap)
- [ ] Audit reports (exportable, scheduled)
- [ ] SLA monitoring (uptime, latency, error budget)

**Domain objects:**
`Enterprise`, `Contract`, `SLA`, `Cluster` (overlaps with Phase 2), `ComplianceReport`

---

## Phase 13 — Observability

**Goal:** You can't operate what you can't see. Make the platform self-evident.

**Deliverables:**
- [ ] Metrics (Prometheus + Grafana)
- [ ] Distributed tracing (OpenTelemetry → Jaeger/Tempo)
- [ ] Centralized logs (structured, searchable, retained)
- [ ] Alerts (PagerDuty/Opsgenie routing, severity tiers)
- [ ] Public status page (the existing `/status` page)
- [ ] Incident management (postmortems, timelines)

**Domain objects:**
`Metric`, `Trace`, `Event`, `Incident`, `Alert`

---

## Phase 14 — Governance

**Goal:** Stake-weighted decision making for the protocol.

**Deliverables:**
- [ ] Proposal system (anyone with stake ≥ threshold can propose)
- [ ] Voting (1-person-1-vote via stake weight, quadratic options)
- [ ] Treasury proposals (spend from on-chain treasury)
- [ ] Ecosystem grants (fund builders, researchers, educators)
- [ ] Community initiatives (delegated, time-boxed)

**Domain objects:**
`Proposal`, `Vote`, `Grant`, `TreasuryAction`

---

## Phase 15 — Knowledge Layer

**Goal:** Education, certification, and content as a first-class product surface.

**Deliverables:**
- [ ] Documentation CMS (headless, versioned)
- [ ] Blog (engineering + product)
- [ ] Tutorials (step-by-step, runnable)
- [ ] Academy (structured learning paths)
- [ ] Certifications (developer, operator, architect)

**Domain objects:**
`Article`, `Course`, `Lesson`, `Certification`

---

## Phase 19 — Datasets & Training Orchestration

**Goal:** Close the gaps identified in the Phase 3 Vision evaluation
(`docs/proposals/phase-3-vision-evaluation.md`). The "Intelligence Foundry"
vision is right; the proposal's language was off-brand. We are already
executing the vision through Phases 5, 6, and 18. Phase 19 fills in the
remaining gaps: a creator's home view, first-class datasets, real training
orchestration, and feedback loops.

**Status:** 🟡 In progress (~84%, 20 of 22 tasks complete)

**Source:** [Phase 3 Vision proposal](../docs/proposals/phase-3-vision-intelligence-foundry.md) (preserved for the record) + [evaluation](../docs/proposals/phase-3-vision-evaluation.md) (the honest review) + [brand-voice rewrite](../docs/proposals/phase-3-vision-marketing.md) (the customer-facing version)

### Sub-phases

#### 19A — Garden UX ✅ complete (4/4)

The creator's home view. Replaces the operator-style `/dashboard` as the default landing page.

- [x] **19A.1** — `/dashboard/garden` home view (`apps/web/app/dashboard/garden/page.tsx`)
- [x] **19A.2** — Four widget components (ANN, tissue, training-job, revenue) + status pill (`apps/web/components/garden/garden-card.tsx`)
- [x] **19A.3** — Add `/garden` to nav, redirect `/dashboard` → `/dashboard/garden`
- [x] **19A.4** — Garden empty state ("Plant your first intelligence")

**Story points:** 3.5 / 3.5

#### 19B — Dataset service ✅ complete (6/6)

First-class datasets. Foundational for real training (19C), public catalog (19B.4), and feedback loops (19D). The schema is locked in by [ADR 004](../docs/architecture-decisions/004-dataset-licensing.md).

- [x] **19B.1** — `services/dataset` skeleton (port 7009, Fastify + Drizzle + JWT + multipart, same shape as `services/tissue`) — see [phase-19b-dataset-delivery.md](../docs/deliveries/phase-19b-dataset-delivery.md)
- [x] **19B.2** — Schema: `datasets` + `dataset_versions` + `dataset_access` + `dataset_audit_logs` + `dataset_connectors` (per ADR 004)
- [x] **19B.3** — Upload pipeline (multipart → MinIO, SHA-256 content hash, schema sniff from first 1MB)
- [x] **19B.4** — Public dataset catalog at `/datasets` + detail at `/datasets/[slug]` + studio at `/dashboard/datasets`
- [x] **19B.5** — Connector framework + 1 working kind (`http_api`). v2 adds MQTT, HuggingFace, Kaggle.
- [x] **19B.6** — SDK `Datasets` resource (list, catalog, retrieve, listVersions, create, update, changeStatus, uploadVersion)

**Story points:** 9.5 / 9.5

#### 19C — Training orchestration ✅ complete (6/6)

The wiring around the now-real LLM invocation. 19C.3 closed the trinary stub gap in Phase 19C.3 (real LLM invocation via plug-in `TrinaryBackend`). The remaining 5 sub-tasks shipped in 19C.

- [x] **19C.1** — `services/training` skeleton (port **7011**, job queue, worker pool) — see [phase-19c-training-delivery.md](../docs/deliveries/phase-19c-training-delivery.md)
- [x] **19C.2** — Training recipe schema + catalog (5 built-in recipes: mlp_classifier, cnn_classifier, text_classifier, gradient_boost_tabular, trinary_classifier)
- [x] **19C.3** — Real LLM invocation in `/decide` (stub + OpenAI-compatible backends) — see [phase-19c3-real-llm-delivery.md](../docs/deliveries/phase-19c3-real-llm-delivery.md)
- [x] **19C.4** — `services/training` ↔ `services/compute` bridge (allocate, monitor, release; plug-in compute client: stub + http modes)
- [x] **19C.5** — Training progress stream (SSE for the Garden "Training queue" widget; NATS publish + in-memory fallback)
- [x] **19C.6** — Auto-publish new ANN version on training success (closes the training → marketplace loop; plug-in ann client: stub + http modes; semver bump + optional `isLatest` promotion)

**Story points:** 11 / 11

#### 19D — Feedback loops 🟡 partial (2/4)

What makes "Grow Intelligence" feel real. The actual proof that the platform learns from outcomes. 19D.1 (decision outcome tracking) and 19D.2 (auto-retrain trigger) shipped.

- [x] **19D.1** — Decision outcome tracking (`ann_decision_outcomes` table + `POST /v1/anns/:id/decisions/:decision_id/outcome`) — 30 new tests
- [x] **19D.2** — Auto-retrain trigger (drift + outcome rate; opt-in per ANN) — 21 new tests, cron loop in services/training
- [x] **19D.3** — A/B / shadow deployment for ANN versions (`deployMode`: active, shadow, canary, deprecated) — 19 new tests on the version router
- [x] **19D.4** — Garden UX: show "Actual: 89% (1,247 calls)" alongside "Predicted: 94%" — `Anns.stats()` SDK method, parallel fetch, two-line accuracy cell

**Story points:** 6 / 6

#### Cross-cutting ✅ complete (2/2)

- [x] **ADR 004** — Dataset ownership + licensing model — see [004-dataset-licensing.md](../docs/architecture-decisions/004-dataset-licensing.md)
- [x] **Brand-voice rewrite** of the Phase 3 Vision proposal — see [phase-3-vision-marketing.md](../docs/proposals/phase-3-vision-marketing.md)

**Story points:** 1 / 1

### Exit criteria

- [x] A creator's home view that frames the user's ANNs, tissues, and revenue as a portfolio
- [x] A real LLM behind `/decide` (closed the Phase 18E stub)
- [x] A clean, brand-compliant customer-facing version of the Phase 3 Vision
- [x] An architecture decision on dataset ownership (ADR 004)
- [x] First-class datasets (upload, version, schema, lineage, public catalog, connector framework, SDK resource)
- [x] Real training orchestration (recipe catalog, job queue, compute bridge, SSE progress, auto-publish new ANN version)
- [x] Decision outcome tracking (Phase 19D.1 — the foundation for 19D.2 and 19D.4)
- [x] Auto-retrain trigger (Phase 19D.2 — drift + low-volume; opt-in per ANN; cron in services/training)
- [x] Feedback loops (Phase 19D.3 + 19D.4 — A/B shadow deployment, predicted vs actual UI in the Garden)

### See also

- [Phase 19A delivery report](../docs/deliveries/phase-19a-delivery.md)
- [Phase 19B delivery report](../docs/deliveries/phase-19b-dataset-delivery.md)
- [Phase 19C delivery report](../docs/deliveries/phase-19c-training-delivery.md)
- [Phase 19C.3 delivery report](../docs/deliveries/phase-19c3-real-llm-delivery.md)
- [Dashboard tracker](/phases/phase-19) — live kanban

---

## Infrastructure needed

| Concern | Choice (initial) | Notes |
|---|---|---|
| Primary database | PostgreSQL | With read replicas |
| Cache / sessions | Redis | Cluster mode |
| Object storage | S3-compatible (R2, MinIO) | Models, artifacts, logs |
| Message queue | NATS or Redis Streams | Light, fast, supports pub/sub |
| Search | Meilisearch (initial) → Elasticsearch (scale) | |
| Analytics warehouse | ClickHouse | High-volume metrics + events |
| CDN | Cloudflare | Edge compute, cache, security |
| Email | Postmark | Transactional, reliable |
| Notifications | Self-hosted (FCM, APNs) | Push, web push |
| WebSocket | Centrifugo or self-hosted | Realtime updates for dashboard |

---

## External integrations

- **Qubic node / API** — core dependency
- **Stripe** (or equivalent) — fiat payments
- **Stablecoin payment rails** — USDC, USDT on relevant chains
- **Email provider** — Postmark, Resend
- **OAuth providers** — Google, GitHub, Microsoft, Apple
- **Monitoring** — Prometheus, Grafana, Sentry
- **DNS** — Route53 or Cloudflare
- **AI inference backends** — first-party, plus optional Hugging Face, Replicate

---

## Suggested build order

This order is chosen so each phase unlocks the next, and the highest-value surfaces go live first.

1. **Phase 0** — Foundation
2. **Phase 1** — Identity & Access (unblocks every other service)
3. **Phase 3** — Qubic wallet and staking integration (the source of truth for capacity)
4. **Phase 2** — Compute scheduler (turns stake into reserved compute)
5. **Phase 7** — AI Gateway (OpenAI-compatible APIs — first revenue surface)
6. **Phase 4** — Billing and subscriptions (monetize the gateway)
7. **Phase 9** — Dashboard (give users a place to manage all of the above)
8. **Phase 5** — ANN Registry and Marketplace (the second major product surface)
9. **Phase 6** — Compute Marketplace (the third major product surface)
10. **Phase 8** — Developer Platform (SDKs, CLI, docs, playground)
11. **Phase 10** — Genesis / IPO participation
12. **Phase 11** — Hardware ecosystem
13. **Phase 12** — Enterprise features
14. **Phase 14** — Governance
15. **Phase 13** — Observability (build alongside, mature over time)
16. **Phase 15** — Knowledge layer (continuous, never "done")
17. **Phase 19** — Datasets & Training Orchestration (substantively complete, ~92%) — closes the Phase 3 Vision gaps. All 4 sub-phases shipped: 19A Garden UX ✅, 19B Dataset service ✅, 19C Training orchestration ✅, 19D Feedback loops (19D.1 outcomes, 19D.2 auto-retrain, 19D.3 A/B shadow, 19D.4 actual vs predicted UI). Only the Phase 19 closeout delivery report remains. Phase 20 (Aigarth on-chain settlement) registered for after.
18. **Phase 23** — Pre-mainnet gates (M3 + M4 + p3) — closes the pre-mainnet gates from `docs/aigarthpool/audit-checklist.md` that don't require external coordination. M3 (rate limits on stakeForAnn) and M4 (circuit breaker pause/unpause) are designed + simulated; p3 (Qearn watcher + stake-attribution audit) ships a new services/qubic worker + a vitest + standalone audit harness. 3 tasks, 6/6 SP. See `docs/deliveries/phase-23-delivery.md`. Still blocking public mainnet: M5 (migration plan, ~1 SP), M6 (insurance fund, ops), I1–I4 (internal audit), E1–E3 (external audit via Qubic Foundation), 20.6 (testnet deploy, hardware-gated behind the AIO Dev Kit), P1 (daily review post-mainnet), P2 (TVL cap for week 1).

18. **Phase 20** — Aigarth on-chain settlement (AigarthPool) — substantively complete, 92% in the tracker, ~5.5/6 SP shipped. Built for the on-chain contract, simulated locally until AIO Qubic Dev Kit is available. 20.1 AIO Dev Kit (docker-compose qubic-devnet profile), 20.2 AigarthPool QPI contract (C++/QPI, full state + procedures + queries), 20.3 splits procedure (30/60/10, truncation-safe), 20.4 workspace package @aigarth/aigarthpool with simulator + qpi stub + 30 vitest cases + services/ann wire-up, 20.5 services/qubic aigarthpool-watcher. 20.6 (testnet deploy + audit) hardware-gated — audit-checklist.md is the pre-flight gate; full M1+M2 governance + multi-sig treasury should land as a separate phase before any public testnet.

19. **Phase 21** — MetaMask Qubic snap support (done, 100%, 1/1 task, 2/2 SP). The official Qubic MetaMask snap (`npm:@qubic-lib/qubic-mm-snap`) only exposes `signTransaction`, not `signMessage`, so we shipped Option B (a Qubic self-transfer whose `input` field IS the canonical auth message) end-to-end. The client builds a self-transfer with `inputType = 0x4147` ("AG", reserved by Aigarth), the snap signs it via `wallet_invokeSnap signTransaction`, the server unwraps + K12-verifies against the embedded challenge. `kind: "message"` (legacy vault / window.qubic / dev stub) and `kind: "transaction"` (snap) share a discriminated `WalletFinishSchema` on the server. `invokeSnapSignMessage` is reserved for the future Option A path (when the upstream snap ships a signMessage RPC — no server change needed to switch). Command centre updated with by-kind breakdown, snap-active badge, and a transaction audit feed table. Bug fix: the previous `result.reason` reference in `walletAuthFinish` was outside its scope and would have crashed on the transaction kind path — moved into the verifier blocks and returned in `WalletFinishResult.verification.reason`. 28 new vitest cases in services/identity for the tx parser + verifier. Monorepo typecheck 23/23.

20. **Phase 22** — Multi-sig treasury (M1+M2) (done, 100%, 1/1 task, 6/6 SP). The AigarthPool audit checklist's two blockers (M1 = governance for `setAnnSplits`, M2 = multi-sig treasury wallet) are designed, simulated, and wired through the off-chain services + command centre. The on-chain QPI build is hardware-gated behind the AIO Dev Kit. Spec at `docs/aigarthpool/governance.md`. Audit-checklist.md marks M1+M2 as designed (not yet deployed). The C++/QPI side: AigarthPool.{h,cpp} now host `initGovernance` + 6 procedures (submit/approve/execute for both treasury transfer and signer change) + `getGovernanceState` + `getSigners` queries + 7 new events. `PENDING_OP_TTL_EPOCHS=4`. `setAnnSplits` accepts either the ANN's creator OR a current governance signer (the M1 fallback). The TypeScript side: packages/aigarthpool exports the governance surface; the simulator mirrors every procedure with full event emission; **66/66 vitest cases pass** (was 30; +36 for governance). services/ann adds 4 admin endpoints (POST /v1/aigarthpool/governance/{init,treasury-transfer,signer-change}, GET /v1/aigarthpool/governance/state — public read for the command centre). services/qubic watcher logs the new events generically. apps/dashboard gets /governance command centre page with signer set, pending-op cards, approval progress, endpoint health + sidebar nav. Honest limit: QPI build is stubbed (AIO Dev Kit required); forward-compatible with the audit checklist's "sibling contract" recommendation. Next: M3 (rate limits) and M4 (circuit breaker) — both cheap pre-mainnet gates.

21. **Phase 13** — Observability v1 (done, 100%, 1/1 task, 3/3 SP). New shared package `@aigarth/observability` with a hand-rolled Prometheus text-format renderer (no `prom-client` dep, < 3 KB per service) + a `registerHttpMetrics(app, serviceName)` Fastify hook. `/metrics` wired into all 10 services: identity, ann, qubic, economy, billing, marketplace, tissue, dataset, compute, gateway. Per service: `service_info` gauge, `http_requests_total{service, method, route, status}` counter, `http_request_duration_seconds{service, method, route}` histogram + Node process metrics (uptime, rss, heap, pid, node version). Correlation IDs via `X-Request-Id` header (inbound or minted). AigarthPool business metrics on the ann service (`aigarthpool_total_staked_qubic`, `aigarthpool_total_positions`, `aigarthpool_paused`, `aigarthpool_yield_paid_total_qubic`, `aigarthpool_events_total{kind}`) — subscribes to the pool's event feed. Qearn business metrics on the qubic service (`qubic_qearn_events_observed_total{kind}`) — reads the mirror table on each `/metrics` scrape (the watcher is a separate process). `infra/observability/aigarth-cloud-overview.json` — starter Grafana dashboard with 6 panels (request rate, p95 latency, error rate, process memory, AigarthPool totals, Qearn events observed). 15/15 package tests + 22/22 monorepo typecheck. Distributed tracing (OpenTelemetry → Jaeger/Tempo) and alert routing (PagerDuty/Opsgenie) are deferred to v2. See `docs/deliveries/phase-13-delivery.md`.

22. **Phase 14** — Governance off-chain v1 (done, 100%, 1/1 task, 3/3 SP). The off-chain surface that drives AigarthPool's on-chain governance (Phase 22). New proposals subsystem in services/ann: schema (3 enums — `proposalKind` / `proposalStatus` / `voteChoice` — + `proposals` and `proposal_votes` tables with a unique index on `(proposalId, voterUserId)` for the re-vote upsert), service (`createProposal` / `castVote` / `recomputeTally` / `finalise` / `executeProposal` / `listProposals` / `getProposal` / `computeTallyFromDb`), and 6 REST endpoints under `/v1/proposals`. Voting rule (v1): simple-majority of stake weight, quorum gate. Stake snapshot at vote time (stable if user later unstakes). Default quorum = `max(MIN_QUORUM_QUBIC, 1% of proposer stake)` — prevents the "tiny-proposer tiny-quorum" attack. Self-vote forbidden. Default voting window 7 days, max 30. Binding kinds (treasury-spend, ecosystem-grant, parameter-change) push to `pool.submitTreasuryTransfer` (Phase 22 multi-sig). **26/26 vitest cases pass** in the proposals suite; 176/176 ann service total (was 150; +26). The closeout also fixed the proposals test mock — built a proper Drizzle SQL fragment evaluator (`where` + `orderBy` + `limit` + `offset` chain), which is a useful precedent for future mocks of the same shape. 22/22 monorepo typecheck. Phase 14 + Phase 22 = the off-chain + on-chain halves of governance; they compose end-to-end via the simulator. See `docs/deliveries/phase-14-delivery.md`.

23. **Phase 15** — Knowledge layer v1 (done, 100%, 1/1 task, 3/3 SP). Education, certification, and content as a first-class product surface. The ROADMAP says "continuous, never done" — v1 ships the three core product surfaces on the dashboard: `/blog` (engineering + product posts), `/tutorials` (step-by-step runnable guides), `/academy` (curated learning paths). All three reuse the existing Doc store (SQLite) and a shared hand-rolled markdown renderer extracted from `/docs`. Markdown files in `docs/blog/`, `docs/tutorials/`, `docs/academy/` are the source of truth; the dashboard reads them on each render. Frontmatter (title / date / author / tags) is parsed by a small YAML-ish reader; academy paths use a bare comma-separated list of lesson paths. Sidebar nav gets Blog + Tutorials + Academy. Seeded content: 3 blog posts (existing Trinary launch + tweet thread + new observability GA post), 2 tutorials (first-stake, first-ann — both runnable, 15min + 25min), 2 academy paths (Getting Started with Aigarth ~90min, Building ANNs ~120min). 22/22 monorepo typecheck. v2 scope (deferred): certifications, quizzes + completion tracking, search, authoring UI, versioning. See `docs/deliveries/phase-15-delivery.md`.

---

## Execution model

- **One repo per service** when independent release cadence is needed (compute scheduler, gateway, billing).
- **One monorepo for shared code** (SDK, UI kit, design tokens, types).
- **One team per phase** (human or AI), with explicit handoff contracts defined as API specs.
- **Mock services in the front-end until the back-end lands** — every page in the existing Aigarth Cloud frontend is already wired with sample data and labeled as such.

The current frontend (this repo) is the integration target. Each service lands as a real backend, swaps in via the SDK, and the corresponding dashboard surfaces light up.
