# @aigarth/ann

Aigarth ANN Platform service.

## What it does

The ANN service is the registry + marketplace for Aigarth Neural Networks (ANNs). It manages:

- **ANNs** — canonical records for every published ANN
- **Versions** — immutable history (branch, rollback, audit)
- **Licenses** — Open / Commercial / Restricted / custom
- **Deployments** — one-click deploy to a compute cluster (services/compute)
- **Ratings + reviews** — peer feedback
- **Benchmarks** — verified accuracy / latency / cost numbers
- **Categories** — taxonomy (Medical, Legal, Finance, Coding, ...)
- **Marketplace browse** — public, with filters, search, sort
- **Audit log** — service-local

## Endpoints

Public (no auth):

```
GET    /healthz
GET    /readyz
GET    /v1/anns                    # marketplace browse
GET    /v1/anns/:id                # details
GET    /v1/anns/:id/versions
GET    /v1/anns/:id/ratings
GET    /v1/anns/:id/benchmarks
GET    /v1/anns/:id/deployments
GET    /v1/categories
GET    /v1/licenses
```

Authenticated (JWT):

```
POST   /v1/anns                    # create draft
PATCH  /v1/anns/:id                # update
POST   /v1/anns/:id/publish        # publish a draft
POST   /v1/anns/:id/deprecate      # deprecate
POST   /v1/anns/:id/versions       # add a new version
POST   /v1/anns/:id/deployments    # deploy (forwards to services/compute)
POST   /v1/anns/:id/deployments/:deployId/stop
POST   /v1/anns/:id/rate           # rate + review
POST   /v1/anns/:id/benchmark      # add benchmark
POST   /v1/anns/:id/sign           # sign with Qubic wallet
GET    /v1/me/anns                 # my created ANNs
GET    /v1/me/licenses             # ANNs I've licensed
```

## Run

```bash
# From project root
pnpm install
pnpm --filter @aigarth/ann db:migrate
pnpm --filter @aigarth/ann db:seed
pnpm --filter @aigarth/ann dev
```

## E2E

```bash
pnpm --filter @aigarth/ann tsx scripts/e2e.ts
```

## Port

`7006`

## Design notes

- All enums prefixed with `ann_` to avoid collisions with other services.
- `ann_audit_logs.action` is free-form text.
- All bigint amounts in QUBIC (no defaults — drizzle-kit can't serialize BigInt literals).
- Cross-service refs (`user_id`, `ann_id`, `version_id`, `deployment_id`) are stored as uuid without FK to other services.
- Slugs are URL-friendly identifiers derived from the name (kebab-case, lowercase, ASCII). Unique per ANN.
- The first version of an ANN is implicit; subsequent versions are explicit records.
- "Deployment" forwards to `services/compute` to create a real cluster placement. The deployment row in `ann_deployments` tracks the linkage and current status.
- Qubic wallet signing is format-only for now (real K12 verification is a TODO, see `services/identity/src/lib/qubic.ts`).
