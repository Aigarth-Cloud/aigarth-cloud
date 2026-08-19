# Phase 19C.3 — Real LLM Invocation delivery report

**Phase:** 19C.3 — Real LLM invocation in `/decide` (close the trinary stub gap)
**Sprint:** First of the 6-sprint Phase 19 plan (Datasets & Training Orchestration)
**Date:** 2026-08-07
**Status:** ✅ Complete
**Story points delivered:** 3 / 3

> 📦 **Ship time: ~50 minutes** — 3 SP delivered at ~17 min/SP
> Fastest single-task delivery in the project so far. The trinary protocol
> shipped a stub in Phase 18B by design; this closes it cleanly with a
> plug-in backend interface and 38 new tests.

---

## ⏱ Time to ship

| Metric                | Value                                            |
| --------------------- | ------------------------------------------------ |
| **Active build time** | **~50 min**                                      |
| Calendar elapsed      | 1 working session                                |
| Story points          | 3 SP                                             |
| **Velocity**          | **~17 min per SP**                               |
| Files created         | 5 (types.ts, stub.ts, parser.ts, openai-compatible.ts, index.ts, backends.test.ts) |
| Files modified        | 2 (trinary.ts, config/index.ts, .env.example)    |
| Lines of code (LOC)   | ~1,000                                           |
| Endpoints shipped     | 0 (internal refactor — no API change)            |
| Tests added           | 38                                               |
| Monorepo typecheck    | 19/19 green                                      |

---

## What shipped

### 1. Pluggable backend interface

`services/ann/src/backends/types.ts` defines a clean contract:

```ts
interface TrinaryBackend {
  info(): TrinaryBackendInfo;
  invokeTrinary(input: TrinaryInput): Promise<TrinaryOutput>;
}
```

The interface is small, the input is fully typed, and adding a new backend (Anthropic-native, Cohere, a self-hosted model server) is one new file plus a line in the factory.

### 2. Stub backend (preserves Phase 18B behavior)

`services/ann/src/backends/stub.ts` — the deterministic hash-based fallback. Default when `ANN_LLM_BACKEND=stub` (or unset). The behavior is byte-identical to the old helpers (`stubTrinaryState` / `stubConfidence` / `stubReasoning`), so all 40 existing trinary tests pass unchanged.

Useful for:
- Local dev with no model server
- CI / test environments (no network)
- Reproducible demos

### 3. OpenAI-compatible backend

`services/ann/src/backends/openai-compatible.ts` — talks to any OpenAI-shaped `POST /v1/chat/completions` endpoint. Works with:

- OpenAI (`https://api.openai.com/v1`)
- Ollama (`http://localhost:11434/v1`)
- LM Studio (`http://localhost:1234/v1`)
- vLLM, TGI, llama.cpp's server mode
- Anthropic via LiteLLM or OpenRouter proxies

Features:
- 8-second default timeout with `AbortController` (configurable via `ANN_LLM_TIMEOUT_MS`)
- `Authorization: Bearer ...` header only when `ANN_LLM_API_KEY` is set
- `response_format: { type: "json_object" }` for OpenAI-compatible servers that support it
- `temperature: 0.0` default for deterministic trinary judgments
- Catches network errors, HTTP non-2xx, malformed JSON, missing assistant content, and parse failures — all mapped to `TrinaryBackendError`

### 4. Robust JSON parser

`services/ann/src/backends/parser.ts` — handles 4 response shapes from real models:

1. Pure JSON: `{"state": 1, ...}`
2. JSON inside a ` ```json ` fence
3. JSON embedded in free text
4. State as text at the start of a sentence ("Block this." → -1, "Proceed." → +1, "Continue." → 0)

Defensive behavior:
- Confidence is clamped to [0, 1] with 0.5 fallback for NaN / missing
- Reasoning is truncated to 8000 chars (envelope schema limit)
- `recommended_action` is truncated to 120 chars
- Any unrecoverable parse failure throws `TrinaryParserError`

The text-fallback heuristic was tuned after a first-pass version incorrectly matched the word "no" in "no clear signal" — now only matches state verbs at the start of a sentence, not embedded in normal English.

### 5. Backend factory with single-flight cache

`services/ann/src/backends/index.ts` — `getTrinaryBackend()` returns the same instance per process. Backend choice is controlled by `ANN_LLM_BACKEND` (`stub` or `openai_compatible`). Test-only `__resetTrinaryBackendForTests()` exists for unit tests.

### 6. Wired into `/decide` with neutral fallback

`services/ann/src/services/trinary.ts` — `decideAnn()` now calls `getTrinaryBackend().invokeTrinary()`. The new `invokeTrinaryBackendSafe()` helper wraps the call in try/catch and substitutes a **neutral envelope** on any failure:

```ts
{
  state: 0,
  confidence: 0.5,
  reasoning: "Trinary backend openai_compatible (model=llama3.1) failed: <reason>. Returning neutral state.",
  recommended_action: "continue_observing",
}
```

Two failure modes that short-circuit before the backend is even called:
- ANN has no `trinary_prompt_template` → neutral envelope, warning in reasoning
- Backend throws (timeout, network, parse, ...) → neutral envelope, error reason in reasoning

**The caller is never blocked on a model outage.** This is the single most important behavior change: the platform stays up when the model goes down.

### 7. Config + env

`services/ann/src/config/index.ts` — 6 new env vars:

| Var | Default | Purpose |
|---|---|---|
| `ANN_LLM_BACKEND` | `stub` | `stub` or `openai_compatible` |
| `ANN_LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-shape server URL |
| `ANN_LLM_MODEL` | `llama3.1` | Model name to request |
| `ANN_LLM_API_KEY` | (empty) | Bearer token if needed |
| `ANN_LLM_TIMEOUT_MS` | `8000` | Per-request timeout |
| `ANN_LLM_MAX_TOKENS` | `512` | Response cap |
| `ANN_LLM_TEMPERATURE` | `0.0` | Sampling temperature |

