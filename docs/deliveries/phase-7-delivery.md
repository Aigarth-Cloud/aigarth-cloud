# Phase 7 — AI Gateway delivery report

**Phase:** 7 — AI Gateway
**Sprint:** Sprint 7 (single sprint, ~5 days of work)
**Date:** 2026-07-28
**Status:** ✅ Complete (against stub backends)
**Story points delivered:** 15 / 15

> 📦 **Ship time: ~100 minutes** — 15 SP delivered at ~6.7 min/SP
> A bit slower than Phase 2 (5.3) because of two unexpected costs: (1) the @aigarth/sdk needed .js extension rewrites + dist build to be importable, and (2) the api_key_status enum name collided with identity's. Both are reusable lessons; the next phase is back to ~5 min/SP territory.

---

## ⏱ Time to ship

| Metric | Value |
| --- | --- |
| **Active build time** | **~100 min** |
| Calendar elapsed | ~2.5 h (one focused session — design → scaffold → schema → backends → services → routes → migrations → E2E → SDK wiring → report) |
| Story points | 15 SP |
| **Velocity** | **~6.7 min per SP** |
| Files created / modified | ~32 |
| Lines of code (LOC) | ~2,100 |
| Endpoints shipped | 10 |
| E2E test sections | 13 (50+ assertions, all passing) |
| DB tables | 6 (5 domain + 1 service-local audit log) |
| Models seeded | 4 (2 chat, 1 embed, 1 image) |
| API key format | `ak_live_<8char-prefix>.<43char-secret>` |

### Time breakdown (estimate)

| Area | Minutes | Notes |
| --- | --- | --- |
| Design schema + service shape | 5 | Models, deployments, requests, api_keys, rate_limits, audit log. Bigint without defaults, audit log prefixed (Phase 3 lesson). |
| Service scaffold (Fastify + Drizzle + node-postgres, port 7004) | 5 | Same pattern as identity/Qubic/compute. JWT verify only. |
| Stub backends (chat sync, chat stream, embeddings, images) | 15 | Deterministic responses keyed on input hash. Embeddings produce unit vectors. Image returns picsum.photos URLs. |
| API key management | 10 | Issue, list, revoke. Verify on every request. `verifyApiKey` returns the full key row. |
| Usage tracking + rate limiting | 15 | Every call logged to `gateway_requests`. Sliding-window rate limit per key per minute. |
| Routes (10 endpoints) | 15 | Models, keys, chat (sync + SSE), embeddings, images, usage. |
| Migrations + typecheck + seed + start | 5 | First run hit `api_key_status` enum collision; renamed to `gateway_api_key_status`. |
| E2E authoring + run | 10 | 13 sections, 50+ assertions, green on the first complete run. |
| @aigarth/sdk → gateway integration | 15 | Added .js extensions to SDK imports, switched package.json main to dist, rebuilt, smoke-tested (list, chat, stream, embed all work). |
| Phase 7 delivery report | 5 | |

### Velocity vs prior phases

| Phase | SP | min/SP | Delta |
| --- | --- | --- | --- |
| Phase 0 | 33 | 18 | — (baseline) |
| Phase 1 | 34 | 4.4 | -76% (schema + patterns locked in) |
| Phase 3 | 19 | 7.4 | +68% (E2E infrastructure was new) |
| Phase 2 | 19 | 5.3 | -28% (Qubic research avoided rebuild) |
| **Phase 7** | **15** | **6.7** | **+26% vs Phase 2, -10% vs Phase 3, -63% vs Phase 0** |

### Known limitations affecting build time

- **SDK .js extensions.** The SDK was authored with extensionless imports (works for bundlers + tsx). Compiling to dist for Node ESM consumption required rewriting every import to use `.js`. 5 minutes of scripted work + 5 minutes of debugging. **Permanent fix:** add a tsconfig with `moduleResolution: NodeNext` to the SDK so this is automatic.
- **Enum name collision with identity.** The gateway's `api_key_status` enum collided with identity's same-named enum. Renamed to `gateway_api_key_status`. **Permanent fix:** all service enums should follow `{service}_{enum_name}` from the start (a stricter form of the audit-log-naming lesson).
- **OpenAI SDK shape divergence.** The @aigarth/sdk uses `client.chat.create(...)` while OpenAI's uses `client.chat.completions.create(...)`. This was pre-existing, not Phase 7's doing, but it surfaced during SDK smoke testing. **Decision:** keep @aigarth/sdk's shape — `client.chat.create` is shorter and matches our internal resources. Update the SDK README to note this divergence.

