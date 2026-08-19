# ADR 007 — Qubic OC Processor (Adopt, Outbound Direction)

| Field | Value |
|---|---|
| **Status** | Proposed (acceptance requires the public OC test surface to be in routine use and a successful pre-mainnet security review) |
| **Date** | 2026-08-13 |
| **Author** | Aigarth Cloud Architecture Team |
| **Reviewers** | Engineering, Founders |
| **Builds on** | v0.2 PEP §16 (Qubic) and §15 (Verification), ADR 005 (Organism), ADR 006 (Work Runtime — written in parallel by another agent), `docs/evolution/RESEARCH-AUDIT-2026-08-12.md` drift items D-2 (OC + BPP-9000 live in the same fortnight) and D-10 (AIO Dev Kit public release), AigarthPool audit checklist M3/M4 |
| **Decides** | Whether to register Aigarth Cloud as a Qubic Outsourced Computation (OC) *processor* via a new `@aigarth/oc-processor` package, and how to do so safely |
| **Outcome** | Adopt the OC processor pattern. Aigarth registers as a processor via `@aigarth/oc-processor` (`packages/oc-processor/`), listening on the QPI OC transport. The 451/676 computor signature is the trust root. The `registerAsProcessor(...)` / `onInvocation(...)` surface mirrors the v0.2 §31 example. Rate limits and a circuit breaker — borrowed from the AigarthPool M3 (per-tx + per-user-per-epoch caps) and M4 (pause flag) patterns — are mandatory before any mainnet exposure. The only public test surface is `https://ocmock.qubic.org/`. `internal_dev_token_change_me` (`docs/architecture-decisions/007-oc-processor.md` §11 negative consequence #2) must be rotated before any non-dev registration. |

---

## 1. Context

The Aigarth Cloud Evolution PEP v0.2 (`docs/proposals/aigarth-cloud-evolution-pep-v0.2.md`) — approved at the 2026-08-12 checkpoint (`docs/evolution/CHECKPOINT-2026-08-12.md:23-25`) — names Qubic Outsourced Computations (OC) as the platform's "external organs" surface. v0.2 §16 (`aigarth-cloud-evolution-pep-v0.2.md:502-527`) describes what OC actually is and what Aigarth's role in it is.

**The OC mechanism is outbound, not inbound.** The superprompt's framing in v0.2 §1 (Falsification Audit, `aigarth-cloud-evolution-pep-v0.2.md:40`) is explicit:

> "Qubic OC is the muscles / external organs — OC is *outbound*: smart contracts send authorized instructions to external systems; 451/676 computor signature threshold is the trust primitive. Aigarth would be a *target* of OC, not a *consumer*."

The Qubic "Three Pillars" blog quoted in v0.2 §16 (`aigarth-cloud-evolution-pep-v0.2.md:514`) is the canonical reference: *"Outsourced Computations have nothing to do with renting out compute power. It is the mechanism that allows a Qubic smart contract to send an authorised instruction outward, where an external system acts on it."* The 4-stage authorisation is: (1) the Qubic smart contract invokes OC; (2) every computor records the parameters; (3) computors independently sign; (4) once 451/676 (two-thirds of the 676-computor set) have signed, the request is authorised. Each computor then forwards the signed bundle to a *separate processor machine* — that machine is the surface Aigarth operates.

The 2026-08-12 research audit (`docs/evolution/RESEARCH-AUDIT-2026-08-12.md`) — items D-2 and D-10 — confirms that the operational state of OC moved between the v0.2 verification date (2026-08-11) and the checkpoint (2026-08-12):

- **D-2 (OC and BPP-9000 live in the same fortnight).** The Aug 6, 2026 All-Hands Recap lists *"Outsourced Computing — Live on mainnet (2026-07-29)"* (`RESEARCH-AUDIT-2026-08-12.md:43`). Operators are now on-net. The status of the OC spec is *shipping + operators on-net*, not *shipping soon*.
- **D-10 (AIO Dev Kit publicly released 2026-08-04).** *"Cheap local smart-contract testing changes the cost of building an OC processor dramatically. Aigarth's OC processor design (v0.2 §16) becomes much cheaper to prototype on the Qubic side. The barrier to 'register Aigarth as an OC processor' is now mainly on the Aigarth side, not on the Qubic side."* (`RESEARCH-AUDIT-2026-08-12.md:77`)

The work that this ADR designs against is in three places in the existing codebase:

- **v0.2 §31 (API model)** — `aigarth-cloud-evolution-pep-v0.2.md:1019-1035` — names the package (`@aigarth/oc-processor`) and the two exports (`registerAsProcessor`, `onInvocation`), with a 16-line usage example.
- **v0.2 §5 (Core Aigarth Object Model)** — `aigarth-cloud-evolution-pep-v0.2.md:156` — classifies the OC processor as a `Worker` kind of `"oc-processor"`.
- **v0.2 §13 (Heterogeneous Compute)** — `aigarth-cloud-evolution-pep-v0.2.md:442` — places the OC processor at Tier 3, with verification by *"451/676 computor signature"*.

The platform already has the Qubic-side listening pattern: `services/aigarthpool/contract/AigarthPool.h:1-30` is the C++/QPI source for the Aigard stake attribution contract, and the TypeScript simulator (`packages/aigarthpool/src/simulator.ts:1-620`) mirrors it for local dev. The OC processor package adopts the same "real contract + simulator + watcher" pattern, but *inverted*: instead of writing to chain, Aigarth *listens* for OC invocations and *writes results* back.

The verification cross-cut matters. v0.2 §15 (`aigarth-cloud-evolution-pep-v0.2.md:477-498`) names Tier 3's trust root explicitly: *"the platform is not the trust root; Qubic is. For Tier 3 (OC), the trust root is the 451/676 computor signature. For Tier 1 (local), the trust root is the Aigarth deployment itself, with cross-deployment replication (Tier 2) moving trust toward Qubic. v0.2's Phase 29 OC processor is where this becomes real."* The ADR 006 Work Runtime (port 7012, written in parallel) defines the local worker contract; this ADR 007 names what changes when the *caller* of the Work Runtime is a Qubic smart contract rather than an Aigarth Organism.

## 2. Decision

**Adopt the Qubic OC processor pattern. Ship `@aigarth/oc-processor` (new package at `packages/oc-processor/`) with a `registerAsProcessor(...)` registration API and an `onInvocation(async (invocation) => ...)` handler API. The 451/676 computor signature is the trust root. Rate limits (per-caller, per-processor, per-epoch) and a circuit breaker — borrowed from the AigarthPool M3 (per-tx + per-user-per-epoch caps, `docs/aigarthpool/audit-checklist.md:70-81`) and M4 (pause flag, `docs/aigarthpool/audit-checklist.md:82-99`) patterns, implemented in `packages/aigarthpool/src/simulator.ts:48-58`, `107-115`, `168-189` — are mandatory before any mainnet exposure.**

**What this ADR ships in Wave A:**

- A new package `@aigarth/oc-processor` at `packages/oc-processor/` with the exports and shape from v0.2 §31 (`aigarth-cloud-evolution-pep-v0.2.md:1019-1035`).
- A `registerAsProcessor(manifest)` call that posts the manifest to the Qubic OC processor registry via the QPI OC listening port (mirrors the C++/QPI side of `services/aigarthpool/contract/AigarthPool.h:1-30`).
- An `onInvocation(handler)` hook that receives a `QubicInvocation` envelope (containing the 451/676 signature bundle from the computors), validates the bundle, maps it to a work item, executes it via the Work Runtime (ADR 006), and returns a `QubicResult` that Aigarth signs and the computor forwards back to the calling Qubic smart contract.
- A result attestation that Aigarth signs (Ed25519 / Schnorr-style; the precise scheme is an Open Question, §13) and that the Work Runtime can audit.
- Rate limits and a circuit breaker at three layers (per-caller, per-processor, per-epoch) — the AigarthPool M3/M4 patterns, re-purposed for OC invocations.
- A `processorId` → `endpoint` routing entry in `services/work` (the Work Runtime is the *executor*; `@aigarth/oc-processor` is the *transport*).
- A docs page at `docs/oc-processor/` (operational runbook: how to register, how to test against `ocmock.qubic.org`, how to handle a paused processor).

**What this ADR does NOT decide (out of scope):**

- The Work Runtime itself (ADR 006, `services/work` port 7012, written in parallel). This ADR assumes the Work Runtime's `execute(workItem)` API exists and is callable from the OC handler. The mapping from `QubicInvocation` → `WorkItem` is the boundary this ADR owns; the Work Runtime's `WorkItem` envelope is owned by ADR 006.
- The on-chain AigarthPool contract (Phase 20, `services/aigarthpool/contract/AigarthPool.h:1-30` and `AigarthPool.cpp:1-400+`). The OC processor does not write to the AigarthPool; it consumes QUBIC-denominated fees (see §8) but the settlement happens in a separate, future workstream.
- Federation of processors (Tier 2, ADR 006's `worker.kind = "remote"`). The OC processor is a *single* processor at registration time. Federation is a v2 concern.
- TEE attestation, ZK proofs, and staking+slashing (deferred per v0.2 §15, `aigarth-cloud-evolution-pep-v0.2.md:488-490`). The OC processor is plain HTTP/QUIC between Aigarth and each Qubic computor's processor machine; the trust root is the 451/676 computor signature bundle, not a TEE quote or a ZK proof.

## 3. OC processor registration model

The Aigarth OC processor is identified by a Qubic-scoped `processor_id` (a string, e.g. `"aigarth-cloud-materials"`, drawn from the v0.2 §31 example at `aigarth-cloud-evolution-pep-v0.2.md:1025`). Registration is a one-shot, public, append-only action: a Qubic transaction of the OC registry contract records the Aigarth processor's manifest, and the 451/676 computor signature on the registration makes it canonical.

### 3.1 Manifest

The manifest is the contract between Aigarth and the Qubic network. It is what the OC registry stores, what smart contracts see when they look up an Aigarth processor, and what the rate limiter hashes against.

```ts
// packages/oc-processor/src/types.ts — public manifest shape
export interface OcProcessorManifest {
  /** Stable string identifier, e.g. "aigarth-cloud-materials". */
  processor_id: string;
  /** Capability tags. Must match a registered Aigarth Work Runtime algorithm
   *  (v0.2 §12, aigarth-cloud-evolution-pep-v0.2.md:394-413). */
  capabilities: ReadonlyArray<AlgorithmSlug>;
  /** Fee per invocation, in Qu-bit. 1 QUBIC = 1,000,000 Qu-bit.
   *  The v0.2 §31 example uses "1000000" (1 QUBIC) for materials;
   *  default for the first registration is also 1 QUBIC. */
  fee_qubic: string;
  /** HTTPS endpoint on the Aigarth side. Each Qubic computor's
   *  processor machine POSTs the signed bundle here. */
  endpoint: string;
  /** Ed25519 / Schnorr public key used to sign the result envelope
   *  (§5 trust root). The Aigarth side private key never leaves
   *  the processor. The public key is in the manifest so the
   *  Qubic smart contract can verify the result independently. */
  result_pubkey: string;
  /** Optional human-readable description; surfaced in dashboards. */
  description?: string;
}
```

The manifest is **immutable** for the lifetime of the registration. To change a fee, add a capability, or rotate an endpoint, Aigarth registers a *new* processor (`"aigarth-cloud-materials-v2"`) and the old one is deprecated via a separate Qubic tx. The Work Runtime reads the manifest from the OC registry; it does not read a local copy. This keeps the Aigarth deployment stateless with respect to the manifest.

### 3.2 Registration flow

The `registerAsProcessor(...)` call performs four steps:

1. **Build the manifest** from the inputs (capabilities list, fee, endpoint, public key).
2. **Sign a registration payload** with the Aigarth OC operator's Qubic identity key. The payload is the manifest canonicalised (sorted JSON, sha256 digest).
3. **Submit the registration tx** to the Qubic OC registry contract. The OC registry runs the same 4-stage 451/676 signing process as any other OC invocation (`aigarth-cloud-evolution-pep-v0.2.md:512`), except the subject is the manifest rather than a workload.
4. **Wait for 451/676 confirmation** and write the canonical manifest hash to a local `oc_processor_registrations` table in `services/qubic` (so the Work Runtime can boot from local cache without an OC RPC roundtrip on every call).

Step 4 is mirrored on the Aigarth side: `services/qubic/src/workers/aigarthpool-watcher.ts:64-78` already shows the "subscribe to chain events + persist to local mirror" pattern. The OC processor watcher does the same for `OcProcessorRegistered` / `OcProcessorDeprecated` events.

### 3.3 JSON envelope (the wire format)

The OC handler receives and returns JSON envelopes. The shape is the same in both directions; the calling direction is signalled by the `kind` field.

```ts
// packages/oc-processor/src/types.ts — wire envelope
export interface QubicInvocation {
  kind: "invocation";
  /** The OC contract index on Qubic. */
  contract_index: number;
  /** The procedure the smart contract called. */
  procedure: string;
  /** Caller's Qubic identity (32 bytes, hex). */
  caller: string;
  /** Caller's Qubic identity that paid the fee. May differ from `caller`
   *  when a relayer fronts the call. */
  payer: string;
  /** The fee amount the caller paid, in Qu-bit. */
  fee_paid_qubit: string;
  /** The current Qubic epoch at the time of invocation. */
  epoch: number;
  /** Nonce from the smart contract; replay defence. */
  nonce: string;
  /** Procedure-specific payload (algorithm spec + inputs). */
  payload: Record<string, unknown>;
  /** The 451/676 computor signature bundle. */
  signatures: {
    /** The 451 unique computor identities that signed. */
    computors: ReadonlyArray<string>;
    /** Their signatures over the canonical invocation hash.
     *  Order matches `computors`. */
    sigs: ReadonlyArray<string>;
    /** The canonical hash that was signed. */
    message_hash: string;
  };
}

export interface QubicResult {
  kind: "result";
  /** Echo back the canonical invocation hash. */
  invocation_hash: string;
  /** The work item id from the Work Runtime, for audit. */
  work_id: string;
  /** Status of the work item. */
  status: "verified" | "disputed" | "failed";
  /** The result payload (algorithm-specific). */
  result: Record<string, unknown>;
  /** Aigarth's signature over (invocation_hash || work_id || status || result). */
  aigarth_signature: string;
  /** Aigarth's public key (the one in the manifest). */
  aigarth_pubkey: string;
  /** Unix epoch milliseconds of the result. */
  timestamp_ms: number;
}
```

The envelope is **JSON over HTTPS** (v0.2 §31 example uses `https://aigarth.cloud/oc/materials`, `aigarth-cloud-evolution-pep-v0.2.md:1028`). The Qubic computor's processor machine is the HTTPS client; the Aigarth OC processor is the HTTPS server. TLS 1.3 minimum; the Aigarth certificate must be from a public CA so the computor can verify it. The 451/676 signature bundle is the *content* trust; TLS is the *transport* trust.

## 4. Invocation handler

The `onInvocation(async (invocation) => ...)` call is the runtime hook that processes every signed OC invocation the Aigarth processor receives.

### 4.1 Lifecycle of a single invocation

```
Qubic smart contract          Qubic computors (676)            Aigarth OC processor
  │                                  │                                  │
  │  call procedure_pay              │                                  │
  │  on OC contract                  │                                  │
  ├─────────────────────────────────►│                                  │
  │                                  │  record params, sign            │
  │                                  ├─────────────────┐               │
  │                                  │  451/676 sign    │               │
  │                                  │◄────────────────┘               │
  │                                  │  forward signed bundle          │
  │                                  ├─────────────────────────────────►│
  │                                  │                                  │  verify 451/676
  │                                  │                                  │  rate-limit check
  │                                  │                                  │  map → WorkItem
  │                                  │                                  │  WorkRuntime.execute
  │                                  │                                  │  sign result
  │                                  │◄─────────────────────────────────┤
  │                                  │  return signed result            │
  │  record result on-chain          │                                  │
  │◄─────────────────────────────────┤                                  │
  │                                  │                                  │
```

The five steps the Aigarth OC processor performs on the right-hand side, in order, with the failure modes that each step must handle:

1. **Verify the 451/676 signature bundle.** §5. The bundle must contain ≥ 451 *unique* computor signatures over the canonical invocation hash. Failure: reject with HTTP 401 and a `INVALID_SIG_BUNDLE` error code. No retry; the calling smart contract is responsible for re-submitting with a new bundle.
2. **Rate-limit check.** §6. Per-caller (per `caller` Qubic identity), per-processor (per `processor_id`), and per-epoch. Failure: reject with HTTP 429 and a `RATE_LIMITED` error code. Retry-After header set to seconds until the next epoch boundary.
3. **Map to a WorkItem.** The `payload` is converted to a v0.2 §11 work item envelope (`aigarth-cloud-evolution-pep-v0.2.md:344-380`). The mapping is deterministic: `payload.algorithm` → `algorithm.name`, `payload.input` → `input.payload_hash + input.payload_uri`, `payload.fee_qubic` → `reward.amount`, `caller` → `reward.payer`. The `work_id` is a fresh ULID.
4. **Execute via the Work Runtime.** `await workRuntime.execute(workItem)`. The Work Runtime is responsible for replication, challenge, and verification (per v0.2 §15, `aigarth-cloud-evolution-pep-v0.2.md:481-490`). The OC handler does *not* verify the result; it forwards whatever the Work Runtime returns.
5. **Sign and return the result.** Aigarth signs `(invocation_hash || work_id || status || result)` with the private key corresponding to `manifest.result_pubkey`. The result is returned over HTTPS to the Qubic computor's processor machine, which forwards it back to the Qubic smart contract.

### 4.2 What the handler does NOT do

- **It does not verify the result independently.** The Work Runtime does that (v0.2 §15). The OC handler is a *transport*; verifying the result would duplicate the Work Runtime's job and would require the OC handler to know the algorithm's verification function, which the Work Runtime is the canonical home for.
- **It does not persist the invocation to Aigarth's DB before executing.** The Work Runtime writes its own `work_items` row on creation (per ADR 006); the OC handler does not write a separate `oc_invocations` table. The Work Item is the canonical record. An optional `oc_invocations` mirror is allowed for operational dashboards, but it is not the source of truth.
- **It does not retry on its own.** A failed invocation (rate-limited, signature-invalid, Work Runtime down) is reported to the Qubic smart contract and the caller decides whether to retry. The OC handler is stateless with respect to retries.

### 4.3 The default handler

The v0.2 §31 example (`aigarth-cloud-evolution-pep-v0.2.md:1031-1034`) is the canonical default. The new package exports it; users can wrap it for custom logic.

```ts
import { registerAsProcessor, onInvocation, workRuntime } from "@aigarth/oc-processor";

registerAsProcessor({
  processor_id: "aigarth-cloud-materials",
  capabilities: ["materials_simulation", "dft_relaxation"],
  fee_qubic: "1000000",
  endpoint: "https://aigarth.cloud/oc/materials",
  result_pubkey: process.env.AIGARTH_OC_PUBKEY!,
});

onInvocation(async (invocation) => {
  const workItem = mapToWorkItem(invocation);
  const result = await workRuntime.execute(workItem);
  return result;
});
```

The `mapToWorkItem` and `workRuntime` exports are part of `@aigarth/oc-processor`; they are the integration point with the Work Runtime (ADR 006). The mapping function is deterministic and the only place where Qubic-side enums (procedure names, fee denominations) touch Work Item enums.

## 5. Trust root

The trust root for Tier 3 (OC) is the **451/676 computor signature**, per v0.2 §15 (`aigarth-cloud-evolution-pep-v0.2.md:498`). The OC processor does not invent a new trust model; it inherits Qubic's.

### 5.1 Signature verification

Each `QubicInvocation` carries a `signatures` block with three fields: `computors` (the 451 unique Qubic identities that signed), `sigs` (their Ed25519 signatures over `message_hash`), and `message_hash` (the canonical hash that was signed). The OC processor verifies three properties, in order:

1. **Message hash integrity.** The OC processor re-canonicalises the invocation (`contract_index || procedure || caller || payer || fee_paid_qubit || epoch || nonce || canonicalise(payload)`), hashes it with sha256, and asserts the result equals `signatures.message_hash`. Failure: `INVALID_INVOCATION_HASH`.
2. **Signature count.** The number of signatures is ≥ 451. Failure: `INSUFFICIENT_SIGS`.
3. **Per-signature validity.** Each `(computor[i], sigs[i])` pair verifies against the canonical message hash. Each `computors[i]` is a unique 32-byte Qubic identity. The set of computors is large enough that the probability of an attacker forging 451 unique Qubic identities with valid signing keys against the canonical hash is cryptographically negligible. Failure: `INVALID_SIG`.

The Qubic public key for each computor is fetched from the Qubic network on first use and cached for the duration of the OC processor's lifetime. The cache key is the Qubic identity; the value is the public key + a fetch timestamp. The cache is invalidated when the local mirror (the OC watcher in `services/qubic`) sees a `ComputorSetChanged` event.

### 5.2 Result attestation

The result the Aigarth OC processor returns is signed by Aigarth (not by Qubic). The signature is the **result bundle**: `(invocation_hash || work_id || status || result)`, signed with `manifest.result_pubkey`'s corresponding private key. The Qubic smart contract verifies the Aigarth signature against the `aigarth_pubkey` in the manifest (which is itself part of the 451/676-signed registration, so the smart contract trusts the public key).

The signing scheme is **open** (see §13 Open Question #1). The default candidate is Ed25519 (the same curve Qubic uses for computor signatures, per the AigarthPool contract code that imports QPI's `id` type in `services/aigarthpool/contract/AigarthPool.h:46`). Schnorr is the alternative if Qubic's OC result verification requires it. The choice is mechanical; what matters is that the result is **non-repudiable** (Aigarth cannot deny a result it signed) and **independently verifiable** (the Qubic smart contract can check the signature without trusting Aigarth's internal state).

### 5.3 What "451/676" buys

A 451/676 signature is a *two-thirds majority* of the computor set. For a 676-computor network, the threshold is the same as Bitcoin's "6 confirmations" heuristic: the economic cost of subverting 451 distinct Qubic identities exceeds the value of any plausible Aigarth-side attack. The OC processor inherits this guarantee; it does not need to add its own.

The processor does need to defend against the *outer* threat: a smart contract that invokes the OC processor many times per epoch to drain it. That is a rate-limit problem (not a signature problem) and is covered in §6.

## 6. Rate limit + circuit breaker

The OC processor exposes an Aigarth service to *any* Qubic smart contract. The trust root (451/676) authenticates the *caller* but does not bound the *call rate*. Without rate limits, a malicious or buggy Qubic smart contract can DoS the OC processor in seconds. The AigarthPool M3 (per-tx + per-user-per-epoch caps, `docs/aigarthpool/audit-checklist.md:70-81`) and M4 (pause flag, `docs/aigarthpool/audit-checklist.md:82-99`) patterns are the existing template; this section re-uses them.

### 6.1 Three-layer rate limit

The OC processor applies rate limits at three orthogonal axes, mirroring the AigarthPool M3 design (`packages/aigarthpool/src/simulator.ts:48-58, 168-189`):

| Layer | Key | Default cap (epoch) | Default cap (burst) | Rejection code |
|---|---|---|---|---|
| **Per-caller** | `signatures.computors[0]` (the calling smart contract's Qubic identity) | 10 invocations/epoch | 3 in any 60-second window | `RATE_LIMITED_CALLER` |
| **Per-processor** | `manifest.processor_id` | 1,000 invocations/epoch | 100 in any 60-second window | `RATE_LIMITED_PROCESSOR` |
| **Per-epoch** | `invocation.epoch` | 5,000 invocations across all callers/processors | n/a (caller + processor caps should fire first) | `RATE_LIMITED_EPOCH` |

The defaults are conservative and env-overridable. A separate ADR (BLOCKER, see §13) is required to finalise the *policy* (per-caller vs per-processor vs per-epoch weighting, per-capability sub-limits, the interaction with the per-epoch QUBIC halving that the Aug 6 recap warns about — see `RESEARCH-AUDIT-2026-08-12.md:80-82`). This ADR only specifies the *mechanism*.

The implementation lives in `packages/oc-processor/src/rate-limit.ts`. The same sliding-window pattern as `services/gateway/src/services/rate-limit.ts:24-75` is re-used; the per-epoch state is held in memory (a `Map<key, { count, windowStart }>`), not in Postgres, because the volume per epoch (~5,000 max) is small enough that an in-memory counter is faster and atomic. The state is reset on epoch boundary (a cron tick from `services/work` or a watcher event from `services/qubic`).

### 6.2 Circuit breaker

The circuit breaker is the AigarthPool M4 pattern (`packages/aigarthpool/src/simulator.ts:107-115, 160, 218, 239, 290, 312`), re-purposed for OC invocations.

| State | Trigger to enter | Behaviour | Trigger to exit |
|---|---|---|---|
| **CLOSED** (normal) | Default state | All invocations proceed through the rate-limit → map → execute → return flow. | If error rate > 25% over any 5-minute window, → OPEN. |
| **OPEN** (paused) | Error rate > 25% over 5 minutes; or manual `pause` call by Aigarth OC operator | Reject all invocations with HTTP 503 and `PROCESSOR_PAUSED`. Do not call the Work Runtime. The 451/676 signature is still verified (so the caller knows their call was *received* but *refused*). | After 10 minutes, → HALF_OPEN. Or manual `resume`. |
| **HALF_OPEN** (probe) | 10 minutes after OPEN | Allow 1 invocation. If it succeeds, → CLOSED. If it fails, → OPEN for another 10 minutes. | First invocation result. |

The pause flag is **operator-overridable**. The Aigarth OC operator can call `POST /v1/oc/pause` (an internal token-gated route, separate from the OC processor endpoint) to force the circuit to OPEN. The `internal_dev_token_change_me` token (`docs/architecture-decisions/007-oc-processor.md` §11 negative consequence #2; AGENTS.md §1) gates this and the registration-update paths.

The circuit-breaker state is persisted to a small `oc_processor_breaker` table in `services/work` (so a restart of the OC processor does not forget it is paused). The M4 pattern's audit event (`PoolPaused`, `PoolUnpaused` in `packages/aigarthpool/src/simulator.ts`) is mirrored as `OcProcessorPaused`, `OcProcessorUnpaused`, `OcProcessorProbeSucceeded`, `OcProcessorProbeFailed`.

### 6.3 Why this is mandatory before mainnet

The rate limit and circuit breaker are not in v0.2 §16's prose. They are in v0.2 §15 (Verification) implicitly (the table at `aigarth-cloud-evolution-pep-v0.2.md:481-490` lists rate limit + reputation as v1 mechanisms, not OC-specific) and in v0.2 §26 (Security, `aigarth-cloud-evolution-pep-v0.2.md:846-864`) explicitly (the `Manipulated fitness` row says *"fitness measured by platform, not declared by creator; append-only `organism_fitness_history`; on-chain lineage root in Phase 29"* — Phase 29 is this ADR).

The AigarthPool audit checklist's M3/M4 rationale (`docs/aigarthpool/audit-checklist.md:70-99`) is the right framing: these are *blast-radius* limits, not just rate limits. A bug in `mapToWorkItem` that submits a runaway work item per OC invocation would, without M3, drain the Aigarth quota of any Qubic smart contract that decides to call Aigarth 1,000 times. With M3, the per-caller cap fires first. M4 is the manual kill switch.

## 7. Public test surface

The only public test surface for Qubic OC, as of 2026-08-12, is `https://ocmock.qubic.org/`. The research audit `docs/evolution/RESEARCH-AUDIT-2026-08-12.md:18` and `44-45` cites the Aug 6, 2026 All-Hands Recap:

> "Outsourced Computing is best understood as the bridge between a Qubic app and everything outside Qubic … Operators are setting up and testing their environments now, and anyone can watch what the network triggers in the test setup at ocmock.qubic.org."

### 7.1 The pre-mainnet workflow

The Aigarth OC processor is built and tested in this order. Steps 1-3 do not touch mainnet; steps 4-5 do.

1. **Local dev (no chain).** Run the OC processor against a local AIO Dev Kit instance (released 2026-08-04 per `RESEARCH-AUDIT-2026-08-12.md:75-77`). The AIO Dev Kit ships a QPI node + an OC mock; the OC processor talks to the mock the same way it would talk to a real computor. This is the bulk of development. The package's local dev story mirrors the AigarthPool simulator pattern (`packages/aigarthpool/src/simulator.ts:1-620`).
2. **Qubic public testnet.** Once local works, point the OC processor at the Qubic public testnet. The testnet has the same OC mechanism as mainnet but with testnet QUBIC (no value). The 451/676 signature verification is exercised end-to-end here.
3. **`ocmock.qubic.org`.** This is the operator dashboard. It is not a deployment target; it is a *monitoring* target. The Aigarth team watches what the network triggers against `ocmock` to understand what the real mainnet will look like, before exposing Aigarth to it.
4. **Mainnet shadow (Epoch 223-224 era, late July 2026; live since 2026-07-29 per `RESEARCH-AUDIT-2026-08-12.md:43`).** Register the Aigarth OC processor on mainnet, but with `fee_qubic` set high enough that no rational Qubic smart contract calls it. Watch the operator dashboards for a full epoch. This proves the registration, the signature verification, and the rate-limit accounting all work against real mainnet traffic.
5. **Mainnet live (post-Phase 27 success).** Lower the fee to the target (1 QUBIC per invocation for materials, per v0.2 §31 example). Open the rate-limit caps to the values in §6.1. This step requires the user to approve; the default behaviour is to stay in step 4 until Phase 27 ships a successful Evolution Run.

### 7.2 The "production" gate

Step 5 is gated on:

- The Work Runtime (ADR 006) is live and exercised by at least one internal Aigarth Organism in production.
- The AigarthPool mainnet deploy (Phase 20.6) has cleared the external audit gate (`docs/aigarthpool/audit-checklist.md:38-46` E1).
- The Aigarth OC operator has run steps 1-4 for at least one full Qubic epoch (1 week) with zero unresolved incidents.
- The user has approved the move from step 4 to step 5 in writing.

## 8. Cost + economics

The fee the Aigarth OC processor charges for an invocation is set at registration time (the `manifest.fee_qubic` field, §3.1). The Qubic smart contract pays the fee; the Qubic computors route the fee to the Aigarth-controlled processor wallet.

### 8.1 Fee model

| Component | Amount | Direction | Notes |
|---|---|---|---|
| `fee_qubic` per invocation | 1 QUBIC (default for materials; v0.2 §31 example) | Caller → Aigarth processor wallet | Set at registration; immutable per processor id. |
| `work_item.reward.amount` | Same as `fee_qubic` (the OC handler maps 1:1) | Aigarth processor wallet → Worker (via Work Runtime) | The Aigarth processor pays the worker in QUBIC; the spread is zero by default. |
| `compute_consumed` ledger | 1 work item per invocation | Aigarth processor → Organism's `compute_consumed.qubic` | The Organism that requested the OC invocation (if any) is debited; without an Organism, the fee is debited to the Aigarth research budget. |

The 1:1 fee-to-reward mapping means Aigarth does not profit from the OC processor in v1. The OC processor is a *pass-through*: the caller pays 1 QUBIC, the worker receives 1 QUBIC, Aigarth absorbs any operational overhead. This is intentional. The AigarthPool M3 (per-tx cap, 1,000,000 QUBIC) is the per-invocation upper bound; the OC processor's `fee_qubic` cannot exceed that, by platform convention.

### 8.2 Settlement

Settlement happens *off-chain* between the Qubic smart contract (which pays the fee) and the Aigarth processor wallet (which receives it). The Qubic OC mechanism handles the transfer; the Aigarth processor does not need to do anything beyond registering its wallet address in the manifest. The Work Runtime's accountant (ADR 006) reconciles the Aigarth processor wallet's QUBIC balance against the `work_items.reward.amount` field on every `RewardsClaimed` event. The reconciliation is the same pattern as the AigarthPool watcher's reconciliation (`services/qubic/src/workers/aigarthpool-watcher.ts:1-117`).

### 8.3 Relationship to AigarthPool

The OC processor is **separate** from the AigarthPool. AigarthPool holds Aigard stakes; the OC processor receives per-invocation fees. The two contracts do not share state. A future ADR may route the OC processor's surplus (if any) through the AigarthPool's governance to the treasury; that is out of scope for this ADR.

The 2026-08-19 QUBIC halving at Epoch 227 (`RESEARCH-AUDIT-2026-08-12.md:80-82`) will halve the QUBIC emission. This does *not* affect the OC processor directly (the fee is in absolute QUBIC, not a fraction of emission), but it does affect any *Aigarth* model that budgets QUBIC spend by `fee_qubic × invocations_per_epoch`. v0.2 §27 (Economics, `aigarth-cloud-evolution-pep-v0.2.md:866-891`) does not name the OC processor in its reward table; this ADR fills that gap with the row *"OC invocation fee — Caller (Qubic SC) → Aigarth processor wallet → Worker (pass-through)"*.

## 9. Routes

The Aigarth-side OC processor surfaces in three places: the OC processor endpoint itself (HTTPS, the Qubic-facing surface), the internal admin routes (token-gated), and the Work Runtime's processor-routing table.

### 9.1 OC processor endpoint (Qubic-facing)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| `POST` | `/oc/:processor_id/invocation` | None at TLS; 451/676 signature in body | `QubicInvocation` | `QubicResult` (200) or `{ error: ... }` (4xx/5xx) | The HTTPS endpoint from the manifest. v0.2 §31 example uses `https://aigarth.cloud/oc/materials` (`aigarth-cloud-evolution-pep-v0.2.md:1028`). |
| `GET` | `/oc/:processor_id/health` | None | — | `{ status: "ready" | "paused", epoch, last_invocation_at }` | The Qubic operator dashboard pings this. Cheap, public, no PII. |
| `GET` | `/oc/:processor_id/manifest` | None | — | `OcProcessorManifest` | Public. The Qubic smart contract fetches this to discover fee + endpoint + pubkey. |

### 9.2 Internal admin routes (token-gated)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| `POST` | `/v1/oc/processors` | `INTERNAL_TOKEN` | `OcProcessorManifest` | `{ registration_tx_hash, manifest_hash }` | Submits the registration tx to the Qubic OC registry. v0.2 §31 is the canonical shape. |
| `POST` | `/v1/oc/processors/:processor_id/pause` | `INTERNAL_TOKEN` | `{ reason: string }` | `{ state: "OPEN", paused_at }` | Operator pause (M4 circuit breaker manual). |
| `POST` | `/v1/oc/processors/:processor_id/resume` | `INTERNAL_TOKEN` | — | `{ state: "HALF_OPEN", resumed_at }` | Operator unpause. |
| `GET` | `/v1/oc/processors/:processor_id/state` | `INTERNAL_TOKEN` | — | `{ breaker: "CLOSED"|"OPEN"|"HALF_OPEN", rate_limits, last_invocation_at }` | Operator visibility. |
| `GET` | `/v1/oc/processors` | `INTERNAL_TOKEN` | — | `ReadonlyArray<{ processor_id, state, registrations: [...] }>` | List all OC processors the Aigarth deployment knows about. |
| `POST` | `/v1/oc/processors/:processor_id/rotate-key` | `INTERNAL_TOKEN` | `{ new_pubkey: string }` | `{ rotation_tx_hash }` | Re-registration with a new `result_pubkey`. Old key remains valid for a grace period (one Qubic epoch) to let in-flight results land. |

All `INTERNAL_TOKEN`-gated routes use the same `internal_dev_token_change_me` token convention as `services/identity` and `services/economy` (per `AGENTS.md` §1). The token is rotated before any non-dev registration (see §11 negative consequence #2).

### 9.3 Work Runtime processor-routing table

The Work Runtime needs to know which processor (local, remote, OC) a work item should go to. The mapping is in the `work_algorithms` table (defined in ADR 006); the OC processor's entry looks like:

```ts
// services/work/src/db/schema.ts (ADR 006) — additive for OC
{
  algorithm_slug: "dft_relaxation",
  worker_kind: "oc-processor",          // from v0.2 §5, aigarth-cloud-evolution-pep-v0.2.md:156
  processor_id: "aigarth-cloud-materials",  // the OC processor manifest.processor_id
  processor_endpoint: "https://aigarth.cloud/oc/materials",
  fallback_worker_kind: "local",         // if the OC processor is paused, fall back to local
}
```

The fallback is mandatory. If the OC processor's circuit breaker is OPEN, the Work Runtime transparently routes the work item to a local Docker runner (ADR 006's `worker.kind = "local"`). The caller of the work item (an Aigarth Organism) does not see the difference; the work item's `result.metadata.execution_path` field records the actual route for audit.

## 10. Consequences (positive)

1. **Aigarth is now a Tier 3 compute surface.** The Work Runtime (ADR 006) gains the ability to receive work from any Qubic smart contract. v0.2 §13 (`aigarth-cloud-evolution-pep-v0.2.md:442`) names this as one of seven heterogeneous compute classes; the OC processor is the only one whose *caller* is a Qubic smart contract rather than an Aigarth user. The Proof Lab's N08 test (heterogeneous compute, `aigarth-cloud-evolution-pep-v0.2.md:650`) now has a real Tier 3 path to exercise.

2. **Aigarth's algorithms are reachable by the Qubic ecosystem.** A Qubic dApp that needs a DFT relaxation, a materials simulation, or any other Aigarth-registered algorithm can call Aigarth from a smart contract — no Aigarth account required, no Aigarth JWT, no Aigarth UI. The trust root is Qubic's, not Aigarth's. This is the first surface where Aigarth is *consumed* by an external ecosystem without any Aigarth-side auth.

3. **The 451/676 trust root is inherited, not invented.** v0.2 §15 (`aigarth-cloud-evolution-pep-v0.2.md:498`) is explicit: *"the platform is not the trust root; Qubic is."* The OC processor gets to inherit Qubic's two-thirds-computor economic security for free. No Aigarth-side signature, no Aigarth-side reputation system, no Aigarth-side staking needs to underwrite the *invocation* — only the *result*.

4. **The rate-limit + circuit-breaker patterns are reusable.** The M3 (per-tx + per-user-per-epoch) and M4 (pause flag) patterns from `docs/aigarthpool/audit-checklist.md:70-99` are now applied to two services (AigarthPool + OC processor). The third service that adopts them (likely a Neuraxon runtime integration in Phase 31) gets them for free, in a battle-tested form.

5. **Aigarth's on-chain footprint is wider.** The Phase 20 AigarthPool writes to chain (stakes, splits, governance). The new OC processor registration writes to chain (the manifest). Future phases can build on the OC processor's `result_pubkey` (e.g., on-chain lineage attestation at v0.2 §16, `aigarth-cloud-evolution-pep-v0.2.md:525`) without redeploying any Aigarth-side infrastructure.

## 11. Consequences (negative)

1. **DoS attack: any Qubic smart contract can invoke the OC processor, and without rate limits a malicious contract can drain it in seconds.** A Qubic smart contract with a 1-QUBIT fee budget can call the Aigarth OC processor up to `fee_budget / fee_qubic` times per epoch. With the v0.2 §31 default of 1 QUBIC per invocation, a contract holding 1,000,000 QUBIC (the AigarthPool M3 per-tx cap, `packages/aigarthpool/src/simulator.ts:57`) can make 1,000,000 invocations per epoch. If the OC processor does not have the §6.1 three-layer rate limit, each invocation kicks off a Work Runtime `execute` call (which forks a container, hits Postgres, signs a result), and 1,000,000 of those in one epoch is a denial-of-service against the Aigarth service. The attack does not require breaking the 451/676 signature; it is *within* the protocol. The fix is the §6.1 per-caller (10/epoch) and per-processor (1,000/epoch) caps, which fire before the Work Runtime is touched. **The rate-limit is the security boundary; without it, the OC processor is a free DoS amplifier.**

2. **`internal_dev_token_change_me` token rotation is mandatory before any non-dev OC processor registration.** The internal admin routes (§9.2) use the same `INTERNAL_TOKEN` convention as `services/identity` and `services/economy` (per `AGENTS.md` §1, "Internal-token pattern (Phase 18 closeout)"). The dev default value is `internal_dev_token_change_me`. A leaked or unchanged token on a production OC processor means: (a) anyone can pause / resume the processor at will; (b) anyone can re-register a new processor pointing at a malicious endpoint; (c) anyone can rotate the result-signing key. The AigarthPool audit checklist (`docs/aigarthpool/audit-checklist.md:38-46`, E1) requires a Qubic-aware external audit before mainnet, and the audit will fail the deployment if the internal token is `internal_dev_token_change_me`. The fix is a per-environment secret in the deployment pipeline; the OC processor is no exception.

3. **Aigarth is exposed to *any* Qubic smart contract — the trust model shifts from the Aigarth deployment to Qubic's 451/676 threshold.** Pre-OC, an Aigarth API call is authenticated by an Aigarth JWT issued by `services/identity` (port 7001). Post-OC, an Aigarth API call can be authenticated by a Qubic smart contract's invocation bundle. Aigarth no longer controls *who* calls it; Qubic does. The economic and legal implications of this shift are out of scope for this ADR, but the build must acknowledge that the same `/oc/:processor_id/invocation` endpoint is reachable by any Qubic dApp, regardless of whether Aigarth has a relationship with that dApp's operator. The §6 rate limits are the operational control; the legal terms-of-service for the OC processor (not yet drafted) are the legal control.

4. **The only public test surface is `ocmock.qubic.org`; production requires Epoch 223+ mainnet exposure (live since 2026-07-29 per `RESEARCH-AUDIT-2026-08-12.md:43`).** AIO Dev Kit local is fine for unit and integration tests but does not exercise the 451/676 signature path. The `ocmock.qubic.org` operator dashboard lets Aigarth *watch* what the network triggers, but the *first* end-to-end 451/676 signature verification against a real mainnet invocation happens when the OC processor is registered on mainnet (step 4 in §7.1). Until then, signature-verification bugs are caught in shadow mode, not in production. The risk is real but bounded: the rate limits + circuit breaker (§6) ensure a bug in signature verification does not drain the Aigarth service, it just rejects invocations.

5. **The result attestation scheme is open.** The default candidate is Ed25519 (matching Qubic's computor signature scheme, per the QPI `id` type at `services/aigarthpool/contract/AigarthPool.h:46`). If Qubic's OC result verification requires a different scheme (e.g., Schnorr over secp256k1, or a Qubic-native signature), Aigarth must adopt that scheme, which means re-signing every result and potentially re-registering the OC processor. The migration cost is bounded (one Qubic tx + a config flag), but the discovery cost — *finding out* which scheme Qubic requires — is a real coordination risk with the Qubic team. See §13 Open Question #1.

6. **The OC processor does not know which Aigarth Organism requested the invocation.** A Qubic smart contract can call Aigarth directly (without an Organism), and the OC processor must handle that case. In v1, the OC processor routes the invocation to the *first* Aigarth Organism with a matching capability (`/v1/organisms?capability=dft_relaxation&status=active&limit=1`). If no Organism matches, the OC processor runs the algorithm as a one-off work item, debits the fee to the Aigarth research budget, and emits an audit event. The full `organism_id` → `invocation` mapping is a v1.1 enhancement (an Organism would call OC through the Work Runtime, not the other way around). This means the OC processor's first production incarnation has a slightly looser provenance model than v0.2 §25 (Data Provenance, `aigarth-cloud-evolution-pep-v0.2.md:830-843`) prescribes. The build must document the gap.

## 12. Alternatives considered

**a) Aigarth as OC *client* (rejected).** v0.2 §1 (Falsification Audit, `aigarth-cloud-evolution-pep-v0.2.md:40`) and §16 (Qubic, `aigarth-cloud-evolution-pep-v0.2.md:514`) are explicit: *"OC is outbound: smart contracts send authorized instructions to external systems."* Aigarth as an OC client would mean: Aigarth deploys its own Qubic smart contract, Aigarth's contract calls OC on some external processor, the external processor does the work. This is the inverse of the v0.2 §13 ("Heterogeneous Compute") table (`aigarth-cloud-evolution-pep-v0.2.md:442`), which lists Aigarth as the *processor* and the external Qubic smart contract as the *caller*. The "OC as compute marketplace" framing in v0.1 §25 (Kill List, `aigarth-cloud-evolution-pep-v0.2.md:927`) is killed for this same reason. The v0.2 architecture is correct; this ADR adopts it.

**b) Custom Qubic protocol changes for useful work (deferred to Tier 4 research).** v0.2 §16 (`aigarth-cloud-evolution-pep-v0.2.md:524`) names this row: *"Custom uPoW integration — REQUIRES QUBIC PROTOCOL RESEARCH — Phase 30+ research."* A custom Qubic protocol change (e.g., adding a new "useful work" field to the uPoW block) would let Aigarth be a *miner* rather than a *processor*, with the network paying Aigarth in QUBIC for useful work rather than callers paying Aigarth per invocation. This is a fundamentally different economic model (reward-from-network rather than payment-from-caller) and requires Qubic-side consensus changes that are not on the public roadmap. The Aug 6, 2026 All-Hands Recap's mention of an *"ant colony mining algorithm — EP228"* (`RESEARCH-AUDIT-2026-08-12.md:72`) is the closest Qubic-side movement, but it is a *next uPoW* (replacing BPP-9000), not a *useful-work primitive*. This is a Tier 4 / Phase 30+ research item; this ADR defers it.

**c) Aigarth runs BPP-9000 miners (rejected).** v0.2 §1 (`aigarth-cloud-evolution-pep-v0.2.md:41`) and §17 (BPP-9000, `aigarth-cloud-evolution-pep-v0.2.md:531-552`) are explicit: BPP-9000 is *"one algorithm, one dataset (1 year of BTC hourly prices), one objective (3-state prediction), one reward function (1 − error rate). It is not a precedent for 'heterogeneous mining.'"* Running BPP-9000 miners would mean Aigarth's GPUs and CPUs spent on Bitcoin price prediction. That is unrelated to the v0.2 thesis (Aigarth grows useful intelligences, not BTC forecasters). The kill list (`aigarth-cloud-evolution-pep-v0.2.md:925`) names the misnomer explicitly: *"Universal mining algorithm — KILL — Misnomer. Qubic has one algorithm at a time."* Aigarth is not a miner.

## 13. Open questions

Decisions the build stream must make before or during Wave A / Phase 29 implementation. Marked `BLOCKER` (must be resolved before the related code can ship) or `NON-BLOCKER` (can ship with a documented default; resolved in a follow-up ADR).

1. **`BLOCKER` — Rate-limit policy.** The §6.1 table specifies the *mechanism* (three-layer rate limit: per-caller, per-processor, per-epoch) and the *defaults* (10 / 1,000 / 5,000 per epoch). It does not specify the *policy*: (a) is the per-caller cap the same for every Qubic smart contract, or are Aigarth-curated callers (e.g., a Qubic dApp that has signed a partnership agreement) granted a higher cap? (b) Are the caps fixed per epoch, or do they scale with the Aigarth deployment's measured capacity? (c) When the per-epoch cap is hit, do we reject new invocations or queue them for the next epoch? (d) How do the caps interact with the 2026-08-19 QUBIC halving at Epoch 227 (`RESEARCH-AUDIT-2026-08-12.md:80-82`)? This is a security question, not a feature — the rate limit is the DoS-defence boundary in §11 negative consequence #1, and the wrong policy (e.g., "queue instead of reject") turns the DoS into a memory-exhaustion attack against the Aigarth service.

2. **`BLOCKER` — Result signing scheme.** The default candidate is Ed25519 (matching Qubic's QPI `id` type, `services/aigarthpool/contract/AigarthPool.h:46`). The alternatives are Schnorr over secp256k1, or a Qubic-native scheme. The build stream must confirm with the Qubic team which scheme the OC smart contract will verify against, before the manifest schema is frozen. A late change is a re-registration tx (one Qubic tx + a config flag), but the wrong default means every result on day 1 is unverifiable on the Qubic side.

3. **`NON-BLOCKER` — OC processor key custody.** The Aigarth OC processor signs results with a private key whose public counterpart is in the manifest. Where does the private key live? Three options: (a) environment variable on the Aigarth service (simplest, but the key is on disk); (b) Aigarth secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager); (c) HSM (most secure, slowest). The AigarthPool governance path (`docs/aigarthpool/governance.md`) has a similar question for the treasury multi-sig. The OC processor key is operationally less critical (rotating it is one re-registration tx, not a multi-sig approval flow), so option (b) is the default candidate. The build stream should confirm with the security reviewer.

4. **`NON-BLOCKER` — Provenance mapping for non-Organism callers.** §11 negative consequence #6 names the gap: the OC processor's first production incarnation cannot always map an invocation back to an Aigarth Organism. The v1.1 fix is to require the caller to include an optional `organism_slug` in the `QubicInvocation.payload`, which the OC handler uses to look up the Organism. The v1 work-around (route to the first matching Organism, or run as a one-off) is acceptable for the contract, but the build stream should track the gap.

5. **`NON-BLOCKER` — Per-capability rate limits.** The §6.1 table treats all capabilities under one processor as one bucket. A `dft_relaxation` invocation and a `trinary_decision` invocation share the per-caller and per-processor caps. If one capability is much more expensive than the other (DFT relaxations are O(seconds) per call; trinary decisions are O(milliseconds)), a caller could DoS the expensive capability by saturating the per-processor cap with cheap calls. The v1.1 fix is per-capability sub-limits. The build stream should document the limitation and the fix path.

6. **`NON-BLOCKER` — `ocmock.qubic.org` as a development dependency.** The AIO Dev Kit is local; `ocmock.qubic.org` is a hosted Qubic operator dashboard. The build stream should clarify whether the OC processor's integration test suite hits `ocmock.qubic.org` (a live external dependency in CI) or only the AIO Dev Kit (local). The AIO Dev Kit is sufficient for the §7.1 step 1; `ocmock.qubic.org` is for step 3 (operator monitoring, not automated test). The CI test suite should not depend on `ocmock.qubic.org`.

7. **`NON-BLOCKER` — Graceful degradation when the Work Runtime is down.** §6.2's circuit breaker opens on error rate. If the Work Runtime is *fully* down (not just slow), the OC processor's circuit should open on the first error, not wait for 25% over 5 minutes. The build stream should add a "circuit auto-opens on Work Runtime health check failure" path. The AigarthPool M4 pattern does not have this (it is a manual pause); the OC processor needs the auto-open because the OC handler is not the rate-limiter's caller — the Qubic computor is, and the computor will keep sending invocations.

---

**Wave A acceptance gate (Phase 29 Build, per `docs/evolution/CHECKPOINT-2026-08-12.md:108-114`):** the OC processor is not "done" until the §7.1 steps 1-3 are green (local AIO, public testnet, `ocmock.qubic.org` monitoring). Step 4 (mainnet shadow) and step 5 (mainnet live) are gated on the user, the AigarthPool external audit (E1), and the Phase 27 success criteria. Per the checkpoint §8, no agent working on this evolution may mark a step "done" without the `verifier` agent's `VERDICT: PASS` on that step's specific deliverable. A FAIL on any check returns the deliverable to its producer with the specific gap named.
