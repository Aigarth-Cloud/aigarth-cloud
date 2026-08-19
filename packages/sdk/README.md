# `@aigarth/sdk`

Typed, multi-service client for the **Aigarth Cloud** developer platform.
One client, seven services — gateway, identity, qubic, compute, billing,
ANN, and marketplace.

The Phase-8 deliverable. The SDK also ships with a CLI (`aigarth`) and
a Node sample app.

---

## Install

```bash
pnpm add @aigarth/sdk
```

## Quick start

```ts
import { Aigarth } from "@aigarth/sdk";

const client = new Aigarth({
  apiKey: process.env.AIGARTH_API_KEY!,
  // Override per-service URLs in dev. Defaults point at production.
  services: {
    identity: "http://localhost:7001",
    qubic:    "http://localhost:7002",
    compute:  "http://localhost:7003",
    gateway:  "http://localhost:7004",
    billing:  "http://localhost:7005",
    ann:      "http://localhost:7006",
    marketplace: "http://localhost:7007",
  },
});

// OpenAI-compatible chat
const completion = await client.chat.create({
  model: "aigarth-meridian-1",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(completion.choices[0]?.message?.content);

// And anything from the other six services:
const me         = await client.identity.whoami();
const listings   = await client.marketplace.listings.list();
const credit     = await client.compute.credit();
const plans      = await client.billing.plans.list();
const anns       = await client.anns.list({ category: "language" });
const wallets    = await client.qubic.wallets.list();
```

You can pass a JWT (from `/v1/auth/login`) **or** a gateway API key
(`ak_live_<prefix>.<secret>`) as `apiKey`. The SDK auto-detects
`ak_live_*` and forwards it as a Bearer token.

---

## Resources

| Resource                    | Service      | Auth     | Notes                                                   |
| --------------------------- | ------------ | -------- | ------------------------------------------------------- |
| `client.chat`               | gateway      | key/jwt  | OpenAI-compatible, streaming via `AsyncIterable`        |
| `client.embeddings`         | gateway      | key/jwt  |                                                         |
| `client.models`             | gateway      | key/jwt  | public                                                   |
| `client.usage`              | gateway      | key/jwt  |                                                         |
| `client.keys`               | gateway      | jwt      | manage gateway API keys                                 |
| `client.identity`           | identity     | jwt      | signup / login / whoami / API keys                      |
| `client.qubic`              | qubic        | jwt      | wallets, stakes, treasury, validators, network status   |
| `client.compute`            | compute      | jwt      | regions, clusters, jobs, reservations, credit, stats   |
| `client.billing`            | billing      | jwt      | plans, subscriptions, invoices, payments, credits       |
| `client.anns`               | ann          | mixed    | public list, authenticated write; reviews, deploy       |
| `client.marketplace`        | marketplace  | mixed    | listings, offers, auctions (3 kinds), bids, reviews     |

---

## Examples

### Chat (streaming)

```ts
const stream = await client.chat.create({
  model: "aigarth-meridian-1",
  messages: [{ role: "user", content: "Stream me a haiku." }],
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) process.stdout.write(delta);
}
```

### Signup + login

```ts
await fetch(`${services.identity}/v1/auth/signup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, name }),
});

