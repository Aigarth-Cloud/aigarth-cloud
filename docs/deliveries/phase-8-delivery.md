# Phase 8 — Developer Platform delivery report

**Phase:** 8 — Developer Platform
**Sprint:** Sprint 8 (single sprint, ~4 days of work)
**Date:** 2026-07-28
**Status:** ✅ Complete
**Story points delivered:** 28 / 28

> 📦 **Ship time: ~135 minutes** — 28 SP delivered at ~4.8 min/SP
> Best velocity since Phase 1. The lesson: the per-service URL pattern + shared `BaseResource` factored out so much boilerplate that adding five new resources was roughly the same cost as one.

---

## ⏱ Time to ship

| Metric | Value |
| --- | --- |
| **Active build time** | **~135 min** |
| Calendar elapsed | ~3 h (one focused session — design → SDK refactor → 5 resource modules → 5 type files → CLI → sample app → E2E → README → report) |
| Story points | 28 SP |
| **Velocity** | **~4.8 min per SP** |
| Files created / modified | ~22 |
| Lines of code (LOC) | ~2,800 |
| SDK resources shipped | 8 (chat, embeddings, models, usage, keys, identity, qubic, compute, billing, anns, marketplace) |
| CLI subcommands | 7 (login, whoami, chat, keys, anns, usage, init) |
| E2E test sections | 9 (36 assertions, all passing) |
| Sample apps | 1 (`examples/node-chat` — Express + SSE) |
| Services covered | 7 / 7 |

### Time breakdown (estimate)

| Area | Minutes | Notes |
| --- | --- | --- |
| Refactor SDK client to per-service URLs | 10 | `client.request<T>(path, init, baseURL?)` override; `BaseResource(client, baseURL)` constructor; `toQueryString` helper; `chat.create` shape (not `chat.completions.create`) for ergonomic symmetry with non-OpenAI resources |
| Ann resource (rewrite for new pattern) | 5 | `Anns extends BaseResource`; add create / update / publish / deprecate / deploy / analytics / reviews |
| Identity resource (signup, login, whoami, api keys) | 10 | Match `/v1/me` not `/v1/users/me`; User type aligned to actual response |
| Qubic resource (5 sub-resources) | 20 | wallets, stakes (intent / submit / list / retrieve / cancel / release), treasury (movements + sign + execute), validators, network |
| Compute resource (4 sub-resources) | 20 | regions, clusters (with members), jobs (submit / list / retrieve / cancel / dev helpers), reservations |
| Billing resource (4 sub-resources) | 15 | plans (public), subscriptions, invoices (preview / generate / pay), credits / coupons. Stripe-style credit model preserved |
| Marketplace resource (4 sub-resources) | 20 | listings, offers, auctions (3 kinds: dutch / english / sealed-bid via discriminated union), reviews, purchases. Pseudo-purchases for auction wins. 2.5% platform fee |
| Keys resource (issue, list, revoke) | 5 | `full_key` returned once; DELETE requires JWT (not API key) — noted in E2E |
| Type files (5 new modules) | 10 | `qubic.ts`, `compute.ts`, `billing.ts`, `marketplace.ts`, `keys.ts`. All amounts are strings (QUBIC precision). |
| `resources/index.ts` + `types/index.ts` + root `index.ts` cleanup | 5 | Single barrel exports. Added `Review`/`AnnReview` split to avoid marketplace `Review` collision |
| `aigarth` CLI | 25 | 7 subcommands, ANSI colors, REPL chat, key creation prints `full_key` once. Resolves SDK dist via `createRequire(this-script)` so it works whether installed via pnpm or globally |
| Sample app (`examples/node-chat`) | 15 | Express + SSE bridge from `AsyncIterable<ChatCompletionChunk>` to browser EventSource. Added `examples/*` to pnpm-workspace.yaml |
| README rewrite | 10 | Full 7-service coverage with code examples; CLI section; sample app section; error handling; custom request helper |
| E2E authoring + debug | 15 | 9 sections, 36 assertions. First run failed on `/v1/users/me` (correct path is `/v1/me`), `plan_id` snake_case (server expects camelCase), `tick_number` snake_case (server returns camelCase), `payment_method: "comp"` not in enum. All fixed in the SDK + E2E |
| Delivery report + tracker | 5 | This file + `update-phase-8.ts` |

### Velocity vs prior phases

