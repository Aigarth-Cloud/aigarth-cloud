# System Architecture

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Engineering
**Last updated:** 2026-07-27
**Source docs:** [`ROADMAP.md`](../../../ROADMAP.md), [`PRD.md`](./PRD.md), [`ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md)

---

## 1. Architectural stance

Aigarth Cloud is built as a **constellation of independent services** that converge into one product experience. Each service:

- Has its own data, its own deployment, and its own release cadence.
- Owns a small set of domain objects and exposes a typed contract (REST, GraphQL, or event stream).
- Can be developed, tested, and deployed independently.
- Can be lifted out of the monorepo into its own repository when needed.
- Is monitored end-to-end with shared observability.

The front-end (`/app` in the existing repo) is the **integration target**. Every page in the front-end is already wired with sample data. As each service lands, the corresponding surface lights up.

## 2. Service map (16 phases → 16 services)

The 16 phases from `ROADMAP.md` map roughly to these services. Some phases will be combined (e.g. observability is cross-cutting); some will be split (the dashboard is one app with many sub-apps inside).

| # | Service | Phase | Primary surfaces |
|---|---|---|---|
| 00 | Foundation (monorepo, SDK, design system) | 0 | All |
| 01 | Identity & Access | 1 | Auth, orgs, teams, API keys, sessions |
| 02 | Aigarth Core | 2 | Scheduler, node registry, region mgmt |
| 03 | Qubic Integration | 3 | Wallet, staking, transaction monitor |
| 04 | Billing | 4 | Subscriptions, invoices, payments |
| 05 | ANN Platform | 5 | Registry, builder, versioning, marketplace |
| 06 | Marketplace | 6 | Listings, auctions, reviews |
| 07 | AI Gateway | 7 | OpenAI-compatible APIs |
| 08 | Developer Platform | 8 | SDKs, CLI, docs, playground |
| 09 | Dashboard | 9 | Portfolio, compute, usage, notifications |
| 10 | Genesis | 10 | IPO participation flow |
| 11 | Hardware | 11 | Catalogue, reservations, firmware |
| 12 | Enterprise | 12 | Multi-tenant, SSO, dedicated, compliance |
| 13 | Observability | 13 | Metrics, traces, logs, alerts (cross-cutting) |
| 14 | Governance | 14 | Proposals, voting, treasury |
| 15 | Knowledge | 15 | Docs CMS, blog, academy |

## 3. Cross-cutting concerns

These are not separate services but cross-cutting concerns applied uniformly across all services.

### 3.1 Authentication & authorization

- All services trust a single identity provider (Phase 1, Identity service).
- Tokens are short-lived JWTs issued by Identity, validated by every service.
- Authorization is resource-scoped RBAC. Permissions resolve at the API gateway.
- Wallet auth (Qubic) lives in the Identity service; other services see only the verified wallet address.

### 3.2 Observability

- Structured JSON logs with correlation IDs propagated via `traceparent`.
- OpenTelemetry traces exported to a central collector.
- Prometheus metrics scraped from every service.
- Alerts route to PagerDuty for severity ≥ high.

### 3.3 Configuration & secrets

- 12-factor config: env vars only, never in code.
- Secrets fetched at startup from Vault / AWS Secrets Manager.
- Per-environment overrides via `APP_ENV` (dev / staging / prod).

### 3.4 Feature flags

- Centralized flag service. Flags evaluated at request time, not deploy time.
- Flags are first-class in the SDK so the front-end can react.

### 3.5 API style

- All public APIs are REST + JSON, OpenAPI 3.1.
- Internal service-to-service calls can use REST, gRPC, or event streams as appropriate.
- A single API gateway (Kong or self-hosted) sits in front of every public endpoint, handling rate limiting, request validation, and auth.

## 4. Data architecture

| Concern | Choice | Rationale |
|---|---|---|
| OLTP primary | PostgreSQL 16 | Mature, JSONB for flexibility, strong tooling |
| Cache / sessions | Redis 7 | Industry standard, sub-ms latency |
| Object storage | S3-compatible (R2 / MinIO) | Models, artifacts, logs, exports |
| Message queue | NATS | Lightweight, fast, supports pub/sub + queue + KV |
| Search | Meilisearch (early) → Elasticsearch (scale) | Easy to start, scales when needed |
| Analytics warehouse | ClickHouse | High-volume metrics, low storage cost |
| Realtime | Centrifugo or self-hosted WebSocket | Dashboard live updates, presence |

## 5. Front-end architecture

The front-end (this repo) is built with:

- **Next.js 14** App Router (current codebase)
- **TypeScript** strict
- **TailwindCSS** + **shadcn/ui**
- **Framer Motion** for animations
- **Lucide Icons**
- **Zustand** for client state
- **React Query** for server state
- **next-themes** for the brand theme system (Garden / Qubic, Light / Dark)

The front-end is split into three route groups:

- `app/(marketing)/` — public site (the existing site, 40+ pages)
- `app/dashboard/` — authenticated app (the existing dashboard, 21 pages)
- `app/studio/` — ANN builder (to be built in Phase 5)

## 6. Deployment topology

- **Marketing site / Dashboard** — Vercel (or self-hosted on Cloudflare Pages / Fly.io)
- **API services** — Fly.io or AWS ECS Fargate, container-based
- **Worker services** — Fly.io Machines or AWS Lambda
- **Postgres** — managed (Neon / Supabase / RDS)
- **Redis** — managed (Upstash / Redis Cloud)
- **Object storage** — Cloudflare R2 or AWS S3
- **CDN** — Cloudflare
- **Observability** — Grafana Cloud, Sentry

## 7. Local development

Everything must run locally. The stack:

- `docker-compose.yml` at the repo root for Postgres, Redis, NATS, Meilisearch, MinIO
- `pnpm dev` per service (or `pnpm dev` at the root with TurboRepo for fan-out)
- Seed scripts to populate sample data (already exists in the front-end)
- `.env.example` checked in for every service

## 8. Boundaries

A service boundary is the line at which one team can ship without coordinating with another. The boundaries in this architecture are:

- **By domain object** — the User object lives in Identity and only Identity owns its schema. Other services get a typed User client.
- **By change cadence** — Billing changes weekly, Identity changes monthly. Different cadence, different service.
- **By technology** — ANN builder is a stateful app; scheduler is a control plane; gateway is a stateless proxy. Different technologies, different services.

The front-end is the only place that crosses all of them. Every other service stays in its lane.

## 9. Linked documents

- [`ROADMAP.md`](../../../ROADMAP.md) — phase-by-phase build plan
- [`DATA-MODEL.md`](./DATA-MODEL.md) — domain objects and their owners
- [`API-SPEC.md`](./API-SPEC.md) — endpoint contracts
- [`SECURITY.md`](./SECURITY.md) — security and compliance
- [`TECH-STACK.md`](./TECH-STACK.md) — concrete technology decisions
