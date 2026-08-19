# API Specification

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Engineering
**Last updated:** 2026-07-27
**Source docs:** [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DATA-MODEL.md`](./DATA-MODEL.md)

---

## 1. Style

- **Public APIs:** REST + JSON, OpenAPI 3.1 spec, versioned under `/v1/...`
- **Internal APIs:** REST or gRPC per service
- **Realtime:** WebSocket (Centrifugo) for dashboard live updates
- **Events:** NATS JetStream for inter-service pub/sub
- **Auth:** Bearer JWT in `Authorization` header, or API key as `Authorization: Bearer sk-aigarth-...`

All public responses are JSON. Errors follow RFC 7807 (Problem Details for HTTP APIs):

```json
{
  "type": "https://docs.aigarth.cloud/errors/quota_exceeded",
  "title": "Quota exceeded",
  "status": 429,
  "detail": "Your organization has used 100% of its monthly inference quota.",
  "instance": "/v1/chat/completions",
  "code": "quota_exceeded",
  "requestId": "req_abc123"
}
```

## 2. Versioning

- The URL path carries the version (`/v1/...`)
- Breaking changes require a new version (`/v2/...`)
- A deprecation header (`Sunset`) announces end-of-life at least 6 months in advance
- Each service exposes `GET /v1` returning its OpenAPI spec

## 3. Pagination

Cursor-based everywhere. No `offset`/`limit`.

```http
GET /v1/anns?limit=50&cursor=eyJpZCI6IjAx...
```

Response:
```json
{
  "data": [...],
  "hasMore": true,
  "nextCursor": "eyJpZCI6IjAx..."
}
```

## 4. Rate limiting

- Per API key, per org, per model
- `429` response includes `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Overage billing only happens for explicit opt-in (Enterprise plans)

## 5. Idempotency

All `POST` endpoints accept an `Idempotency-Key` header. Same key + same body = same response, no double-charge.

## 6. Endpoints (illustrative)

This is a non-exhaustive map. The full OpenAPI spec is generated per service and exposed at `/v1/openapi.json`.

### 6.1 Identity service (`identity.aigarth.cloud`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/users` | Create user |
| `GET` | `/v1/users/{id}` | Get user |
| `PATCH` | `/v1/users/{id}` | Update user |
| `DELETE` | `/v1/users/{id}` | Soft delete user |
| `POST` | `/v1/users/{id}/wallets` | Link a Qubic wallet |
| `POST` | `/v1/organisations` | Create org |
| `GET` | `/v1/organisations/{id}` | Get org |
| `PATCH` | `/v1/organisations/{id}` | Update org |
| `POST` | `/v1/organisations/{id}/members` | Add member |
| `DELETE` | `/v1/organisations/{id}/members/{userId}` | Remove member |
| `POST` | `/v1/api-keys` | Create API key (returns plaintext once) |
| `GET` | `/v1/api-keys` | List API keys |
| `DELETE` | `/v1/api-keys/{id}` | Revoke API key |
| `POST` | `/v1/sessions` | Create session (login) |
| `DELETE` | `/v1/sessions/{id}` | End session (logout) |
| `GET` | `/v1/audit-events` | List audit events |

### 6.2 AI Gateway (`api.aigarth.cloud`)

OpenAI-compatible. Drop-in replacement.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/chat/completions` | Chat completions |
| `POST` | `/v1/embeddings` | Embeddings |
| `POST` | `/v1/images/generations` | Image generation |
| `POST` | `/v1/images/edits` | Image editing |
| `POST` | `/v1/audio/speech` | Text-to-speech |
| `POST` | `/v1/audio/transcriptions` | Speech-to-text |
| `POST` | `/v1/videos/generations` | Video generation |
| `POST` | `/v1/fine-tuning/jobs` | Create fine-tune job |
| `GET` | `/v1/fine-tuning/jobs/{id}` | Get job status |
| `POST` | `/v1/batches` | Submit batch job |
| `GET` | `/v1/batches/{id}` | Get batch status |
| `GET` | `/v1/models` | List models |
| `GET` | `/v1/models/{id}` | Get model details |
| `GET` | `/v1/usage` | Per-key usage over a time range |

Example: Chat completions

```http
POST /v1/chat/completions
Authorization: Bearer sk-aigarth-...
Content-Type: application/json

{
  "model": "aigarth-reason-1",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is Useful Proof of Staking?"}
  ],
  "stream": true,
  "temperature": 0.7
}
```

Response (non-streaming):
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1753620000,
  "model": "aigarth-reason-1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Useful Proof of Staking is..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 24,
    "completion_tokens": 142,
    "total_tokens": 166
  }
}
```

