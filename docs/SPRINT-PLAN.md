# Sprint Plan

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Engineering / Product
**Last updated:** 2026-07-27
**Source docs:** [`ROADMAP.md`](../../../ROADMAP.md), [`BRD.md`](./BRD.md)

---

## 1. Cadence

- **Sprint length:** 2 weeks
- **Planning:** First Monday of the sprint, 60 min
- **Review:** Last Friday of the sprint, 60 min
- **Retrospective:** Last Friday of the sprint, 30 min after review
- **Daily standup:** 15 min, async in #eng-daily

## 2. Velocity assumptions

- One senior engineer + one AI agent pair = ~40 story points / sprint
- We have 3 such pairs working in parallel
- Total throughput: ~120 SP / sprint
- 1 SP ≈ 0.5 day of focused work

## 3. Sprint 0 — Foundation setup (2 weeks)

**Goal:** Monorepo, SDK skeleton, design system extraction, CI/CD, local stack.

| Story | Points | Owner |
|---|---|---|
| Initialize monorepo (Turborepo, pnpm workspaces) | 3 | Eng lead |
| Extract design tokens from existing app | 3 | Designer + eng |
| Extract UI components to `@aigarth/ui` | 8 | Designer + eng |
| Scaffold `@aigarth/sdk` with typed client | 5 | Eng lead |
| Set up CI (lint, test, type-check, build) | 3 | Eng lead |
| Set up preview deploys per service | 3 | DevOps |
| docker-compose for local Postgres, Redis, NATS, MinIO | 3 | DevOps |
| Project tracker dashboard (this repo) | 5 | Eng lead |
| **Total** | **33** | |

**Exit criteria:** `pnpm dev` brings up the entire stack. A new service can be scaffolded in 10 minutes.

## 4. Sprint 1–2 — Identity (4 weeks)

**Goal:** Users, orgs, API keys, sessions, wallet auth.

Sprint 1:
- Identity service scaffolded (Fastify + Drizzle + Postgres)
- User CRUD + email verification
- Argon2id password hashing
- Session JWT issuance

Sprint 2:
- Organisation + Membership + Team + TeamMember
- Roles + custom scopes
- API key issuance, rotation, revocation
- Qubic wallet linking (signed nonce verification)
- TOTP MFA + WebAuthn passkeys
- Audit log writes

**Exit criteria:** A user can sign up, create an org, add members, issue an API key, and call a placeholder `/v1/me` endpoint.

## 5. Sprint 3–4 — Qubic integration (4 weeks)

**Goal:** Wallet, staking, transaction monitor, rewards.

Sprint 3:
- Qubic service scaffolded
- Wallet read endpoints
- Transaction monitor (NATS consumer of Qubic node events)
- Stake creation flow (signed intent → broadcast → confirm)

Sprint 4:
- Stake cool-down + withdrawal
- Reward calculation + claim
- Validator onboarding
- Treasury wallet (multi-sig)
- Integration test: end-to-end stake → allocation

**Exit criteria:** A user can stake QUBIC and see it reflected in their org's allocation.

## 6. Sprint 5–7 — Aigarth Core (6 weeks)

**Goal:** Compute scheduler, capacity allocator, region management.

Sprint 5:
- Core service scaffolded
- Region + ComputeNode + Cluster CRUD
- Node registration + heartbeat
- Health monitoring (basic liveness/readiness)

Sprint 6:
- Reservation engine (stake → capacity)
- Compute pool (usage tracking, 24h rolling)
- Queue manager (priority + preemption)

Sprint 7:
- Scheduler (placement, packing, gang, topology-aware)
- Capacity forecasting (basic)
- Job lifecycle (queued → running → done)
- Integration: end-to-end job submission against a test cluster

**Exit criteria:** A test job runs on a registered node and the result comes back.

## 7. Sprint 8–9 — AI Gateway (4 weeks)

**Goal:** OpenAI-compatible API surface.

Sprint 8:
- Gateway service scaffolded
- /v1/chat/completions (with streaming)
- /v1/embeddings
- Rate limiting + quota enforcement
- Token usage metering

