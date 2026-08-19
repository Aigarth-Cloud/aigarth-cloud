# Milestones

> Required section 5 of the Qubic Incubation Program proposal.
> See [`README.md`](./README.md) for the full proposal index and [`proposal.md`](./proposal.md) for the executive summary.

---

## 1. Program Overview

The full program is four milestones over twelve months. Each milestone has a tranche, a timeline, deliverables, success metrics, QA acceptance criteria, and explicit non-scope. The acceptance criteria and non-scope are the gates for tranche release; they are in [`annex-milestone-detail.md`](./annex-milestone-detail.md).

| # | Milestone | Months | Tranche | Headline outcome |
|---|---|---|---|---|
| 1 | Foundation Platform | 1–3 | 25B QUBIC | Public alpha at `app.aigarth.cloud`, 1,000 users, 100 developers, ANN registry live |
| 2 | AI Infrastructure Layer | 3–6 | 25B QUBIC | OpenAI-compatible API live, 10 ANNs deployed, 100K completions, SDKs on npm and PyPI |
| 3 | Marketplace Ecosystem | 6–9 | 25B QUBIC | ANN and compute marketplaces live, aigarthpool audited and on mainnet, 100 paid transactions |
| 4 | Commercial Launch | 9–12 | 25B QUBIC | Enterprise tier, node operator system, Go and Rust SDKs, 10 enterprise pilots, $1M revenue |

## 2. Milestone 1: Foundation Platform

**Timeline:** months 1–3. **Tranche:** 25B QUBIC, USD-indexed at release.

### 2.1 Deliverables (user-perspective)

- Production deployment of the Aigarth Cloud platform at `app.aigarth.cloud`, accessible without VPN.
- Authentication flow: email + password, with magic-link and Qubic wallet sign-in supported.
- Qubic wallet integration: link a Qubic mainnet wallet to an account, view balance, view connected address.
- Developer dashboard at `dashboard.aigarth.cloud`: account, API keys, usage history.
- API key management: create, rotate, revoke, scoped to per-environment.
- ANN registry: list, search, and view detail for at least 10 published ANNs.
- Documentation portal at `docs.aigarth.cloud`: getting started, authentication, first API call, ANN registry reference.
- Compute allocation simulator: input stake amount, output projected compute hours and rate.

### 2.2 Success metrics

- 1,000 registered users.
- 100 developer testers with at least one successful API call each.
- 95% of sign-up-to-first-API-call flows complete in under 5 minutes.

### 2.3 Non-scope (explicitly out of M1)

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

## 3. Milestone 2: AI Infrastructure Layer

**Timeline:** months 3–6. **Tranche:** 25B QUBIC, USD-indexed at release.

### 3.1 Deliverables (user-perspective)

- AI gateway: OpenAI-compatible surface at `/v1/chat/completions` and `/v1/completions`, accepting the standard request and response shapes.
- Usage tracking: every API call is metered, recorded, and viewable in the developer dashboard.
- Compute scheduler: routes requests to the appropriate backend (Qubic node operator or fallback cloud) based on availability and cost.
- ANN deployment system: an ANN creator can upload weights and metadata, the system validates, and the ANN becomes queryable through the gateway.
- Initial external workloads: 10 ANNs from external creators running in production, with at least 100,000 successful completions across them.
- Developer SDKs: TypeScript and Python SDKs published to npm and PyPI, versioned.

### 3.2 Success metrics

- 10 deployed ANNs in production.
- 100 API users with at least 100 successful completions each.
- First external application running on Aigarth Cloud.
- 1,000,000 successful completions across the platform.

### 3.3 Non-scope

- No marketplace fees or revenue capture (still free for users).
- No enterprise tier, no SSO, no audit logs.
- No compute marketplace (compute is platform-provisioned, not user-contributed).
- No ANN creator monetisation (registry and deploy only).
- No mobile SDKs.
- No i18n.
- No third-party model integrations beyond what the 10 ANNs ship with.
- No fine-tuning infrastructure.

## 4. Milestone 3: Marketplace Ecosystem

**Timeline:** months 6–9. **Tranche:** 25B QUBIC, USD-indexed at release.

### 4.1 Deliverables (user-perspective)