const res = await fetch(`${services.identity}/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const { access_token } = await res.json();

const client = new Aigarth({ apiKey: access_token, services });
const me = await client.identity.whoami();
```

### Issue a gateway API key

```ts
const { full_key, ...keyInfo } = await client.keys.create({
  name: "production",
  scopes: ["chat:read", "chat:write"],
});
// `full_key` is returned ONCE. Store it in your secret manager.
```

### Browse + deploy an ANN

```ts
const { data } = await client.anns.list({ category: "language", limit: 10 });
const a = data[0]!;

const result = await client.anns.deploy(a.id, {
  regionId: "eu-west",
  clusterId: "primary",
  replicas: 1,
});
```

### Buy capacity from the marketplace

```ts
const listings = await client.marketplace.listings.list({ kind: "spot" });
const l = listings.data[0]!;
const offer = await client.marketplace.offers.create({
  listing_id: l.id,
  amount_qubic: "1000000", // 1 Qu
  message: "Need 1M tokens for evaluation",
});
```

### Mint + sign a Qubic stake

```ts
const intent = await client.qubic.stakes.createIntent({
  wallet_id,
  amount_qubic: "100000000", // 100 Qu
  epochs_locked: 90,
  receiver_address: "...",
});

// Sign `intent.message` with your Qubic wallet, then submit.
const result = await client.qubic.stakes.submit(intent.stake_id, {
  signature: "<k12-signature-hex>",
  tick_number: intent.tick_number,
});
```

### Subscribe to a paid plan

```ts
const { data: plans } = await client.billing.plans.list();
const pro = plans.find((p) => p.tier === "pro")!;

const sub = await client.billing.subscriptions.create({
  planId: pro.id,
  paymentMethod: "qubic",
  qubicWalletId: wallet.id,
});

const preview = await client.billing.invoices.preview({ subscriptionId: sub.id });
console.log(`Next invoice: ${preview.total_qubic} Qu (${preview.credit_will_be_applied_qubic} Qu credits applied)`);
```

---

## Error handling

```ts
import {
  AigarthError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitError,
  APIConnectionError,
  BadRequestError,
  UnprocessableEntityError,
  InternalServerError,
} from "@aigarth/sdk";

try {
  await client.identity.whoami();
} catch (err) {
  if (err instanceof AuthenticationError) {
    // 401 — refresh token / re-login
  } else if (err instanceof PermissionDeniedError) {
    // 403 — request additional scopes
  } else if (err instanceof RateLimitError) {
    // 429 — back off, check `err.headers` for retry-after
  } else if (err instanceof APIConnectionError) {
    // network / DNS / TLS — safe to retry
  } else if (err instanceof AigarthError) {
    // base class; err.status, err.type, err.code, err.requestId
  } else {
    throw err;
  }
}
```

## Custom requests

The `client.request(path, init, baseURL?)` method is public. It handles
auth, timeouts, retries, and error mapping, so you can hit any service
endpoint that's not yet wrapped:

```ts
const raw = await client.request<{ data: unknown[] }>(
  "/v1/some/custom/route",
  { method: "POST", body: JSON.stringify({...}) },
  client.services.billing, // baseURL override
);
```

---

## CLI

The package ships a `aigarth` CLI for quick ops:

```bash
pnpm --filter @aigarth/sdk cli init         # scaffold .aigarth/ + .env.aigarth.example
pnpm --filter @aigarth/sdk cli login        # save an API key (interactive)
pnpm --filter @aigarth/sdk cli whoami
pnpm --filter @aigarth/sdk cli chat "hi"    # one-shot
pnpm --filter @aigarth/sdk cli chat         # REPL
pnpm --filter @aigarth/sdk cli keys list
pnpm --filter @aigarth/sdk cli keys create "ci" --scopes chat:write
pnpm --filter @aigarth/sdk cli usage --since 2026-01-01
pnpm --filter @aigarth/sdk cli anns list
pnpm --filter @aigarth/sdk cli anns deploy lex-reasoner --region eu-west --cluster primary
pnpm --filter @aigarth/sdk cli --help
```

Credentials are stored at `~/.config/aigarth/credentials.json` (mode 0600).
You can also pass the key via `AIGARTH_API_KEY` env var.

---

## Sample app

[`examples/node-chat`](../../examples/node-chat) — minimal Express + SSE
chat demo that uses the SDK to stream completions. Run it:

```bash
pnpm --filter aigarth-node-chat start
# open http://localhost:8787
```

---

## Build

```bash
pnpm --filter @aigarth/sdk build         # → dist/
pnpm --filter @aigarth/sdk typecheck     # tsc --noEmit
pnpm --filter @aigarth/sdk exec tsx scripts/e2e.ts   # 9-section E2E
```

The SDK compiles to ESM with explicit `.js` extensions in relative
imports. Re-exports preserve type and value identity, so the types and
runtime entrypoints stay in lockstep.

## OpenAI compatibility

Chat, embeddings, and models match the OpenAI JS SDK surface, so
existing code that imports `openai` types and points at our base URL
works as-is. Aigarth extensions (e.g. `qubic_paid`, `preferred_ann`)
are additive intersection types.

## Roadmap

- [ ] Python SDK (`aigarth` on PyPI)
- [ ] WebSocket transport for bidirectional streaming
- [ ] Webhook signature verification
- [ ] Built-in retry-after / rate-limit header parsing
- [ ] Bearer token rotation helpers
