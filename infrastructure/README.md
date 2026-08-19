# Local infrastructure

A single `docker compose up` brings up the full local stack:

| Service   | Port  | Purpose                                      |
| --------- | ----- | -------------------------------------------- |
| Postgres  | 5432  | Identity, Core, Billing, ANN registry        |
| Redis     | 6379  | Sessions, rate limits, ephemeral state      |
| NATS      | 4222  | Event bus, Qubic event ingestion             |
| MinIO     | 9000  | S3-compatible object storage (artifacts, ANN weights) |
| MailHog   | 1025  | Dev SMTP (web UI on 8025)                    |

## Quick start

```sh
cp infrastructure/.env.example .env
pnpm stack:up
pnpm stack:ps
```

The `minio-init` sidecar creates the `aigarth` bucket on first boot.

## Resetting

```sh
pnpm stack:down -v  # also remove volumes
pnpm stack:up
```

## Notes

- All data is persisted in volumes next to the compose file
  (`.pgdata`, `.redisdata`, `.natsdata`, `.miniodata`).
- These are gitignored.
- For services that need to talk to each other, use the service name
  (`postgres`, `redis`, `nats`, `minio`) as the hostname.
- The dashboard tracker still uses local SQLite — the Postgres here is for
  the future backend services.
