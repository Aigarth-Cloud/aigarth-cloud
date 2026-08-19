# Phase 18C — Trinary Gateway delivery report

**Phase:** 18C — Trinary Intelligence Protocol v1 (gateway integration)
**Sprint:** Third of the 6-phase Trinary Intelligence Layer (18A–18F)
**Date:** 2026-08-04
**Builds on:** [Phase 18A — Trinary Core](./phase-18a-trinary-core-delivery.md), [Phase 18B — Trinary ANN Integration](./phase-18b-trinary-ann-integration-delivery.md), [ADR 003 — Trinary Protocol v1](../architecture-decisions/003-trinary-protocol-v1.md)

---

## What shipped

The trinary protocol is now reachable through the **OpenAI-compatible** surface. A consumer can set `intent: "trinary"` on `/v1/chat/completions` and receive a signed `IntentEnvelope` framed as an OpenAI chat completion. The OpenAI surface stays default; trinary is opt-in. **Zero existing clients break.**

### The new field

```ts
POST /v1/chat/completions
{
  "model": "ann_sales_v1",
  "messages": [...],
  "intent": "trinary",          // <-- Phase 18C
  "stream": false,              // optional, sync or SSE
  ...
}
```

When `intent: "trinary"`:
- The gateway looks up the model (must be `active`)
- Forwards the call to `POST ${ANN_SERVICE_URL}/v1/anns/${model}/decide` (the ANN service route added in 18B)
- Frames the returned `IntentEnvelope` as an OpenAI chat completion
- Logs the request, response, and per-decision cost to `gateway_requests`

### The wire shape (sync)

```jsonc
// Request
{
  "model": "ann_sales_v1",
  "messages": [{ "role": "user", "content": "Should I contact L42?" }],
  "intent": "trinary"
}

// Response (200 OK)
{
  "id": "chatcmpl-20260804120000",
  "object": "chat.completion",
  "created": 1793745600,
  "model": "ann_sales_v1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "<the envelope as a JSON string>",
        "aigarth_intent": { /* typed IntentEnvelope */ }
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2 },
  "served_by": [{ "ann_id": "ann_sales_v1", "ann_version": "1.0.0", "region": "global" }],
  "request_id": "u_42",
  "decision_id": "dec_xyz"
}
```

The envelope is reachable in **three** places, in order of decreasing structure:
1. `choices[0].message.aigarth_intent` — typed, ready to use (SDK consumers)
2. `choices[0].message.content` — JSON string, parseable (OpenAI clients that ignore Aigarth extensions)
3. (Stream) `aigarth_intent_delta` on the first SSE chunk — typed (SDK streaming consumers)

### The wire shape (stream)

A trinary stream is **exactly two SSE events** (the decision is atomic; no token-level streaming is possible or meaningful):

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"<envelope>","aigarth_intent_delta":{...}},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"request_id":"u_42","decision_id":"dec_xyz"}

data: [DONE]
```

The `aigarth_intent_delta` field is **namespaced** (the `aigarth_` prefix) so it never collides with OpenAI's chunk delta schema.

## File map

```
services/gateway/
├── src/
│   ├── config/index.ts                  (updated: ANN_SERVICE_URL + GATEWAY_TRINARY_DECISION_COST_QUBIC)
│   ├── routes/chat.ts                   (rewritten: trinary path added before OpenAI path)
│   ├── services/
│   │   ├── pricing.ts                   (updated: trinaryDecisionCost())
│   │   └── trinary.ts                   (new: ~250 lines — callAnnDecide, framing, buildAnnInput, AnnServiceError)
│   ├── tests/
│   │   └── trinary.test.ts              (new: 16 tests covering framing + input mapping + error)
│   └── ...
├── scripts/
│   └── clean.mjs                        (new: cross-platform clean)
├── vitest.config.ts                     (new: vitest setup)
├── .env.example                         (updated: new env vars)
└── package.json                         (updated: @aigarth/trinary dep, vitest devDeps, test scripts)

packages/sdk/
├── src/
│   └── types/
│       ├── aigarth.ts                   (new: IntentEnvelopeLike structural type)
│       ├── chat.ts                      (updated: `intent` request field, `decision_id` + `aigarth_intent_delta` response fields, `aigarth_intent` on ChatMessage)
│       ├── common.ts                    (updated: aigarth_intent on ChatMessage)
│       └── index.ts                     (updated: re-export aigarth)
└── ...
```

## Verification

```bash
$ pnpm --filter @aigarth/gateway typecheck
> tsc --noEmit
# (clean)

$ pnpm --filter @aigarth/gateway build
> tsc
# (clean)

$ pnpm --filter @aigarth/gateway test
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  8.25s

$ pnpm --filter @aigarth/sdk typecheck && pnpm --filter @aigarth/sdk build
# (clean — dist regenerated, 15 files JS-extension-stripped)