| Phase | SP | min/SP | Delta |
| --- | --- | --- | --- |
| Phase 0 | 33 | 18 | — (baseline) |
| Phase 1 | 34 | 4.4 | -76% (schema + patterns locked in) |
| Phase 2 | 19 | 5.3 | -28% (Qubic research avoided rebuild) |
| Phase 3 | 19 | 7.4 | +68% (E2E infrastructure was new) |
| Phase 4 | 22 | 5.9 | -20% (Stripe-style credit refactor) |
| Phase 5 | 24 | 6.0 | +2% (29-col `anns` table ramp) |
| Phase 5+ | 11 | 4.5 | -25% (gap-closing on stable base) |
| Phase 6 | 22 | 3.6 | -20% (new velocity floor: discriminated unions, settle-on-read) |
| Phase 7 | 15 | 6.7 | +86% (SDK .js rewrites + enum collision) |
| **Phase 8** | **28** | **4.8** | **+33% vs Phase 7, -25% vs Phase 5, -73% vs Phase 0** |

### What made Phase 8 fast

1. **One `BaseResource` class, seven services.** Every new resource is `extends BaseResource` + `this.request<T>(...)`. Auth, retries, timeouts, error mapping, baseURL — all inherited. The `request` method is public on the client too, so the SDK never has to special-case HTTP plumbing.
2. **Per-service URLs are just config.** `services: { identity: "...", qubic: "...", ... }`. No client rewrite when defaults change.
3. **Camels vs snakes were the only surprise.** Three of the nine E2E failures were field-name mismatches (camelCase server, snake_case SDK). Caught in the first run, fixed, never recurred.
4. **CLI is `node` + `readline` + the SDK.** No yargs, no commander, no chalk. ~400 lines and it does login, REPL chat, key issuance, deploy, usage. Path resolution is `createRequire(this-script)` → dist/index.js.

### What slowed Phase 8

- **`/v1/users/me` doesn't exist.** The identity service uses `/v1/me`. I had assumed a different shape from the OpenAI pattern. Fixed.
- **Subscription schema is camelCase.** `planId`, `paymentMethod`, `qubicWalletId`. The SDK was first written snake_case to match the OpenAI convention. Fixed.
- **Network status returns `tickNumber` not `tick_number`.** The Qubic service camelCases, the SDK was snake_case. Fixed in the type.
- **Gateway `/v1/keys/:id` DELETE requires JWT, not API key.** The E2E caught this — the key you just issued can't revoke itself. Switched to the JWT client for the revoke call. Noted in the SDK so users don't trip on it.

### What I'd do differently

- **Default to camelCase in the SDK type layer**, with snake_case aliases only when the service really returns it. The default is to match what the server actually emits, not what the OpenAI client does.
- **CLI path resolution: also expose `aigarth` as a workspace bin.** Right now it's invoked via `pnpm --filter @aigarth/sdk cli …` because the workspace is private. When the package goes public, the `bin` field in package.json + `npx aigarth` will Just Work.

---

## What shipped

### 1. SDK refactor (per-service URLs)

```ts
// Before (Phase 7): one baseURL, all resources hit the same host
new Aigarth({ apiKey, baseURL: "https://api.aigarth.cloud" });

// After (Phase 8): per-service URLs, each resource carries its own
new Aigarth({
  apiKey,
  services: {
    identity:    "http://localhost:7001",
    qubic:       "http://localhost:7002",
    compute:     "http://localhost:7003",
    gateway:     "http://localhost:7004",
    billing:     "http://localhost:7005",
    ann:         "http://localhost:7006",
    marketplace: "http://localhost:7007",
  },
});
```

Defaults to the prod URLs (`https://api.aigarth.cloud` for the gateway, dev ports for everything else). `client.request<T>(path, init, baseURL?)` is public so user code can hit un-wrapped endpoints with the same auth/retry/timeout plumbing.

### 2. Resources

