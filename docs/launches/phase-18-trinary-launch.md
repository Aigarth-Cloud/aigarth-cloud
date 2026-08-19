# Phase 18 — Trinary Intelligence Launch

**Status:** Live (dev + staging)
**Date:** 2026-08-04
**Author:** Principal Architect, Aigarth Cloud

## TL;DR

Phase 18 ships the **Trinary Intelligence Layer** on Aigarth Cloud: every ANN
now emits a signed `+1 | 0 | -1` decision envelope, and a new **tissue** primitive
lets you compose multiple ANNs into a single auditable decision. The product
surface — Studio builder, marketplace listings, billing, decision history — is
complete end-to-end.

## What's new

### The protocol

- **Trinary envelope.** Every `/decide` call returns a signed
  `IntentEnvelope` with `state ∈ {-1, 0, +1}`, `confidence`, `authority`,
  `reasoning`, and `reversibility` / `time_horizon`. The envelope is
  HMAC-SHA-256 signed and JSON-canonical for replay.
- **4 consensus policies** (`majority`, `unanimous`, `any`, `veto_aware`)
  plus `short_circuit` for first-decisive-wins fan-out.
- **Veto power.** A `veto` member returns `state = -1` → the entire tissue
  blocks, regardless of how the other members voted.
- **Most-conservative derivation.** `authority = max(contributors)`,
  `reversibility = max(...)`, `time_horizon = max(...)`. The tissue
  always surfaces the hardest constraint the contributors expressed.

### The service

- **`/v1/tissues`** — registry, public + unlisted + private, paginated
  search, status transitions (`draft → active → paused → deprecated`).
- **`/v1/tissues/:id/decide`** — the runtime. Fans out to all members in
  parallel with per-call timeout, combines their envelopes, signs, and
  persists. Append-only decision log.
- **`/v1/tissues/:id/licenses`** — per-grant access control. Owner is
  always allowed; `open` tissues are open; `licensed` tissues require
  an explicit (non-revoked, non-expired) grant row.
- **Tissue service** runs on port 7008 with its own DB schema, JWT
  secret (shared with identity), and HMAC signing key.

### The product

- **Studio tissue builder** at `apps/web/dashboard/tissues` — list, create,
  add members, publish, all in one form.
- **Marketplace tissue listings** — per-decision price, `open` vs `licensed`
  access model, automated counter increment on every `/decide` call.
- **Billing integration** — tissue usage events flow into per-period invoices
  as `overage_tissue` line items; existing `compute` and `chat` overage
  lines continue to work unchanged.
- **Internal dashboard** at `apps/dashboard/tissues` — ops view of all
  registered tissues + the last 50 decisions across the network.
- **SDK** — `client.tissues.{list, retrieve, create, decide, addMember,
  listDecisions, listLicenses, grantLicense, revokeLicense}` and
  `client.marketplace.tissueListings.{list, retrieve, create, close}`.

## Why it matters

The trinary protocol is the smallest change to the Aigarth API surface
that unlocks *coordinated* decisions across ANNs. Each ANN is a black box;
the tissue is the wiring. Same envelope, different authors. Same wire
contract, different responsibility boundary.

This is the first productization of the v1 Trinary Intelligence Layer
described in [ADR 003](../architecture-decisions/003-trinary-protocol-v1.md)
and the Neuraxon v2.0 paper by Vivancos & Sanchez (2026).

## Who can use it today

- **Open trinary calls:** any signed-in user, any ANN that's been
  registered in the network and is in trinary mode.
- **Licensed trinary calls:** the tissue owner has to grant a license
  via `POST /v1/tissues/:id/licenses` first. Useful for paid / private
  ANN compositions.
- **Marketplace calls:** browse `client.marketplace.tissueListings.list()`
  and call `tissues.decide(slug, { tissue_listing_id, cost_qubic })`.
  The cost flows through the billing service automatically.

## What's not in this release

- **Ed25519 + Qubic-wallet signing.** v1 uses HMAC-SHA-256 with a single
  per-service env-var key. v2 will rotate to per-ANN / per-tissue keys
  tied to Qubic wallets, with on-chain revocation.
- **Real LLM invocation in the ANN service.** The trinary /decide path
  uses a deterministic hash-based stub for envelope generation so the
  protocol and the product surface ship first.
- **Global /v1/decisions endpoint** for cross-tissue decision search.
  Phase 18E dashboards fan out per-tissue; a v2 endpoint will index all
  decisions in one place.
- **Per-grant cap enforcement.** `tissue_licenses.max_decisions` is
  persisted but not yet enforced on /decide. v2 will track usage and
  revoke when the cap is hit.

## What ships in the same release

- **zod pin** to `~3.23.8` (root `pnpm.overrides`) — zod 3.25 has a broken
  `./v3/external` ESM import; the pin keeps it stable across all services.
- **vitest** wired into the previously-testless marketplace and billing
  services; both now have unit tests for their new trinary-related code.
- **A new internal-token gate** for service-to-service calls
  (`MARKETPLACE_INTERNAL_TOKEN`, `BILLING_INTERNAL_TOKEN`) so the
  cross-service hooks are explicit and rotatable.

## Test & verification

| Service            | Tests | Notes |
|--------------------|-------|-------|
| `@aigarth/trinary` | 90    | 100% coverage, untouched by 18E/18F |
| `@aigarth/ann`     | 42    | Existing 18B tests, no regression |
| `@aigarth/gateway` | 16    | Existing 18C tests, no regression |
| `@aigarth/tissue`  | 51    | +7 license tests in 18E |
| `@aigarth/marketplace` | 16 | NEW — tissue listing zod tests |
| `@aigarth/billing` | 7     | NEW — tissue usage event tests |
| **Total**          | **222** | All green |

## See also

- [ADR 003 — Trinary Protocol v1](../architecture-decisions/003-trinary-protocol-v1.md)
- [User guide: trinary intelligence](../guides/trinary-intelligence.md)
- [Phase 18A delivery report](../deliveries/phase-18a-trinary-core-delivery.md)
- [Phase 18B delivery report](../deliveries/phase-18b-trinary-ann-integration-delivery.md)
- [Phase 18C delivery report](../deliveries/phase-18c-trinary-gateway-delivery.md)
- [Phase 18D delivery report](../deliveries/phase-18d-tissue-service-delivery.md)
- [Phase 18E + 18F delivery report](../deliveries/phase-18e-18f-delivery.md) (combined)
- [Video tutorial: how trinary intelligence works](../video/trinary-intelligence-walkthrough.md) (companion doc)