### 6.3 Core service (`core.aigarth.cloud`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/regions` | List regions with capacity |
| `GET` | `/v1/nodes` | List compute nodes (operator-scoped) |
| `POST` | `/v1/nodes` | Register a node (operator) |
| `GET` | `/v1/clusters` | List clusters (org-scoped) |
| `POST` | `/v1/clusters` | Provision a cluster |
| `DELETE` | `/v1/clusters/{id}` | Drain a cluster |
| `GET` | `/v1/reservations` | List reservations |
| `GET` | `/v1/jobs` | List jobs (paginated, filterable) |
| `GET` | `/v1/jobs/{id}` | Get job detail |
| `POST` | `/v1/jobs/{id}/cancel` | Cancel a queued job |

### 6.4 Qubic service (`qubic.aigarth.cloud`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/stakes` | List org stakes |
| `POST` | `/v1/stakes` | Create a stake |
| `POST` | `/v1/stakes/{id}/cooldown` | Begin cool-down |
| `POST` | `/v1/stakes/{id}/withdraw` | Withdraw after cool-down |
| `GET` | `/v1/rewards` | Reward history |
| `POST` | `/v1/rewards/claim` | Claim pending rewards |
| `GET` | `/v1/transactions` | Transaction history |
| `GET` | `/v1/transactions/{hash}` | Single tx status |
| `GET` | `/v1/pools` | Stake pools with APY |
| `GET` | `/v1/treasury` | Treasury state |

### 6.5 ANN service (`ann.aigarth.cloud`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/anns` | Search/list ANNs |
| `POST` | `/v1/anns` | Create ANN (draft) |
| `GET` | `/v1/anns/{id}` | Get ANN |
| `PATCH` | `/v1/anns/{id}` | Update ANN |
| `POST` | `/v1/anns/{id}/versions` | Publish a new version |
| `GET` | `/v1/anns/{id}/versions` | List versions |
| `POST` | `/v1/anns/{id}/deployments` | Deploy a version |
| `GET` | `/v1/anns/{id}/deployments` | List deployments |
| `GET` | `/v1/anns/{id}/analytics` | Usage + revenue |
| `GET` | `/v1/categories` | ANN categories |
| `POST` | `/v1/anns/{id}/ratings` | Rate an ANN |
| `GET` | `/v1/anns/{id}/ratings` | List ratings |

### 6.6 Marketplace service (`marketplace.aigarth.cloud`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/listings` | Search listings |
| `POST` | `/v1/listings` | Create listing |
| `GET` | `/v1/auctions` | Live auctions |
| `POST` | `/v1/auctions/{id}/bids` | Place a bid |
| `GET` | `/v1/market-depth` | Order book for a resource |
| `GET` | `/v1/historical-pricing` | Time series of prices |
| `GET` | `/v1/reviews` | Reviews for a target |

### 6.7 Billing service (`billing.aigarth.cloud`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/customers` | Customer record |
| `POST` | `/v1/subscriptions` | Create subscription |
| `PATCH` | `/v1/subscriptions/{id}` | Change plan |
| `DELETE` | `/v1/subscriptions/{id}` | Cancel |
| `GET` | `/v1/invoices` | List invoices |
| `GET` | `/v1/invoices/{id}` | Invoice detail |
| `GET` | `/v1/invoices/{id}/pdf` | Invoice PDF |
| `GET` | `/v1/usage` | Usage records |
| `GET` | `/v1/credits` | Credit balance + history |
| `POST` | `/v1/payment-methods` | Add card / wallet |

### 6.8 Genesis service (`genesis.aigarth.cloud`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/rounds` | Current / past rounds |
| `GET` | `/v1/rounds/{id}` | Round detail |
| `POST` | `/v1/rounds/{id}/participate` | Express interest |
| `GET` | `/v1/allocations` | My allocations |
| `GET` | `/v1/vesting` | Vesting schedule |

## 7. WebSocket events

Live updates for the dashboard, available via `wss://ws.aigarth.cloud/v1`.

Subscribe to channels:
- `org.{organisationId}.usage` — usage updates
- `org.{organisationId}.billing` — invoices, payments
- `org.{organisationId}.alerts` — alerts
- `user.{userId}.notifications` — in-app notifications
- `ann.{annId}.calls` — live call counter
- `cluster.{clusterId}.telemetry` — cluster health

Frame format:
```json
{
  "channel": "org.123.usage",
  "event": "usage.record.created",
  "data": {...},
  "ts": 1753620000
}
```

## 8. Error codes (selected)

Stable machine-readable codes. Always return `code` in the error body.

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Schema validation failed |
| 401 | `unauthenticated` | Missing or invalid token |
| 403 | `forbidden` | Token valid but lacks scope |
| 404 | `not_found` | Resource doesn't exist or you can't see it |
| 409 | `conflict` | State conflict (e.g. duplicate idempotency key with different body) |
| 422 | `unprocessable` | Validation passed but business rule failed |
| 429 | `rate_limited` | Rate limit exceeded |
| 429 | `quota_exceeded` | Plan quota exceeded |
| 500 | `internal` | Server error |
| 503 | `unavailable` | Temporary outage, retry with backoff |

## 9. Linked documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`DATA-MODEL.md`](./DATA-MODEL.md)
- [`SECURITY.md`](./SECURITY.md)