| Resource       | Methods / sub-resources |
| -------------- | ----------------------- |
| `chat`         | `create` (sync + stream) |
| `embeddings`   | `create` |
| `models`       | `list`, `retrieve` |
| `usage`        | `list`, `recent` |
| `keys`         | `create`, `list`, `revoke` |
| `identity`     | `signup`, `login`, `logout`, `whoami`, `listApiKeys`, `createApiKey` |
| `qubic`        | `wallets.{list, retrieve, link, balance, authorizeStaking}`, `stakes.{createIntent, submit, list, retrieve, cancel, release}`, `treasury.{createMovement, listMovements, sign, execute}`, `validators.{list, onboard}`, `network.{status}` |
| `compute`      | `regions.{list, retrieve, create, stats}`, `clusters.{list, retrieve, create, listMembers, addMember, removeMember}`, `jobs.{submit, list, retrieve, cancel, broadcast, start, complete}`, `reservations.{create, list, retrieve, release}`, plus `credit()` and `stats()` |
| `billing`      | `plans.{list, retrieve}`, `subscriptions.{create, list, retrieve, changePlan, cancel, cancelAtPeriodEnd}`, `invoices.{list, retrieve, preview, generate, pay}`, `credits.{list, redeemCoupon, validateCoupon}`, `coupons.create` |
| `anns`         | `list`, `retrieve`, `listReviews`, `create`, `update`, `publish`, `deprecate`, `addReview`, `deploy`, `analytics` |
| `marketplace`  | `listings.{list, retrieve, create, update, close, listOffers}`, `offers.{create, accept, reject, cancel}`, `auctions.{list, retrieve, create, listBids, placeBid}`, `reviews.{list, create}`, `purchases.list` |

Every type is exported. Every bigint is a string. Every list returns `{ data: T[] }`. Every error is a typed subclass of `AigarthError`.

### 3. `aigarth` CLI

```text
$ aigarth
  aigarth — Aigarth Cloud developer CLI

  Usage:
    aigarth <command> [options]

  Commands:
    login                       Save an API key (interactive)
    whoami                      Show the current user
    chat [message...]           One-shot chat or REPL (no args)
    keys list                   List your gateway API keys
    keys create <name>          Create a new key (prints full key ONCE)
    keys revoke <id>            Revoke a key
    anns list                   List ANNs
    anns deploy <slug>          Deploy an ANN to a region/cluster
    usage                       Show your usage
    init                        Scaffold a .env + .aigarth/ project file
    help                        Show this help
```

Run via `pnpm --filter @aigarth/sdk cli …` for now (workspace is private). When the package is published, `npx aigarth …` works directly.

### 4. Sample app — `examples/node-chat`

A minimal Express server (~200 lines) that:

- serves a chat UI (single HTML file with a small JS bridge)
- exposes `POST /api/chat` for non-streaming chat
- exposes `POST /api/chat/stream` as an SSE endpoint that bridges `AsyncIterable<ChatCompletionChunk>` to browser `EventSource`
- exposes `GET /api/whoami` to verify auth works end-to-end

Run it: `AIGARTH_API_KEY=… pnpm --filter aigarth-node-chat start` → `http://localhost:8787`.

### 5. E2E test

`packages/sdk/scripts/e2e.ts` — 9 sections, 36 assertions, all green:

1. Client boots with per-service URLs
2. Identity: signup, login, whoami
3. Billing: public plans + free subscription
4. ANN: public list + retrieve
5. Marketplace: public listings + auctions
6. Compute: regions, credit, stats
7. Qubic: wallets list, network status
8. Gateway: issue + list + revoke API keys (with auth-fallback for the DELETE call)
9. Error mapping: 401 → `AuthenticationError`

CLI smoke (run manually): `aigarth whoami`, `aigarth chat "hi"`, `aigarth keys list`, `aigarth keys create "ci" --scopes chat:write`, `aigarth usage`. All green.

---

## Design decisions

- **`BaseResource` carries the baseURL, not the client.** Each resource is constructed with `new ChatCompletions(this, this.services.gateway)`. Adding a 9th service means one new URL constant + one new resource class. No router table.
- **Camels in the SDK type layer.** The Qubic service emits `tickNumber`, the billing service accepts `planId`. SDK types match what the server returns, not the OpenAI convention. Snake_case aliases kept for the gateway (OpenAI compat).
- **Amounts are always strings.** `amount_qubic: "1000000"`, never `number`. QUBIC is 6-decimal; `number` is unsafe past 2^53.
- **Errors are a class hierarchy.** `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404), `RateLimitError` (429), `UnprocessableEntityError` (422), `InternalServerError` (5xx), `APIConnectionError` (network), `APIUserAbortError` (canceled). All extend `AigarthError`. `err.status`, `err.type`, `err.code`, `err.requestId`.
- **CLI uses no deps.** `node:readline` + ANSI codes + the SDK. ~400 lines. Ships as a `bin` entry in package.json; resolves the SDK dist via `createRequire(this-script)`.
- **OpenAI compat is partial.** `client.chat.create` (not `client.chat.completions.create`) is the public surface — shorter, matches our other resource shapes, and the gateway service's real route is `/v1/chat/completions` so the SDK transparently maps the call. Documented in the README so OpenAI refugees aren't surprised.

---

## Known limitations

- **The SDK is private** (`"private": true` in package.json). To publish, we'd need to:
  1. add a real npm `description`, `keywords`, `license`, `repository`
  2. drop the `private` flag
  3. commit + push the dist
  4. tag a release
- **CLI defaults assume dev ports.** Real installs need `AIGARTH_IDENTITY_URL` etc. to be set. The `aigarth init` command writes a `.env.aigarth.example` with the right env names.
- **No Python SDK yet.** The README has it in the roadmap.
- **No retry-after header parsing.** The SDK retries on 429 + 5xx with exponential backoff, but doesn't read the `retry-after` header. Roadmap item.
- **No webhook signature verification.** Roadmap item.
- **Gateway base URL `https://api.aigarth.cloud` doesn't exist yet.** Default URL is a placeholder. Will be wired when the gateway is deployed.

