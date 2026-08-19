# Services

Backend services. Each one is an independent pnpm package, deployable
on its own, sharing `@aigarth/config`, `@aigarth/utils`, and the design
tokens from `@aigarth/ui` (for any admin UI).

## Planned

| Service       | Sprint | Owns                                           |
| ------------- | ------ | ---------------------------------------------- |
| `identity`    | 1–2    | Users, orgs, teams, API keys, sessions         |
| `qubic`       | 3–4    | Wallet, staking, transaction monitor, rewards  |
| `core`        | 5–7    | Compute reservations, capacity, scheduler      |
| `ai-gateway`  | 8–9    | OpenAI-compatible API surface                  |
| `billing`     | 10     | Subscriptions, invoices, payments              |
| `ann`         | 13–14  | Registry, builder, marketplace                 |
| `marketplace` | 15     | Capacity auctions, order book                  |

## Tech baseline

- **Runtime:** Node 20+, TypeScript strict
- **Framework:** Fastify (lightweight, fast, schema-first)
- **DB:** Postgres + Drizzle ORM
- **Cache/queue:** Redis (BullMQ) + NATS for events
- **Validation:** Zod
- **Tracing:** OpenTelemetry
- **Logging:** Pino
- **Tests:** Vitest

Each service will get its own Dockerfile and K8s manifest when we
add it. Until then, this directory is intentionally empty.