---

## TL;DR

The Aigarth AI Gateway is up. It's the OpenAI-compatible surface for the whole platform: `/v1/models`, `/v1/chat/completions` (sync + SSE streaming), `/v1/embeddings`, `/v1/images/generations`, `/v1/keys`, `/v1/usage`. Every call is logged for billing; every key has a sliding-window rate limit; the chat/embed/image backends are deterministic stubs that produce OpenAI-shaped responses. **The @aigarth/sdk now consumes the gateway end-to-end** — a developer can `import { Aigarth } from "@aigarth/sdk"` and hit `localhost:7004` with no other setup. When real model providers land, only the `backends/stub.ts` module needs to change.

## What was built

### Service scaffold

`services/gateway` — Fastify 4 + Drizzle 0.42 (thenable API) + node-postgres + `@fastify/jwt` + `@fastify/cookie` + `@fastify/cors` + `@fastify/helmet` + `pino` + `zod`. Same patterns as identity/qubic/compute.

- **Port:** 7004
- **Auth:** Dual-mode — accepts both **JWT** (from identity service) and **gateway API key** (`ak_live_<prefix>.<secret>`). Unified `authenticateRequest` helper for chat/embeddings/images; Fastify `app.authenticate` decorator (JWT-only) for /v1/keys and /v1/usage.
- **Health:** `/healthz` + `/readyz`
- **Plugin order:** helmet → cors → cookie → jwt → routes

### Schema (6 tables)

