# Annex: Milestone Detail — QA Acceptance Criteria and Non-Scope

**Purpose:** expand the four milestones from [`proposal.md` §5](./proposal.md#5-milestones) with objective, user-perspective acceptance criteria (what the Qubic project manager uses to gate payment) and explicit non-scope (what the milestone does not deliver).
**Per Qubic's program spec:** "Milestones must be composed of testable deliverables from a user perspective (documentation, mockups, features…)."

---

## Milestone 1 — Foundation Platform

**Timeline:** months 1–3
**Tranche:** 25B QUBIC, USD-indexed at release

### Deliverables (user-perspective)

- Production deployment of the Aigarth Cloud platform at `app.aigarth.cloud`, accessible without VPN.
- Authentication flow: email + password, with magic-link and Qubic wallet sign-in supported.
- Qubic wallet integration: link a Qubic mainnet wallet to an account, view balance, view connected address.
- Developer dashboard at `dashboard.aigarth.cloud`: account, API keys, usage history.
- API key management: create, rotate, revoke, scoped to per-environment.
- ANN registry: list, search, and view detail for at least 10 published ANNs.
- Documentation portal at `docs.aigarth.cloud`: getting started, authentication, first API call, ANN registry reference.
- Compute allocation simulator: input stake amount, output projected compute hours and rate.

### QA acceptance criteria (verifiable by the Qubic project manager)

| # | Criterion | Verification method |
|---|---|---|
| 1 | `app.aigarth.cloud` returns 200 OK on a fresh browser session, with no console errors | HTTP request + headless browser screenshot |
| 2 | A new user can sign up, confirm email, and sign in via magic link | End-to-end test script |
| 3 | A signed-in user can link a Qubic mainnet wallet and see their balance | End-to-end test with a known test wallet |
| 4 | A signed-in user can create an API key, make a `GET /v1/identity/me` call with it, and see the response | End-to-end test script with key + call |
| 5 | API key rotation produces a new key that works; the old key returns 401 | End-to-end test script |
| 6 | ANN registry lists at least 10 ANNs, each with name, description, version, and a sample input/output pair | Direct GET on `/v1/ann` |
| 7 | `docs.aigarth.cloud` renders a getting-started guide, an authentication guide, and a first-API-call guide, with working code samples | Manual review + HTTP check |
| 8 | Compute allocation simulator accepts a QUBIC stake amount and returns projected compute hours and rate | Direct test in browser |

### Success metrics (program-level)

- 1,000 registered users.
- 100 developer testers with at least one successful API call each.
- 95% of sign-up-to-first-API-call flows complete in under 5 minutes.

### Non-scope (explicitly out of M1)

- No ANN marketplace (registry only, no transactions).
- No compute marketplace (simulator only, no live matching).
- No enterprise features (no SSO, no org accounts, no audit logs).
- No staking integration (wallet balance is view-only).
- No AI gateway or OpenAI-compatible API surface.
- No revenue or billing.
- No SDK beyond the underlying HTTP client.
- No public beta marketing push.
- No mobile apps.
- No internationalisation beyond English.

---

## Milestone 2 — AI Infrastructure Layer

**Timeline:** months 3–6
**Tranche:** 25B QUBIC, USD-indexed at release

### Deliverables (user-perspective)

- AI gateway: OpenAI-compatible surface at `/v1/chat/completions` and `/v1/completions`, accepting the standard request and response shapes.
- Usage tracking: every API call is metered, recorded, and viewable in the developer dashboard.
- Compute scheduler: routes requests to the appropriate backend (Qubic node operator or fallback cloud) based on availability and cost.
- ANN deployment system: an ANN creator can upload weights and metadata, the system validates, and the ANN becomes queryable through the gateway.
- Initial external workloads: 10 ANNs from external creators running in production, with at least 100,000 successful completions across them.
- Developer SDKs: TypeScript and Python SDKs published to npm and PyPI, versioned.

### QA acceptance criteria

| # | Criterion | Verification method |
|---|---|---|
| 1 | `POST /v1/chat/completions` with an OpenAI-compatible request body returns an OpenAI-compatible response body | Integration test with the OpenAI Python client |
| 2 | The OpenAI compatibility check passes: streaming, function-calling (if supported), stop sequences, temperature, top_p all behave as documented | Test suite with reference cases |
| 3 | Every API call increments the user's usage counter, and the counter is visible in the dashboard within 5 seconds | End-to-end test |
| 4 | The scheduler demonstrably routes to Qubic nodes when available and falls back to cloud when not, with both paths visible in logs | Chaos test: kill Qubic node, observe fallback, restore, observe routing |
| 5 | An external creator can upload a weights file (≤ 1 GB), pass validation, and have their ANN queryable in under 10 minutes | End-to-end test with a real creator |
| 6 | 10 ANNs from at least 3 distinct external accounts are queryable in production | Direct query + creator review |
| 7 | 100,000 successful completions across the 10 ANNs, with a p95 latency under 2 seconds for short completions | Production metrics dashboard |
| 8 | TypeScript SDK installs via `npm install @aigarth/sdk` and Python SDK via `pip install aigarth`; both have working quickstart examples | Manual install + test |

### Success metrics (program-level)

- 10 deployed ANNs in production.
- 100 API users with at least 100 successful completions each.
- First external application running on Aigarth Cloud.
- 1,000,000 successful completions across the platform.

### Non-scope

- No marketplace fees or revenue capture (still free for users).
- No enterprise tier, no SSO, no audit logs.
- No compute marketplace (compute is platform-provisioned, not user-contributed).
- No ANN creator monetisation (registry and deploy only).
- No mobile SDKs.
- No i18n.
- No third-party model integrations beyond what the 10 ANNs ship with.
- No fine-tuning infrastructure.

---

## Milestone 3 — Marketplace Ecosystem

**Timeline:** months 6–9
**Tranche:** 25B QUBIC, USD-indexed at release

### Deliverables (user-perspective)

- ANN marketplace: creators publish ANNs with pricing (per-call, per-token, or subscription), users discover and purchase.
- Compute marketplace: node operators list capacity, users and ANNs consume it, settlement in QUBIC.
- Creator profiles: bio, published ANNs, earnings, reviews.
- Licensing: per-ANN licence terms (open, commercial, custom) enforced at the gateway.
- Revenue dashboards: per-creator, per-ANN, per-period, with export to CSV.
- Staking integration: stake QUBIC to receive compute allocation, with on-chain settlement.
- Smart contract deployment: aigarthpool staking contract on Qubic mainnet, audited.
- First commercial transactions: at least 100 paid marketplace transactions.

### QA acceptance criteria

| # | Criterion | Verification method |
|---|---|---|
| 1 | A creator can publish an ANN with a per-call price of 0.01 QUBIC, and a user can pay for and receive a completion | End-to-end marketplace flow |
| 2 | Compute marketplace shows at least 3 active node operators with available capacity | Direct query on `/v1/compute/marketplace` |
| 3 | A user can stake 1,000 QUBIC and see their compute allocation in the dashboard, updated within 5 minutes of the on-chain confirmation | End-to-end staking flow |
| 4 | Licence terms (open, commercial, custom) are enforced: a user without the right licence receives a 402 Payment Required response with the licence offer | Integration test |
| 5 | Revenue dashboard shows correct attribution to creators, with CSV export | Sample dataset + manual review |
| 6 | Aigarthpool contract is deployed to Qubic mainnet at a published address, with a public audit report attached | On-chain check + report link |
| 7 | 100 paid marketplace transactions have occurred, with on-chain settlement receipts | Marketplace query + chain check |
| 8 | Smart contract audit report is public and shows no critical or high-severity findings unresolved | Audit report review |

### Success metrics (program-level)

- 50 ANNs published in the marketplace.
- 500 marketplace users.
- 1,000,000 QUBIC transacted through the marketplace.
- 10 active compute contributors (node operators).

### Non-scope

- No enterprise tier.
- No on-prem deployment options.
- No mobile SDKs.
- No advanced analytics or BI tooling on top of the revenue dashboard.
- No DAO governance for the aigarthpool (the contract is operator-controlled with a multisig, not a token-vote).
- No cross-chain bridge integrations (Qubic only).
- No fiat off-ramp integration (fiat entry is via CEX-to-Qubic).

---

## Milestone 4 — Commercial Launch

**Timeline:** months 9–12
**Tranche:** 25B QUBIC, USD-indexed at release

### Deliverables (user-perspective)

- Enterprise platform: SSO (SAML and OIDC), org accounts, role-based access, audit logs.
- Enterprise billing: annual contracts, custom invoicing, usage-based add-ons.
- Node operator system: onboarding, monitoring, payouts, performance SLAs.
- SDK ecosystem: Go and Rust SDKs in addition to TypeScript and Python.
- Hardware roadmap: published reference designs for the Aigarth hardware ecosystem.
- Partnership programme: tiered partnerships (technology, channel, solutions) with public criteria.
- First enterprise pilots: at least 10 paying enterprise customers.

### QA acceptance criteria

| # | Criterion | Verification method |
|---|---|---|
| 1 | An enterprise admin can configure SAML SSO and onboard at least 3 users via the SSO flow | End-to-end test with a SAML IdP |
| 2 | An org admin can assign roles (admin, developer, viewer) and the role is enforced on the API | RBAC test matrix |
| 3 | Audit logs capture every privileged action, are immutable, and exportable as JSON | Test + sample export |
| 4 | A node operator can onboard a new node, see it in the marketplace, and receive a payout after a successful period | End-to-end node flow |
| 5 | Go and Rust SDKs are published, versioned, and pass the same compatibility tests as TypeScript and Python | Test suite + manual install |
| 6 | Hardware roadmap is published at `aigarth.cloud/hardware` with reference designs for at least one product category | Direct check |
| 7 | Partnership programme page lists at least 3 partnership tiers with criteria and an application form | Direct check |
| 8 | 10 enterprise pilots are in active contracts, with at least 5 having paid invoices | Sales records + payment evidence |

### Success metrics (program-level)

- 10 enterprise pilots.
- 1,000 developers with active API keys.
- First $1M in cumulative platform revenue.
- 1,000,000 compute hours consumed.
- 100,000 marketplace transactions.

### Non-scope (explicitly out of M4)

- No SOC 2 Type 2 audit (Type 1 readiness only; full audit is Q5–Q7 work).
- No mobile SDKs.
- No white-label or OEM platform offerings.
- No advanced AI features (no fine-tuning, no RLHF, no RAG-as-a-service at platform level).
- No integration with Qubic sidechains or partner chains (Qubic mainnet only).
- No re-architecture of the aigarthpool.
- No transition to a DAO structure.

---

## Cross-milestone quality bar

These apply to every milestone and are part of the QA gate:

- **Type-check clean** across all services, SDKs, and contracts.
- **Smoke tests pass** for the affected paths.
- **Documentation is current** — every shipped feature has a doc page or a changelog entry.
- **No critical or high-severity security findings** unresolved at the milestone's QA gate.
- **License headers on every source file** under Apache 2.0.
- **Open-source dependency audit clean** — no GPL/AGPL contamination in the user-facing product, no known critical CVEs in dependencies.

## Linked documents

- [`../proposal.md` §5 — Milestones](./proposal.md#5-milestones)
- [`../annex-cash-flow.md`](./annex-cash-flow.md) — how each tranche is funded and disbursed
- [`../annex-compliance.md` §7 — Smart contract audit](./annex-compliance.md#7-smart-contract-audit)
