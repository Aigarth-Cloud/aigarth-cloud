# Qubic OC Processor — Operational Guide

This is the operator + developer guide for the inbound Qubic OC
processor. The canonical design is in
[`docs/architecture-decisions/007-oc-processor.md`](../../architecture-decisions/007-oc-processor.md);
the implementation is in [`packages/oc-processor/`](../../packages/oc-processor/).

## Status (Phase 29)

| Capability | Status |
|---|---|
| `registerAsProcessor(manifest)` | ✅ Shipped |
| `onInvocation(handler)` | ✅ Shipped |
| 3-layer rate limit (per-caller / per-processor / per-epoch) | ✅ Shipped |
| Circuit breaker (CLOSED / OPEN / HALF_OPEN) | ✅ Shipped |
| 451/676 signature verify | ⚠️ Structural check only (Phase 30+ = real Ed25519 / Schnorr) |
| Result attestation (sign result) | ⚠️ HMAC-SHA-256 (Phase 30+ = Ed25519) |
| Work Runtime integration | ✅ Shipped (`HttpWorkRuntime`) |
| `workRuntime.execute()` | ✅ Shipped |
| Public HTTPS endpoint | ❌ Phase 30+ (gateway wire-up) |
| Qubic mainnet registration | ❌ Out of scope until security review |

## How to register the Aigarth OC processor

```ts
import {
  OcProcessorRegistry,
  HttpWorkRuntime,
  type InvocationHandler,
  type QubicComputorKey,
} from "@aigarth/oc-processor";

const registry = new OcProcessorRegistry();
registry.setWorkRuntime(new HttpWorkRuntime(
  process.env.WORK_SERVICE_URL ?? "http://localhost:7012",
  process.env.INTERNAL_TOKEN,
));

const handler: InvocationHandler = async (inv) => {
  // 1. Map the invocation to a WorkItem (the registry's
  //    `mapToWorkItem` does this).
  // 2. Call workRuntime.execute — the work service handles
  //    replication + verification.
  // 3. Return the result envelope.
  return {
    status: "verified",
    result: {
      work_id: "wki_default",
      invocation_epoch: inv.epoch,
      fee_paid_qubit: inv.fee_paid_qubit,
    },
  };
};

// Fetch the Qubic computor pubkeys from services/qubic. v1 uses
// the StubQubicClient's deterministic computor list; Phase 30+
// wires the real Qubic RPC.
const computorKeys: QubicComputorKey[] = /* fetch from services/qubic */;

registry.register({
  manifest: {
    processor_id: "aigarth-cloud-ann",
    capabilities: ["ann_execution"],
    fee_qubic: "1000000", // 1 QUBIC
    endpoint: "https://aigarth.cloud/oc/ann",
    result_pubkey: process.env.AIGARTH_OC_PUBKEY!,
  },
  signingKey: {
    publicKeyHex: process.env.AIGARTH_OC_PUBKEY!,
    secret: process.env.AIGARTH_OC_SIGNING_SECRET!,
  },
  handler,
  computorKeys: new Map(computorKeys.map((k) => [k.publicKeyHex, k])),
});
```

## How to test against `ocmock.qubic.org`

`ocmock.qubic.org` is the operator dashboard for the Qubic OC test
network. It is **not** a deployment target; it is a monitoring target.
Aigarth's acceptance gate (per ADR 007 §7) is:

1. **Local dev (no chain).** Run the OC processor against a local
   AIO Dev Kit instance. The AIO Dev Kit ships a QPI node + an OC
   mock; the OC processor talks to the mock the same way it would
   talk to a real computor.
2. **Qubic public testnet.** Point the OC processor at the public
   testnet. The 451/676 signature verification is exercised
   end-to-end here.
3. **`ocmock.qubic.org`.** Watch the operator dashboards to
   understand what the real mainnet will look like.
4. **Mainnet shadow.** Register the Aigarth OC processor on mainnet
   with `fee_qubic` set high enough that no rational Qubic smart
   contract calls it. Watch the dashboards.
5. **Mainnet live.** Lower the fee to the target. Open the
   rate-limit caps. Requires user approval.

## Operational concerns

### Rate limit

Three layers, defaults in `DEFAULT_RATE_LIMIT`:

| Layer | Key | Epoch cap | Burst cap |
|---|---|---|---|
| per-caller | `signatures.computors[0]` | 10 | 3 in 60 s |
| per-processor | `manifest.processor_id` | 1 000 | 100 in 60 s |
| per-epoch | `invocation.epoch` | 5 000 | n/a |

Override per-processor via the `rateLimit` option on `register()`.

### Circuit breaker

`CLOSED` → `OPEN` when error rate > 25 % over a 5-min window (or on
manual `pause()`). `OPEN` → `HALF_OPEN` after 10 min; one probe decides
the next state. Override via `circuitBreaker` on `register()`.

The state is process-local. A restart defaults to `CLOSED`. Phase 30+
will persist to a small `oc_processor_breaker` table in services/work.

### Result signer

The result envelope is signed with HMAC-SHA-256 in v1. The
`aigarth_signature` field is `hex(hmac_sha256(secret,
canonicalise(invocation_hash, work_id, status, result)))`. Phase 30+
swaps HMAC for Ed25519 with a real Aigarth identity key. The
`aigarth_pubkey` field carries the public key; the Qubic smart
contract verifies the signature against this pubkey (which itself
is part of the 451/676-signed registration).

### What the handler must not do

- Do **not** execute the workload directly. The handler is a
  transport; the Work Runtime is the executor.
- Do **not** retry on its own. Failed invocations are reported to
  the Qubic smart contract and the caller decides whether to retry.
- Do **not** verify the result independently. The Work Runtime
  does that.

## Production gate (per ADR 007 §7.2)

The OC processor does **not** go to mainnet until:

- The Work Runtime (ADR 006) is live and exercised by at least one
  internal Aigarth Organism in production.
- The AigardPool mainnet deploy (Phase 20.6) has cleared the
  external audit gate.
- The Aigarth OC operator has run steps 1–4 for at least one full
  Qubic epoch (1 week) with zero unresolved incidents.
- The user has approved the move to step 5 in writing.

## Testing

```bash
pnpm --filter @aigarth/oc-processor test
```

The package's test suite covers:
- canonicalise + message-hash
- 451/676 signature verify (structural check)
- 3-layer rate limit
- circuit breaker (CLOSED / OPEN / HALF_OPEN transitions)
- HMAC result signer
- registry pipeline (rate-limit + circuit-breaker + verify + handler)
- end-to-end invocation handling
