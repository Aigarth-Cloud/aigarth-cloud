# ANN Execution — Developer Guide (Phase 29)

This guide is the developer walkthrough for the new Execution Router
layer in `services/ann`. It complements ADR 006 (Work Runtime) and the
[Phase 29 superprompt](../../deliveries/phase-29-delivery.md) (the
deliverable this work implements).

## What this layer is

The Execution Router is the abstraction that lets the same ANN be run
locally (in-process, deterministic) or through Qubic Outsourced
Computation (submitted to `services/work`, verified by replication).

```
   ANN  →  manifest  →  ExecutionRequest  →  ExecutionRouter
                                                  ├── LocalANNExecutor
                                                  └── QubicOCExecutor  →  services/work
```

Same ANN, same manifest, same input. Two executors. The router picks
one based on `request.target`.

## What this layer is not

- It is **not** a replacement for the existing trinary decision flow
  (`/v1/anns/:id/decide`). The trinary path emits `IntentEnvelope`s
  for the trinary protocol; the execution path runs the ANN's
  *adapter* (the inference function). They are independent.
- It is **not** the inbound OC processor. That is `@aigarth/oc-processor`
  (ADR 007); see [`../oc-processor/`](../oc-processor/).
- It is **not** a marketplace economy. The `ann_economic_policies` +
  `ann_epochs` tables exist in this phase, but the runtime that uses
  them (staking, fees, burn/stream-burn/split) is Phase 9/10 work.

## How to create an ANN

The manifest is the canonical identity of an ANN. It is content-addressed:

```ts
import { buildManifest, manifestHash, type AnnManifest } from "@aigarth/ann/dist/types/ann-manifest.js";

const manifest: AnnManifest = buildManifest({
  id: "btc-direction-predictor",
  name: "BTC Direction Predictor",
  version: "v1.0.0",
  creator: "you",
  architecture: "btc-direction-predictor-v1",
  modelHash: "sha256:" + "<your 64-hex sha>",
  inputSchema: { type: "object", required: ["features"], properties: { features: { type: "array" } } },
  outputSchema: { type: "object", properties: { prediction: { type: "string" } } },
});

const id = manifestHash(manifest); // "sha256:<64 hex>"
```

The `architecture` field is the **adapter id**. The Execution Router
looks up the adapter by this id. If no adapter is registered, the local
executor falls back to a clearly labelled deterministic stub.

## How to register an adapter

```ts
import { registerAnnAdapter, type AnnAdapter } from "@aigarth/ann/dist/services/execution/index.js";

const myAdapter: AnnAdapter = {
  id: "my-architecture-v1",
  description: "Tiny rule-based inference for the demo.",
  async infer(input, manifest) {
    return { prediction: input.features[0] > 0 ? "up" : "down", adapter: "my-architecture-v1" };
  },
};

registerAnnAdapter(myAdapter);
```

Register adapters at service boot. The seed for the BTC Direction
Predictor (see `seed-btc-direction-predictor.ts`) is the canonical
example.

## How to publish an ANN to GitHub

**This session: deferred.** The route returns:

```json
{ "status": "not_configured", "message": "GitHub publishing is deferred. ..." }
```

The seed (`pnpm --filter @aigarth/ann db:seed-btc`) attaches a
`ann_repositories` row directly with `publication_kind = "seed"` and a
synthetic commit SHA derived from the manifest hash. This is enough to
make the manifest hash the canonical identity; the GitHub App wire-up
is Phase 30+.

## How ANN identity / versioning works

Two ANNs are the "same version" iff they have the same `manifestHash`.
The hash is content-addressed: same fields in same order = same bytes
= same hash. The version is identified by `(repo, commit, manifestHash)`
in the public spec; in this phase the seed uses `(manifestHash)` alone
because the GitHub publish is deferred.

The `ann_repositories` table tracks the provenance per ANN version.
The `ann_versions.artifact_hash` and `ann_versions.artifact_url` columns
are the legacy fields; new code should use `ann_repositories`.

## How local execution works

`LocalANNExecutor` runs the adapter in the current process. No
network call, no OC layer. The output is whatever the adapter returns;
the result hash is then computed by `resultHash(...)`.

```
input  →  adapter.infer(input, manifest)  →  output
                                          ↓
                          resultHash(manifestHash, version, input, target, output)
```

