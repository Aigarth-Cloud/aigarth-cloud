# Aigarth AI Gateway

OpenAI-compatible API surface for the Aigarth Cloud platform. Stub backends for Phase 7; pluggable for real LLMs.

Port: **7004**

## Endpoints

- `GET /v1/models` — list available models
- `GET /v1/models/:id` — get one
- `POST /v1/chat/completions` — chat (sync + SSE streaming)
- `POST /v1/embeddings` — embeddings
- `POST /v1/images/generations` — image generation (stub)
- `GET /v1/usage` — usage stats
- `POST /v1/keys` — issue gateway API key
- `GET /v1/keys` — list user's keys
- `DELETE /v1/keys/:id` — revoke

## Auth

Two ways to authenticate:
- **Bearer JWT** (signed by the identity service) — for first-party / dashboard clients
- **Bearer API key** (`ak_live_<prefix>.<secret>`) — for SDK / external clients

API keys are gateway-specific (separate from the identity service's `ak_live_` org keys — same prefix, different domain).

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
# identity must be running on 7001
pnpm tsx scripts/e2e.ts
```