`services/ann/.env.example` updated with the new vars and example URLs for OpenAI / Ollama / LM Studio / vLLM.

---

## File map

```
services/ann/src/
├── backends/
│   ├── types.ts                      ← NEW — TrinaryBackend contract
│   ├── stub.ts                       ← NEW — deterministic hash backend
│   ├── parser.ts                     ← NEW — JSON + text fallback parser
│   ├── openai-compatible.ts          ← NEW — OpenAI-shape chat client
│   └── index.ts                      ← NEW — single-flight factory
├── services/
│   └── trinary.ts                    ← UPDATED — wired to backend, neutral fallback
├── config/
│   └── index.ts                      ← UPDATED — 7 new LLM env vars
├── tests/
│   └── backends.test.ts              ← NEW — 38 tests
└── (.env.example)                    ← UPDATED

docs/deliveries/phase-19c3-real-llm-delivery.md  ← THIS FILE
apps/dashboard/scripts/complete-19c3.ts          ← NEW — marks task done in tracker
```

---

## Test coverage

| Service / Package        | Tests | Delta | Status |
|--------------------------|-------|-------|--------|
| `@aigarth/ann`           | 80    | +38   | green  |
| `@aigarth/sdk`           | 96    | 0     | green  |
| `@aigarth/trinary`       | 90    | 0     | green  |
| `@aigarth/gateway`       | 16    | 0     | green  |
| `@aigarth/tissue`        | 51    | 0     | green  |
| `@aigarth/marketplace`   | 16    | 0     | green  |
| `@aigarth/billing`       | 7     | 0     | green  |
| **Total**                | **356** | **+38** | **all green** |

### What's covered

- **Parser:** 4 response shapes, state coercion (number, string, "yes"/"proceed"/"block"/...), confidence clamping, length clamping, text fallback, error paths
- **Stub backend:** identity, state range, recommended_action matching, confidence range, reasoning includes ANN id
- **OpenAI-compatible backend:** wire shape (URL, headers, body), auth header, HTTP error mapping, network error, timeout, missing content, malformed content, JSON-in-fence
- **Factory:** single-flight cache

---

## Build + typecheck

- `pnpm --filter @aigarth/ann typecheck` — clean
- `pnpm typecheck` — 19/19 tasks green
- `pnpm --filter @aigarth/ann test` — 80/80 green

---

## How to use

### Default (stub, no model required)

```bash
# .env not changed
pnpm --filter @aigarth/ann dev
```

Calls to `/v1/anns/:id/decide` return deterministic hash-based envelopes. The behavior is identical to Phase 18B.

### Real LLM (Ollama, local)

```bash
# Install Ollama, pull a model
ollama pull llama3.1
ollama serve

# Set in services/ann/.env
ANN_LLM_BACKEND=openai_compatible
ANN_LLM_BASE_URL=http://localhost:11434/v1
ANN_LLM_MODEL=llama3.1
ANN_LLM_TEMPERATURE=0.0

# Restart
pnpm --filter @aigarth/ann dev
```

Calls to `/v1/anns/:id/decide` now hit Ollama. The ANN's `trinary_prompt_template` is the system prompt. If the ANN has no template, the call returns a neutral envelope with a warning in the reasoning field.

### Real LLM (OpenAI)

```bash
ANN_LLM_BACKEND=openai_compatible
ANN_LLM_BASE_URL=https://api.openai.com/v1
ANN_LLM_MODEL=gpt-4o-mini
ANN_LLM_API_KEY=sk-...
```

---

## What didn't make it (deferred to v2)

- **Anthropic native client** — the OpenAI-compatible proxy works for now; a direct Anthropic SDK client can be added as a 3rd backend.
- **Streaming responses** — the contract is a single JSON object; SSE / chunked responses are a v2 protocol change.
- **Per-ANN model assignment** — currently all ANNs use the same backend. A `model` column on `ann_versions` could let ANNs route to different models. Punt.
- **Backend observability** — success / failure / latency counters. Easy add, but more useful once 19B + 19C finish so we know which signals to expose.
- **Prompt template linting** — the ANN producer can write anything into `trinary_prompt_template`. A linter that checks the prompt asks for trinary output would help.

---

## Phase 19 status after 19C.3

- **Phase 19 — Datasets & Training Orchestration** is now **in_progress at 10%** (3 of ~31 SP).
- **Recommended next sprint:** 19A.1–19A.3 (Garden UX, 3 SP). Cheap, high-impact, no dependencies.
- After 19A: 19B.1–3 (Dataset service core, 4 SP), then back to 19C.1, 19C.2, 19C.4, 19C.5 (training wiring around the now-real LLM invocation).
- Dashboard kanban: visit `/phases/phase-19` in apps/dashboard (port 4000) to see 19C.3 in the Done column.

---

## See also

- [Phase 19 plan and priority queue](../../proposals/phase-3-vision-evaluation.md)
- [Phase 18E+18F delivery report (last complete phase)](./phase-18e-18f-delivery.md)
- [ADR 003 — Trinary Protocol v1](../architecture-decisions/003-trinary-protocol-v1.md)
