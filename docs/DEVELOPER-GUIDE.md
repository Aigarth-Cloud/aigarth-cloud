# Developer Guide

**Product:** Aigarth Cloud
**Status:** Active
**Last updated:** 2026-07-27

How to get the project running on your machine, from zero.

---

## 1. Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 20+ | Front-end, API services, CLI |
| pnpm | 9+ | Package manager |
| Docker | 24+ | Local Postgres, Redis, NATS, MinIO |
| Docker Compose | v2+ | Orchestration |
| Git | 2.40+ | Version control |
| Make | any | Shortcut commands |

Optional:
- VS Code with the recommended extensions (auto-suggested in `.vscode/extensions.json`)
- `direnv` for per-directory env loading

## 2. Clone and install

```bash
git clone <repo> aigarth-cloud
cd aigarth-cloud
pnpm install
```

This installs all monorepo dependencies.

## 3. Start the local stack

```bash
pnpm stack:up
```

This brings up via docker-compose:
- Postgres on `:5432`
- Redis on `:6379`
- NATS on `:4222`
- Meilisearch on `:7700`
- MinIO on `:9000` / `:9001`
- MailHog (SMTP) on `:1025` / `:8025`

To stop:
```bash
pnpm stack:down
```

To tail logs:
```bash
pnpm stack:logs
```

## 4. Initialize the database

```bash
pnpm db:migrate
pnpm db:seed
```

## 5. Run the apps

```bash
# All apps in parallel
pnpm dev

# Just the front-end
pnpm dev:web

# Just one backend service
pnpm dev:identity
```

Default ports:
- Marketing site: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard`
- Identity service: `http://localhost:4001`
- Gateway service: `http://localhost:4002`
- Dashboard app: `http://localhost:4009`

## 6. Run the tests

```bash
pnpm test          # all unit tests
pnpm test:watch    # watch mode
pnpm test:integration
pnpm test:e2e
pnpm test:coverage
```

## 7. Type-check, lint, format

```bash
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
```

## 8. Build for production

```bash
pnpm build
```

## 9. Environment variables

Every service has an `.env.example` checked in. Copy to `.env` and fill in. Never commit `.env` files.

For the dev stack, defaults are in `docker-compose.yml` and match the `.env.example` files.

## 10. The tracker dashboard

The project tracker (a meta-tool that shows progress on this very build) lives at `workspace/now/dashboard/`. Run it:

```bash
cd workspace/now/dashboard
pnpm install
pnpm dev
```

It runs on `http://localhost:4000` with SQLite by default.

## 11. Common tasks

### Add a new API endpoint

1. Find the relevant service in `services/<name>/`
2. Add the endpoint to its OpenAPI spec
3. Implement the handler
4. Add tests
5. Update the SDK if the contract changes

### Add a new dashboard page

1. Find the relevant route group in `apps/web/app/`
2. Add the page using existing components
3. Wire it to the appropriate service via React Query
4. Add tests

### Add a new domain object

1. Update [`DATA-MODEL.md`](./DATA-MODEL.md)
2. Add a Drizzle schema in the owning service
3. Generate a migration
4. Update the API spec
5. Update any clients

## 12. Troubleshooting

- **"Cannot connect to Postgres"** — `pnpm stack:up` and wait for the healthcheck
- **"Module not found"** — `pnpm install` again
- **"Port already in use"** — `pnpm stack:down && pnpm stack:up` or find and kill the process
- **"Hydration mismatch"** — Check that `next-themes` is wrapping everything; check the dark mode class
- **"Out of memory during build"** — Increase Node's heap: `NODE_OPTIONS=--max-old-space-size=4096 pnpm build`

## 13. Linked documents

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`TECH-STACK.md`](./TECH-STACK.md)
- [`SPRINT-PLAN.md`](./SPRINT-PLAN.md)
