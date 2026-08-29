# @aigarth/oc-processor

Aigarth-side Qubic Outsourced Computation (OC) processor — the implementation of
ADR 007.

> **Status (Phase 29)** — Shipped as a library. The `registerAsProcessor` +
> `onInvocation` + `workRuntime.execute` surface is implemented, the rate
> limiter and circuit breaker are implemented, the 451/676 signature
> verification is implemented as a **structural check** (the v1 caveat
> in `signature.ts`), and the result signer is implemented with HMAC-SHA-256
> (Phase 30+ will swap to Ed25519 / Schnorr).
>
> Acceptance of this package for *mainnet* exposure requires the
> `packages/oc-processor` ADR's own acceptance gate: the Wave 3 build +
> a security review, then the public test surface
> [`ocmock.qubic.org`](https://ocmock.qubic.org/) validation.

## What this package is

`@aigarth/oc-processor` lets an Aigarth deployment register as a Qubic OC
*processor* — a service that the Qubic computors route signed invocations
to. The processor is the inbound mirror of the outbound path that
`services/ann` uses to submit work to `services/work`.

```
Qubic smart contract
        │  procedure_pay on OC contract
        ▼
Qubic computors (676)
        │  451/676 sign, forward signed bundle
        ▼
Aigarth OC processor  (this package)
        │  verify 451/676 + rate-limit + circuit-breaker
        ▼
Work Runtime (services/work)
        │  run, replicate, verify
        ▼
Aigarth OC processor  (this package)
        │  sign result
        ▼
Qubic computors  →  on-chain record
```

## What this package is not

- It does **not** implement the Qubic-side listening port. The Qubic
  computor's processor machine is the client; Aigarth is the HTTPS server.
- It does **not** implement the AigardPool contract. OC fees are settled
  off-chain between the calling Qubic smart contract and the Aigarth
  processor wallet, per ADR 007 §8.
- It does **not** bypass the Work Runtime. The OC handler maps the
  invocation to a `WorkItem` and delegates execution.

## Quick start

```ts
import {
  OcProcessorRegistry,
  HttpWorkRuntime,
  signResult,
  type InvocationHandler,
} from "@aigarth/oc-processor";

const registry = new OcProcessorRegistry();
registry.setWorkRuntime(new HttpWorkRuntime(
  process.env.WORK_SERVICE_URL ?? "http://localhost:7012",
  process.env.INTERNAL_TOKEN,
));

const handler: InvocationHandler = async (inv) => {
  // The default flow: the registry's internal `mapToWorkItem` calls
  // `workRuntime.execute` and returns a `WorkItemResult`. Here you
  // can do anything — call out to a model, return a stored value,
  // compose multiple work items, etc.
  return {
    status: "verified",
    result: {
      work_id: "wki_default",
      invocation_epoch: inv.epoch,
      fee_paid_qubit: inv.fee_paid_qubit,
    },
  };
};

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
  computorKeys: /* fetched from services/qubic; see ADR 007 §5.1 */,
});
```

Then the route layer (`POST /oc/:processor_id/invocation`) calls
`registry.handle({ processorId, invocation })` and returns the
`QubicResult` envelope.

## Trust model

The 451/676 computor signature is the trust root. See `signature.ts` for
the v1 caveat and `docs/architecture-decisions/007-oc-processor.md` for
the full design.

## Rate limit + circuit breaker

Three layers, borrowed from the AigardPool M3 (per-tx + per-user-per-epoch
caps) and M4 (pause flag) patterns. Defaults are in `DEFAULT_RATE_LIMIT`
and `DEFAULT_BREAKER`. See ADR 007 §6 for the rationale and the
"production gate" list.

## Out of scope (Phase 29)

- Real Ed25519 / Schnorr cryptographic verification (currently a structural
  check; see `signature.ts`).
- The `aigarth.cloud/oc/...` HTTPS endpoint route — Phase 30+ integrates
  with the gateway.
- The Qubic mainnet registration transaction — Aigarth operators
  register the manifest via the Qubic OC registry contract; that
  submission is not in this package.
- Federation, TEE attestation, ZK proofs (deferred per ADR 007 §1.4).