Sprint 9:
- /v1/images/generations
- /v1/audio/speech + transcriptions
- /v1/fine-tuning/jobs
- /v1/batches (async)
- /v1/models
- /v1/usage
- Webhook delivery (job completion)
- SDK release (Python + TypeScript)

**Exit criteria:** The same OpenAI SDK code from the existing front-end works against the gateway with no changes.

## 8. Sprint 10 — Billing (2 weeks)

**Goal:** Subscriptions, usage billing, invoices, payments.

- Billing service scaffolded
- Plan + Subscription + Customer CRUD
- Stripe integration for fiat
- Stablecoin payment rails
- Invoice generation + PDF
- Credit system
- Integration: usage → metered billing → invoice → payment

**Exit criteria:** A Builder-plan org uses the gateway, gets a monthly invoice, pays via Stripe, and the payment lands in our account.

## 9. Sprint 11–12 — Dashboard (4 weeks)

**Goal:** Portfolio, compute, models, ANNs, billing, settings.

Sprint 11:
- Wire existing dashboard pages to real APIs
- Add WebSocket-based live updates
- Notifications system

Sprint 12:
- Usage analytics (charts, exports)
- Audit log viewer
- Team management UI
- Settings (org, security, billing)

**Exit criteria:** All 21 existing dashboard pages render real data, with live updates.

## 10. Sprint 13–14 — ANN Platform (4 weeks)

**Goal:** Registry, builder, versioning, marketplace, licensing.

Sprint 13:
- ANN service scaffolded
- ANN CRUD + versioning + signatures
- Category + License models
- Deployments (link to Core service)
- Studio UI (basic)

Sprint 14:
- Marketplace search + browse
- Ratings + reviews
- Benchmarks + verification
- Creator analytics

**Exit criteria:** A user can train, publish, and deploy an ANN through the studio, then license it on the marketplace.

## 11. Sprint 15 — Marketplace (2 weeks)

- Compute marketplace (spot, reserved, futures)
- Capacity auctions
- Order book + historical pricing
- Reviews + seller profiles

## 12. Sprint 16 — Genesis (2 weeks)

- Genesis campaign page (the existing `/ipo`)
- Participation flow (KYC, contribution, allocation)
- Allocation calculator
- Vesting schedules
- Governance onboarding

## 13. Sprint 17–18 — Enterprise (4 weeks)

- Multi-tenancy isolation
- SSO (SAML, OIDC, SCIM)
- Compliance reporting
- SLA monitoring
- Dedicated cluster flow

## 14. Sprint 19–20 — Observability hardening (4 weeks)

Built alongside other sprints, but a focused 4-week push:

- Distributed tracing everywhere
- Centralized logging
- Alert routing + PagerDuty
- Public status page (the existing `/status`)
- SLOs + error budgets
- Incident response playbook

## 15. Sprint 21+ — Hardware, Knowledge, Governance (continuous)

These are continuous streams, not sprint-shaped. Each gets its own backlog, planning, and review cadence.

## 16. Tracking

- The tracker dashboard in `workspace/now/dashboard/` is the source of truth
- Each sprint's stories become cards in the Kanban
- Each PR references a story ID
- Velocity tracked per pair, per sprint
- Burndown chart auto-generated

## 17. Definition of done

A story is done when:

1. Code is merged to `main`
2. CI passes (lint, type-check, tests, build)
3. Preview deploy is live and reviewed
4. Acceptance criteria met
5. Documentation updated if behavior changed
6. Tests cover the new behavior
7. Feature flag (if any) is configured

## 18. Risks to the plan

- **Hiring lag.** If we don't have 3 senior engineers by Sprint 5, throughput drops. Mitigation: lean harder on AI agents; defer Phase 11+ (hardware).
- **Qubic network delays.** If the Qubic mainnet doesn't support our staking flow when we need it, we ship to testnet first.
- **Qubic Incubation Program delays.** If tranches gate on subjective criteria, we build anyway and let milestones self-validate.

## 19. Linked documents

- [`ROADMAP.md`](../../../ROADMAP.md)
- [`BRD.md`](./BRD.md)
- [`RISK-REGISTER.md`](./RISK-REGISTER.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