$ pnpm --filter @aigarth/trinary test
# 85/85 still pass (Phase 18A untouched)
$ pnpm --filter @aigarth/ann test
# 42/42 still pass (Phase 18B untouched)
```

## Decisions landed

1. **`intent: "trinary" | "openai"` as a new top-level field, not an extension of OpenAI's `response_format`.** OpenAI's `response_format` is `{ type: "text" | "json_object" | "json_schema", ... }` and is a different concept (response *shape* vs response *protocol*). Adding ours with the same name would collide and confuse OpenAI clients. A new top-level field is unambiguous and 100% backward-compatible.
2. **No model schema change.** The gateway doesn't need to know which models are trinary-mode. It just looks up the model (must be `active`) and forwards the request. The ANN service does the protocol check and returns `400 AnnNotTrinaryError` if the model isn't in trinary mode. This means **any active model can be queried in trinary mode** — operators flip the mode on the ANN service, not the gateway.
3. **Per-decision pricing, not per-token.** A trinary response is a single signed `IntentEnvelope` — there are no tokens to meter. `GATEWAY_TRINARY_DECISION_COST_QUBIC` is a flat fee. Crucially, **the fee is the same regardless of state** (+1, 0, -1 all cost the same). This removes the perverse incentive to force a non-zero answer: a 0 "not yet" decision is just as billable as a 1 "proceed" decision. The proposal called this out as a differentiator and we're shipping it as a pricing invariant.
4. **User JWT is forwarded to the ANN service.** The gateway and ANN service share the same `JWT_SECRET` (issued by the identity service). The user's existing Bearer token works on both. No new service-to-service token type needed.
5. **Trinary stream = 2 SSE events, not 0.** The `aigarth_intent_delta` is on the first chunk (carries the envelope); `finish_reason: "stop"` is on the second. We considered emitting a single chunk with both, but OpenAI clients expect a "stop" chunk as a separate event. This matches their parser expectations.
6. **Three-place envelope exposure on the sync response.** The proposal called for the envelope in `content` (JSON string) and a new field for the typed shape. We add `aigarth_intent` on `message` (not at the top level) so OpenAI's `choices[].message` invariant is preserved and the typed shape is co-located with the text that contains it.
7. **`IntentEnvelopeLike` in the SDK is structural, not nominal.** SDK consumers who want the full typed surface (signing, hashing, consensus algebra) install `@aigarth/trinary` directly. The SDK re-declares a minimal subset of the envelope so it can be a transport client without forcing the trinary dep.

## What is NOT in this phase (deferred, with rationale)

- **A real model call inside the gateway.** Still using the stub backend for the OpenAI path. Phase 18D's tissue service is the natural place to wire the actual model invocation, since the trinary path already calls a service (the ANN service) for the decision. The OpenAI path stays stubbed until the platform has a real LLM endpoint to call.
- **A new `ResponseShape` type in the SDK's resources.** The SDK chat resource is a thin pass-through; consumers inspect the `aigarth_intent` field themselves. A `client.chat.intents.create()` shortcut is a v2 ergonomic improvement.
- **Tissue service (Phase 18D).** This phase is the last "plumbing" phase. 18D is the actual *runtime* — the service that calls multiple ANNs and combines their envelopes.
- **Ed25519 signing.** v1 = HMAC. v2 = Ed25519 with optional Qubic-wallet keys.
- **Asymmetric streaming / partial consensus.** When a tissue is combining N ANNs and the third one says -1, the consumer might want to see -1 before the other two say +1. That's a 18D concern, not 18C.

## End-to-end flow now live

```
┌─────────────────┐                  ┌─────────────────┐                ┌─────────────────┐
│   apps/web      │                  │   gateway       │                │   ann service   │
│   (consumer)    │                  │   :7004         │                │   :7006         │
│                 │                  │                 │                │                 │
│  POST /v1/chat/ │                  │  intent:"trinary"│              │                 │
│  completions    │ ──────────────► │  → look up model│                │                 │
│  intent:trinary │                  │  → forward to   │ ──────────────►│  POST /v1/anns/ │
│                 │                  │  ANN /decide    │  user JWT      │  ${model}/decide│
│                 │                  │                 │  forwarded     │                 │
│                 │                  │                 │                │  build envelope │
│                 │                  │                 │                │  sign with key  │
│                 │                  │                 │                │  log to         │
│                 │                  │                 │                │  ann_decisions  │
│                 │                  │                 │ ◄─────────────│                 │
│                 │                  │  frame as       │  envelope      │                 │
│                 │                  │  OpenAI chat    │                │                 │
│                 │ ◄──────────────│  completion      │                │                 │
│  receive        │  OpenAI shape   │                 │                │                 │
│  envelope in    │  + aigarth_intent│                │                │                 │
│  3 places       │                  │                 │                │                 │
└─────────────────┘                  └─────────────────┘                └─────────────────┘
```

## Time-to-Ship

- **Active build time:** ~50 minutes
- **SP velocity:** ~1 SP / 50 min
- **Tests added:** 16
- **Files added:** 3 (services/trinary.ts, tests/trinary.test.ts, vitest.config.ts, scripts/clean.mjs, types/aigarth.ts)
- **Files updated:** 6 (chat.ts, pricing.ts, config/index.ts, .env.example, package.json, SDK chat.ts + common.ts + types/index.ts)

## Comparison to prior phases

- **18A** shipped a pure contract package with 100% coverage. 0 service changes.
- **18B** touched one service (ann) with a schema migration + 2 routes. 0 other services affected.
- **18C** touches the gateway (the public surface), updates the SDK (the public client), and adds 1 cross-service call (gateway → ann service). The blast radius is wider but contained: the new `intent` field is opt-in, OpenAI clients see no change, and the cross-service call is forward-only (gateway never calls back from the ANN service).

## Next phase (18D)

`services/tissue` — a new service on port 7008. Hosts the consensus algebra. The orchestrator that takes multiple `IntentEnvelope`s from ANNs and combines them into a single tissue-level decision. The first real "Intelligent Tissue" — the thing the original proposal was really about.

This is the most complex of the six phases. It introduces:
- A new bounded context (Tissue, TissueMember, TissueDecision)
- The first *use* of the consensus algebra from `@aigarth/trinary` at runtime
- Asynchronous parallel ANN calls
- A real tissue template + a real demo tissue (the Sales+Risk+Finance example from the proposal)

Want me to start 18D?