| Table | Purpose | Rows |
| --- | --- | --- |
| `gateway_models` | Registered models (id is the public model name, e.g. `aigarth-meridian-1`) | 13 cols, 2 idx |
| `gateway_deployments` | Model × region × cluster mapping (routing) | 7 cols, 2 idx, 1 FK |
| `gateway_api_keys` | Gateway-issued API keys (separate prefix from identity's org keys) | 16 cols, 3 idx |
| `gateway_requests` | Every API call, with usage + cost + duration + status | 18 cols, 5 idx, 1 FK |
| `gateway_rate_limits` | Per-key per-minute sliding-window counters | 5 cols, 1 idx, 1 FK |
| `gateway_audit_logs` | Service-local audit log (free-form action) | 8 cols, 3 idx |

**Design choices:**
- `gateway_api_key_status` enum (renamed from `api_key_status` to avoid collision with identity).
- All bigint amounts in QUBIC (smallest unit). No defaults (drizzle-kit can't serialize BigInt literals).
- `gateway_audit_logs` renamed to avoid collision.
- API key secret stored as `sha256(secret)` + `last4` for display. Full secret returned **once** at creation.
- Rate limit is atomic via `INSERT ... ON CONFLICT DO UPDATE` on the (api_key_id, window) unique index.

### Stub backends (`src/backends/stub.ts`)

Deterministic, in-memory implementations of the three modalities. All keyed on `sha256(input)` so the same input always produces the same output.

| Backend | Behavior |
| --- | --- |
| **chat** (sync) | Returns `chat.completion` with one choice. `content` includes the user's last message (truncated) + a `[stub:<hash>]` marker. Token counts are estimated. |
| **chat** (stream) | Same as sync, but emits SSE chunks word-by-word with a 5ms gap. Final chunk has `finish_reason: "stop"`. |
| **embeddings** | Returns N deterministic 1536-dim unit vectors derived from `sha256(text)`. Same input → identical vector. |
| **image** | Returns N placeholder URLs (`https://picsum.photos/seed/<hash>/<size>`). |

When real providers land, only this module needs to change.

### Endpoints (10 total)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/healthz` | none | Liveness |
| GET | `/readyz` | none | Readiness (DB ping) |
| GET | `/v1/models` | none | Public model catalog (OpenAI-shaped) |
| GET | `/v1/models/:id` | none | One model |
| POST | `/v1/keys` | JWT | Issue gateway API key (returns full key once) |
| GET | `/v1/keys` | JWT | List user's keys |
| DELETE | `/v1/keys/:id` | JWT | Revoke |
| POST | `/v1/chat/completions` | JWT or key | Chat (sync or SSE stream) |
| POST | `/v1/embeddings` | JWT or key | Embeddings |
| POST | `/v1/images/generations` | JWT or key | Image generation |
| GET | `/v1/usage` | JWT | Aggregate usage (by model, by endpoint) |
| GET | `/v1/usage/recent` | JWT | Recent request log |

### Unified auth (`src/lib/auth.ts`)

The chat/embeddings/images routes accept both JWTs and API keys via the `authenticateRequest(req)` helper. Returns:
- `{ kind: "jwt", userId }` for first-party clients
- `{ kind: "api_key", userId, key: GatewayApiKey }` for SDK clients (so we can also rate-limit + log which key was used)

The Fastify `app.authenticate` decorator is JWT-only and used by `/v1/keys` and `/v1/usage` (admin endpoints, no key needed).

### Usage tracking + rate limiting

Every API call writes a row to `gateway_requests` with: user_id, org_id, api_key_id, model, endpoint, status_code, duration_ms, prompt_tokens, completion_tokens, total_tokens, cost_qubic, ip, user_agent, request_body, response_body, error_message.

`GET /v1/usage` aggregates: total_requests, total_tokens (split prompt/completion), total_cost_qubic, by_model (sorted by cost), by_endpoint (sorted by cost).

Rate limiting is sliding-window per minute per API key, with per-key overrides. Limits: 60 RPM / 100k TPM by default. `429` responses include `Retry-After` and the rpm/tpm counters.

### Pricing

Per-model, per-1K-tokens, in QUBIC:
- `aigarth-meridian-1`: 10/30 (input/output)
- `aigarth-meridian-1-pro`: 30/90
- `aigarth-embed-1`: 1/0
- `aigarth-image-1`: 100/image

Cost is computed on submit (and refunded on cancel-while-pending, when we add cancel). For Phase 7, all costs are in-stub and not yet debited from a real Qubic balance.

### Seeded models

`pnpm db:seed` populates 4 models, each with a `global` deployment:
- `aigarth-meridian-1` (chat, 8K ctx, 10/30 Qu)
- `aigarth-meridian-1-pro` (chat, 32K ctx, 30/90 Qu)
- `aigarth-embed-1` (1536-dim, 1 Qu/1K tok)
- `aigarth-image-1` (1024x1024, 100 Qu/image)

All routed to the `inference-pool` cluster for chat/embed and `general-pool` for image (matching what Phase 2's compute service seeds).

## @aigarth/sdk → gateway round-trip

Added `@aigarth/sdk` as a dependency of `services/gateway`. The SDK previously pointed to `src/index.ts` (worked for bundlers); switched it to `dist/index.js` and added `.js` extensions to all source imports so the compiled output works under Node ESM.

Built the SDK (`pnpm --filter @aigarth/sdk build`), then verified the smoke test (`scripts/sdk-smoke.ts`):

```
SDK listed 4 models via gateway
SDK chat: This is a stub response from aigarth-meridian-1. You said: "... (34 tokens)
SDK stream: This is a stub response from aigarth-meridian-1. You said: "…
SDK embed: 1536-dim vector
✅ SDK → gateway round-trip works
```

The SDK now works end-to-end. The only divergence from OpenAI's shape is that we use `client.chat.create(...)` not `client.chat.completions.create(...)` — shorter and matches our internal resources. (Noted for a future SDK README update.)

## What we did NOT build (deferred)

The original Phase 7 ROADMAP listed:
- Image API (edits, variations) — **deferred.** `generations` is enough for stub.
- Video API — **deferred to a future phase.** No real provider available.
- Audio API (TTS, STT, real-time voice) — **deferred to a future phase.**
- Fine-tuning API (SFT, DPO, RLHF) — **deferred to a future phase.** Heavy lift; needs Phase 5 (ANN Platform) to be designed first.
- Batch API (async, 24h SLA) — **deferred.** Not in critical path.
- Cross-service integration with services/compute (route jobs to specific clusters) — **deferred.** The deployment table has `region` and `clusterHint` fields; wiring the actual `services/compute.broadcastJob` call needs the compute service to expose a real broadcast endpoint.
- Webhook delivery (request.completed, request.failed) — **deferred.** Add when Phase 4 (Billing) needs it.
- Provider plug-in system (OpenAI, Anthropic, local) — **deferred.** The current code is "one stub for everything". A plug-in system needs design.
- Streaming cancel — **deferred.** A user can disconnect the SSE stream but the server keeps running the model call to completion (waste). Add cancellation in a future phase.

The reason: Phase 7's job is "the gateway surface exists and is OpenAI-shaped". Real provider integration is its own phase.

## Acceptance criteria

From `docs/SPRINT-PLAN.md` §Phase 7:

- ✅ Chat API (`/v1/chat/completions`) — sync + SSE streaming
- ✅ Embeddings API (`/v1/embeddings`)
- ✅ Image API (`/v1/images/generations`) — stub
- ✅ Rate limiting (per-key, per-min) — sliding window
- ✅ Usage tracking (every call logged + aggregated)
- 🟡 Image API (edits, variations) — deferred
- 🟡 Video API — deferred
- 🟡 Audio API — deferred
- 🟡 Fine-tuning API — deferred
- 🟡 Batch API — deferred
- 🟡 Cross-service compute routing — deferred to Phase 2 integration

## Verification

E2E test (`services/gateway/scripts/e2e.ts`) — 50+ assertions across 13 sections, all passing:

```
1. Health + public model catalog             ✓ (4 models)
2. Auth required for /v1/keys                 ✓ (401)
3. Create user via identity, log in           ✓
4. Issue gateway API key                      ✓ (ak_live_<prefix>.<secret>, full returned once)
5. Chat completion (sync) via JWT             ✓ (44 tokens)
6. Chat completion (sync) via API key         ✓
7. Chat completion (SSE streaming)            ✓ (27 chunks, ends with [DONE])
8. Embeddings                                 ✓ (1536-dim, deterministic, batch works)
9. Image generation                           ✓ (2 URLs)
10. Usage tracking                            ✓ (7 requests, 132 tokens, 403 Qu, by_model + by_endpoint)
11. Validation: bad model + bad input        ✓ (404, 400, 400)
12. Invalid API key → 401                     ✓ (invalid + malformed)
13. Revoke API key                            ✓ (post-revoke calls → 401)
=== ✅ All Phase 7 E2E assertions passed ===
```

SDK smoke test (`scripts/sdk-smoke.ts`) — 4 calls, all green:
- list models → 4 models
- chat.create (sync) → 34 tokens
- chat.create (stream) → chunked
- embeddings.create → 1536-dim vector

Run:
```bash
# Identity must be running on 7001
pnpm --filter @aigarth/identity dev

# Gateway in one terminal
pnpm --filter @aigarth/gateway db:seed
pnpm --filter @aigarth/gateway dev

# E2E
pnpm --filter @aigarth/gateway tsx scripts/e2e.ts

# SDK smoke
pnpm --filter @aigarth/gateway tsx scripts/sdk-smoke.ts
```

## Decisions made

- **Dual auth (JWT or API key) for `/v1/*`.** The OpenAI ecosystem expects bearer API keys; the dashboard expects bearer JWTs. Both work.
- **Deterministic stub backends keyed on input hash.** Same input always produces the same output, so E2E tests are stable. Real provider integration is a single-module swap.
- **API key format: `ak_live_<8prefix>.<43secret>`.** Same prefix as identity's org keys (intentional — visually consistent). The gateway's are separate rows in `gateway_api_keys`, not identity's `api_keys`.
- **Sliding-window rate limiting in Postgres.** Upsert on (api_key_id, window) for atomic counter increment. One row per key per minute.
- **Per-model pricing in QUBIC.** The same cost model the compute service uses. Phase 4 (Billing) will debit actual Qubic balances; Phase 7 just records the cost.
- **SSE streaming with a 5ms-per-word delay.** Makes the stream feel like a real LLM response. Real impl would have variable per-token delays.
- **Server-Sent Events (SSE) not WebSockets.** SSE is unidirectional (server → client) which matches the OpenAI streaming protocol. No need for WebSocket complexity.
- **Unified audit log per service** (renamed to `gateway_audit_logs`). Same pattern as identity/qubic/compute.
- **Enums prefixed with `gateway_`.** New lesson — collisions with identity's enums caught us at migration time. Going forward, all enums follow `{service}_{enum_name}`.
- **SDK package.json main points to dist.** Originally pointed to src (works for bundlers + tsx). Switched to dist so it works for plain Node ESM too. Required .js extensions on every import in the SDK source — added via a one-time scripted rewrite.

## Known limitations

- **All backends are stubs.** Real provider integration (OpenAI, Anthropic, local models) requires swapping `src/backends/stub.ts` with provider-specific modules.
- **No streaming cancel.** A user disconnecting mid-stream still incurs the full token cost. The stub backend completes in <1s so this doesn't matter for Phase 7, but production needs a Cancel-Channel via AbortController.
- **No request size limits per user.** A user could submit a 200-message chat (max is 200 per the schema) and burn a lot of credits. Phase 4 (Billing) will add per-user spend caps.
- **No response caching.** The same prompt always produces the same response in stub mode (deterministic), but we don't cache it. Real impl should cache common prompts for 60s.
- **No timeout on the response body.** A pathological client could keep an SSE connection open forever. Fastify has a default idle timeout, but explicit connection-timeout would be better.
- **No Vitest unit tests.** Only E2E + smoke. Same pattern as the other services.
- **Rate limit is per-key, not per-endpoint.** A user with one key can hit chat, embed, AND image at the same time. Per-endpoint limits are a future improvement.
- **JWT verify uses standalone HMAC** (in `lib/auth.ts`) rather than the Fastify plugin because we need to also accept API keys. The Fastify plugin path is unused for chat/embed/images — only used for /v1/keys and /v1/usage.

## Phase 7 exit criteria (from sprint plan)

> Phase 7 ships the OpenAI-compatible layer. Every model, every backend, one stable external surface.

**Status:** ✅ Met (against stub backends). The SDK consumes it. Real provider integration is the next sprint.

## Links

- [Phase 7 schema](../../services/gateway/src/db/schema.ts)
- [Stub backends](../../services/gateway/src/backends/stub.ts)
- [Unified auth (JWT + API key)](../../services/gateway/src/lib/auth.ts)
- [Chat route (sync + SSE)](../../services/gateway/src/routes/chat.ts)
- [Embeddings route](../../services/gateway/src/routes/embeddings.ts)
- [Image generation route](../../services/gateway/src/routes/images.ts)
- [API keys](../../services/gateway/src/services/api-keys.ts)
- [Usage tracking](../../services/gateway/src/services/usage.ts)
- [Rate limiting](../../services/gateway/src/services/rate-limit.ts)
- [Seed script](../../services/gateway/src/db/seed.ts)
- [E2E test](../../services/gateway/scripts/e2e.ts)
- [SDK smoke test](../../services/gateway/scripts/sdk-smoke.ts)
- [Sprint plan §Phase 7](../SPRINT-PLAN.md)

## What's next

**Phase 4 — Billing** is the natural next step. The gateway has usage tracking (`gateway_requests.cost_qubic` per call). The compute service has reservations + credits. Phase 4 ties them together: aggregate gateway usage → invoices → payments. The pricing model is already set; we just need a billing surface.

**Alternative: A provider-plug-in system for the gateway.** Swap the stub backends for real provider calls (OpenAI, Anthropic, local). One provider per model. Real chat, real embeddings.

**Open question for the user:** Which one is more important right now — the revenue side (Phase 4) or the substance side (real providers)? Real providers would let you actually use the gateway for something; Phase 4 would let you bill for it.

**Another open question:** Cross-service integration. The gateway has `clusterHint` in deployments but doesn't actually call services/compute. Worth wiring so a chat completion can pick a specific cluster (e.g. inference-pool)?
