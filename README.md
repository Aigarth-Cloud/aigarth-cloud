# Aigarth Cloud

> The decentralized AI cloud. Stake QUBIC to reserve intelligent compute, launch AI products, and monetize infrastructure through Useful Proof of Work.

This is the monorepo for [Aigarth Cloud](https://aigarth.cloud) — production
AI on Qubic. See [`ROADMAP.md`](./ROADMAP.md) for the 16-phase build plan
and [`docs/`](./docs/) for the foundational documents.

## Repository layout

```
.
├── apps/
│   ├── web/        # @aigarth/web — public website, marketing, customer dashboard
│   └── dashboard/  # @aigarth/dashboard — internal project tracker
├── packages/
│   ├── ui/         # @aigarth/ui — design system (primitives, tokens, globals.css)
│   ├── utils/      # @aigarth/utils — cn, formatters, theme helpers
│   ├── sdk/        # @aigarth/sdk — typed OpenAI-compatible client
│   └── config/     # @aigarth/config — shared tsconfig, eslint, tailwind preset
├── services/       # backend services (placeholders for Phases 1+)
├── infrastructure/ # docker-compose for local Postgres, Redis, NATS, MinIO, MailHog
├── docs/           # 17 foundational documents (PRD, BRD, ARCHITECTURE, ...)
├── .github/        # CI, CODEOWNERS, Dependabot
└── ROADMAP.md      # 16-phase engineering roadmap
```

## Quick start

```sh
# 1. Install everything (uses pnpm workspaces)
pnpm install

# 2. Start the whole stack (Docker infra + all apps + services) in one command
pnpm stack:dev
```

That's it. `stack:dev` brings up Postgres, Redis, NATS, MinIO, and MailHog via
Docker, waits for them to be healthy, then starts every app and service.
Press Ctrl+C once to stop everything.

If you want the apps without the DB-touching services (services that need
Postgres will 500), just run `pnpm dev` directly — the apps come up either
way.

Open:

- [http://localhost:3003](http://localhost:3003) — the public site (apps/web)
- [http://localhost:4000](http://localhost:4000) — the project tracker (apps/dashboard)
- [http://localhost:8787](http://localhost:8787) — the node-chat example
- [http://localhost:8025](http://localhost:8025) — MailHog (dev email)
- [http://localhost:9001](http://localhost:9001) — MinIO console (login: `aigarth` / `aigarth_dev_secret`)

### Services running in the background

| Service    | Port | Notes |
|------------|------|-------|
| identity   | 7001 | auth, signup, login, JWT minting |
| qubic      | 7002 | QUBIC chain watcher, seed data |
| compute    | 7003 | reservation engine (Phase 2) |
| gateway    | 7004 | OpenAI-compatible surface |
| billing    | 7005 | usage metering, invoicing |
| ann        | 7006 | ANN registry + /decide |
| marketplace| 7007 | listings, offers, auctions |
| tissue     | 7008 | trinary decision composition |
| dataset    | 7009 | Phase 19B — dataset registry + uploads |
| economy    | 7010 | Phase 18 — splits, payouts |
| training   | 7011 | Phase 19C — training orchestrator (recipes, jobs, SSE progress, auto-publish) |

### Prerequisites

- **Node 20+** and **pnpm 9**
- **Docker Desktop** (or any Docker Engine on Linux). The launcher
  requires the daemon to be running before `pnpm stack:dev` —
  if it isn't, the script tells you so and exits. Start Docker
  Desktop, then re-run.

## Stack

- **Runtime:** Node 20+
- **Package manager:** pnpm 9 with workspaces
- **Build orchestrator:** Turborepo
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript strict
- **Styling:** Tailwind CSS, shadcn/ui over Radix UI, Framer Motion
- **SDK:** `@aigarth/sdk` — typed OpenAI-compatible client
- **Local infra:** Postgres 16, Redis 7, NATS 2.10, MinIO, MailHog (all via docker compose)

## Scripts

| Script                | What it does                                  |
| --------------------- | --------------------------------------------- |
| `pnpm dev`            | Run all apps in dev mode                      |
| `pnpm dev:web`        | Just `apps/web` (port 3003)                   |
| `pnpm dev:dashboard`  | Just `apps/dashboard` (port 4000)             |
| `pnpm build`          | Build every package and app                   |
| `pnpm typecheck`      | Strict typecheck across the workspace         |
| `pnpm lint`           | ESLint across the workspace                   |
| `pnpm test`           | Run tests (Vitest)                            |
| `pnpm format`         | Prettier write                                |
| `pnpm format:check`   | Prettier check                                |
| `pnpm stack:dev`      | **One command**: bring up infra + start dev (recommended) |
| `pnpm stack:up`       | Bring up infrastructure only                  |
| `pnpm stack:down`     | Stop infrastructure                           |
| `pnpm stack:reset`    | Nuke + recreate infra volumes (wipes data)     |
| `pnpm stack:logs`     | Tail infrastructure logs                      |

## Phase 0 — Foundation

This is the Sprint 0 work. See [`ROADMAP.md`](./ROADMAP.md) and
[`docs/SPRINT-PLAN.md`](./docs/SPRINT-PLAN.md).

- [x] Monorepo (Turborepo + pnpm workspaces)
- [x] Design system extracted to `@aigarth/ui`
- [x] Shared utilities in `@aigarth/utils`
- [x] Shared configs (tsconfig, eslint, tailwind) in `@aigarth/config`
- [x] OpenAI-compatible SDK in `@aigarth/sdk`
- [x] Project tracker dashboard (`@aigarth/dashboard`)
- [x] Local infrastructure via docker compose
- [x] CI + preview deploys (GitHub Actions)
- [ ] First passing CI run on `main`

## Documentation

The 17 foundational documents live in [`docs/`](./docs/). Reading order:

1. [PRD](docs/PRD.md) — what we're building and why
2. [BRD](docs/BRD.md) — business model and milestones
3. [ARCHITECTURE](docs/ARCHITECTURE.md) — service map and data flow
4. [DATA-MODEL](docs/DATA-MODEL.md) — every domain object
5. [API-SPEC](docs/API-SPEC.md) — endpoint contracts
6. [TECH-STACK](docs/TECH-STACK.md) — concrete tech decisions
7. [SECURITY](docs/SECURITY.md) — threat model
8. [SPRINT-PLAN](docs/SPRINT-PLAN.md) — sprint-by-sprint plan
9. [INDEX](docs/INDEX.md) — the rest, in order

## Endgame

[docs/ENDGAME-PROTO-PROPOSAL.md](./docs/ENDGAME-PROTO-PROPOSAL.md) is the
submission to the [Qubic CCF Incubation Program](https://qubic.org/incubation-program).
The north star for everything we ship.

## License

[Qubic Anti-Military License](LICENSE.md) — the same license applied to the
Qubic Network's reference software (see
[qubic-network/license](https://github.com/qubic-network/license)). Free to
use, modify, and distribute, except for military purposes. © 2026 Aigarth
Cloud.