Same input + same manifest + same architecture always produces the same
output. The `verificationStatus` is `local_deterministic`.

If no adapter is registered for the manifest's `architecture`, the
executor falls back to a clearly labelled deterministic stub. The stub
output carries `fixture: true` so no caller can mistake it for a real
inference.

## How Qubic OC execution works

`QubicOCExecutor` submits the execution to `services/work` (port 7012)
and polls until the work item reaches a terminal state. The OC
service's work item envelope is the same one used by all other
workloads; the executor's only specialisation is that it sets
`type: "ann_execution"` and pins `algorithm.name = "aigarth-oc-algorithm"`.

The OC executor never falls back to local execution. A failed
decentralised execution must remain visibly failed (per superprompt
§24).

## How to become an OC execution provider

The OC processor is the inbound mirror — when a Qubic smart contract
calls the Aigarth processor, the `services/work` work item is the
executor. To run an OC node, see [`../oc-processor/`](../oc-processor/).
The AIO Dev Kit (released 2026-08-04) is the recommended local dev
environment.

## How economic policies will eventually work

Phase 9/10 ships the *schema* only. The runtime is not wired in this
phase. When the runtime is built, the active economic policy for an
epoch is selected by the policy kind + the basis-point allocations:

| Policy | burn | creator | stakers | ecosystem |
|---|---|---|---|---|
| `burn` | 100% | 0% | 0% | 0% |
| `stream_burn` | 70% | 15% | 15% | 0% |
| `split` | 40% | 30% | 20% | 10% |

These are the *example* allocations from the superprompt. The real
allocations are governance-defined. The schema accepts any
`{burn, creator, stakers, ecosystem}` that sums to 10 000 bps and
respects the bounds:
- `burn ∈ [burn_min_bps, burn_max_bps]`
- `creator ≤ creator_max_bps`
- `stakers ≤ stakers_max_bps`
- `ecosystem ≤ ecosystem_max_bps`

The defaults (in the migration) match the superprompt's example
bounds: burn `[25%, 100%]`, creator `≤ 40%`, stakers `≤ 30%`,
ecosystem `≤ 20%`.

## API surface

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/v1/anns/:idOrSlug/execute` | JWT | Submit a Run. Returns `{ execution_id, status }`. 202. |
| `GET` | `/v1/anns/:idOrSlug/executions` | JWT | List execution history. |
| `GET` | `/v1/anns/:idOrSlug/executions/:execId` | JWT | Fetch one execution. Poll every 2 s. |
| `GET` | `/v1/anns/:idOrSlug/repositories` | JWT | List GitHub publication rows. |
| `POST` | `/v1/anns/:idOrSlug/publish` | JWT | Publish a version to GitHub. Currently returns `not_configured`. |

The SDK mirrors these via `client.anns.execute(...)`,
`client.anns.listExecutions(...)`, `client.anns.getExecution(...)`,
`client.anns.listRepositories(...)`.

## Result verification

```
result_hash = sha256(
  manifest_hash + ann_version + input_hash + target + canonicalize(output)
)
```

Anyone with the manifest, the input, and the output can re-derive the
hash and confirm "this result came from this exact ANN version using
this exact input." The executor returns the hash; the UI / caller
verifies it. Phase 30+ will sign the hash with the ANN creator's
Qubic identity key for non-repudiable provenance.

## Failure handling

- Local executor fails (adapter throws) → `status: "failed"`, `error: <message>`
- OC executor submission fails → 503, `code: "executor_unavailable"`
- OC executor timeout → `status: "running"`, caller polls
- OC work item `disputed` → `verificationStatus: "disputed"`
- OC work item `failed` → `status: "failed"`
- Manifest hash mismatch → 409, `code: "manifest_hash_mismatch"`
- Unknown ANN → 404

The router never falls back. A failed OC execution is visibly failed.

## Testing

```bash
# Unit tests for the manifest, the result-hash, the router, the BTC adapter, and the executions service
pnpm --filter @aigarth/ann test

# Integration test for the OC processor pipeline
pnpm --filter @aigarth/oc-processor test
```

The route integration tests live in `services/ann/src/tests/` and run
against a Postgres test instance (`pnpm --filter @aigarth/ann
test:integration:dev`).
