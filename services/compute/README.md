# Aigarth Compute Service

Brokers jobs onto Qubic's 676 computors. Manages capacity reservations, region/cluster topology, and job lifecycle.

Port: **7003**

## Stack

- Fastify 4 + Drizzle 0.42 (thenable) + node-postgres
- Same auth pattern as `services/identity` and `services/qubic` (verifies the JWT signed by identity)
- Uses `services/qubic` to broadcast jobs to Qubic (cross-service HTTP)

## Endpoints

- `GET /healthz`, `GET /readyz`
- `GET /v1/compute/regions`, `GET /v1/compute/regions/:id`
- `GET /v1/compute/clusters`, `GET /v1/compute/clusters/:id`
- `POST /v1/compute/jobs`, `GET /v1/compute/jobs`, `GET /v1/compute/jobs/:id`, `POST /v1/compute/jobs/:id/cancel`
- `POST /v1/compute/reservations`, `GET /v1/compute/reservations`, `GET /v1/compute/reservations/:id`, `POST /v1/compute/reservations/:id/release`
- `GET /v1/compute/credits` (derived)
- `GET /v1/compute/stats`

## Run

```bash
pnpm install
cp .env.example .env
# edit .env (DATABASE_URL, JWT_SECRET)
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Test

```bash
# identity + qubic must be running
pnpm tsx scripts/e2e.ts
```