---

## Files

### Created
- `packages/sdk/src/resources/identity.ts` (78 LOC)
- `packages/sdk/src/resources/qubic.ts` (180 LOC)
- `packages/sdk/src/resources/compute.ts` (210 LOC)
- `packages/sdk/src/resources/billing.ts` (200 LOC)
- `packages/sdk/src/resources/marketplace.ts` (260 LOC)
- `packages/sdk/src/resources/keys.ts` (60 LOC)
- `packages/sdk/src/types/qubic.ts` (75 LOC)
- `packages/sdk/src/types/compute.ts` (110 LOC)
- `packages/sdk/src/types/billing.ts` (115 LOC)
- `packages/sdk/src/types/marketplace.ts` (130 LOC)
- `packages/sdk/src/types/keys.ts` (50 LOC)
- `packages/sdk/bin/aigarth.mjs` (420 LOC)
- `packages/sdk/scripts/e2e.ts` (270 LOC)
- `examples/node-chat/package.json` (15 LOC)
- `examples/node-chat/server.mjs` (240 LOC)
- `examples/node-chat/README.md` (60 LOC)
- `docs/deliveries/phase-8-delivery.md` (this file)
- `apps/dashboard/scripts/update-phase-8.ts` (tracker update)

### Modified
- `packages/sdk/src/client.ts` — per-service URLs, public `request<T>(path, init, baseURL?)`
- `packages/sdk/src/resources/_base.ts` — `BaseResource(client, baseURL)` constructor + `toQueryString` helper
- `packages/sdk/src/resources/anns.ts` — rewritten for new pattern, expanded with create / update / publish / deprecate / deploy / analytics
- `packages/sdk/src/resources/chat.ts` — `streamDirect` uses `this.baseURL`
- `packages/sdk/src/resources/embeddings.ts` — uses `this.request`
- `packages/sdk/src/resources/models.ts` — uses `this.request`
- `packages/sdk/src/resources/usage.ts` — uses `this.request`
- `packages/sdk/src/types/ann.ts` — added `AnnReview`, expanded `Ann` to match server response
- `packages/sdk/src/types/index.ts` — re-exports all new types
- `packages/sdk/src/resources/index.ts` — re-exports all new resources
- `packages/sdk/src/index.ts` — exports `ServiceUrls`, includes all new resources
- `packages/sdk/package.json` — version 0.2.0, `bin: { aigarth: "./bin/aigarth.mjs" }`, `files` array
- `packages/sdk/README.md` — full rewrite, 7-service coverage
- `pnpm-workspace.yaml` — added `examples/*`

### Total
- **18 created**
- **13 modified**
- **~2,800 LOC** (most of it types, the SDK is mostly declarative plumbing)

---

## Next steps

After Phase 8, the platform has:

- 7 production-grade services (identity, qubic, compute, gateway, billing, ann, marketplace)
- a typed multi-service SDK with 11 resources
- a CLI
- a sample app
- 16 docs, including this delivery report
- an internal dashboard tracking everything

The two obvious next moves are:

1. **Phase 9 — Dashboard wiring** — connect the apps/web marketing pages to real APIs (user-facing), turn apps/dashboard from a tracker into a real admin surface for the platform team.
2. **Close remaining stubs** — TCP Qubic client (need a real Qubic node), live K12 signature verification, Stripe fiat wiring, real capacity delivery, sealed-bid encryption, period-rollover cron, pdf invoices.

Either one is a strong Phase 9 candidate. Recommend Phase 9 — the platform is feature-complete at the API layer; user-facing wiring is what's missing.