- ANN marketplace: creators publish ANNs with pricing (per-call, per-token, or subscription), users discover and purchase.
- Compute marketplace: node operators list capacity, users and ANNs consume it, settlement in QUBIC.
- Creator profiles: bio, published ANNs, earnings, reviews.
- Licensing: per-ANN licence terms (open, commercial, custom) enforced at the gateway.
- Revenue dashboards: per-creator, per-ANN, per-period, with export to CSV.
- Staking integration: stake QUBIC to receive compute allocation, with on-chain settlement.
- Smart contract deployment: aigarthpool staking contract on Qubic mainnet, audited.
- First commercial transactions: at least 100 paid marketplace transactions.

### 4.2 Success metrics

- 50 ANNs published in the marketplace.
- 500 marketplace users.
- 1,000,000 QUBIC transacted through the marketplace.
- 10 active compute contributors (node operators).

### 4.3 Non-scope

- No enterprise tier.
- No on-prem deployment options.
- No mobile SDKs.
- No advanced analytics or BI tooling on top of the revenue dashboard.
- No DAO governance for the aigarthpool (the contract is operator-controlled with a multisig, not a token-vote).
- No cross-chain bridge integrations (Qubic only).
- No fiat off-ramp integration (fiat entry is via CEX-to-Qubic).

## 5. Milestone 4: Commercial Launch

**Timeline:** months 9–12. **Tranche:** 25B QUBIC, USD-indexed at release.

### 5.1 Deliverables (user-perspective)

- Enterprise platform: SSO (SAML and OIDC), org accounts, role-based access, audit logs.
- Enterprise billing: annual contracts, custom invoicing, usage-based add-ons.
- Node operator system: onboarding, monitoring, payouts, performance SLAs.
- SDK ecosystem: Go and Rust SDKs in addition to TypeScript and Python.
- Hardware roadmap: published reference designs for the Aigarth hardware ecosystem.
- Partnership programme: tiered partnerships (technology, channel, solutions) with public criteria.
- First enterprise pilots: at least 10 paying enterprise customers.

### 5.2 Success metrics

- 10 enterprise pilots.
- 1,000 developers with active API keys.
- First $1M in cumulative platform revenue.
- 1,000,000 compute hours consumed.
- 100,000 marketplace transactions.

### 5.3 Non-scope (explicitly out of M4)

- No SOC 2 Type 2 audit (Type 1 readiness only; full audit is Q5–Q7 work).
- No mobile SDKs.
- No white-label or OEM platform offerings.
- No advanced AI features (no fine-tuning, no RLHF, no RAG-as-a-service at platform level).
- No integration with Qubic sidechains or partner chains (Qubic mainnet only).
- No re-architecture of the aigarthpool.
- No transition to a DAO structure.

## 6. Cross-Milestone Quality Bar

These apply to every milestone and are part of the QA gate:

- Type-check clean across all services, SDKs, and contracts.
- Smoke tests pass for the affected paths.
- Documentation is current for every shipped feature.
- No critical or high-severity security findings unresolved at the milestone's QA gate.
- License headers on every source file under Apache 2.0.
- Open-source dependency audit clean: no GPL/AGPL contamination in the user-facing product, no known critical CVEs in dependencies.

## 7. Tranche Handling

Each tranche is held in a restricted cash pool, dedicated to the next milestone's burn, not redirected to new initiatives or founder distributions. The release schedule:

- Tranche 1: end of month 3, on M1 QA pass.
- Tranche 2: end of month 6, on M2 QA pass.
- Tranche 3: end of month 9, on M3 QA pass.
- Tranche 4: end of month 12, on M4 QA pass.

If a milestone does not pass QA, the project manager and the team agree on a remediation plan. The next tranche is not released until the prior milestone is signed off.

## 8. Linked documents

- [`proposal.md`](./proposal.md) — executive summary and proposal index
- [`annex-milestone-detail.md`](./annex-milestone-detail.md) — per-milestone QA acceptance criteria and non-scope
- [`annex-cash-flow.md`](./annex-cash-flow.md) — months 0–3 working capital plan
- [`06-commitment.md`](./06-commitment.md) — twelve-month commitment, hand-off plan
