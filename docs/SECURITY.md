# Security & Compliance

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Security / Engineering
**Last updated:** 2026-07-27
**Source docs:** [`PRD.md`](./PRD.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`BRD.md`](./BRD.md)

---

## 1. Threat model

Aigarth Cloud faces the same threats as any cloud AI platform, with these specifics:

- **Stake theft.** Attackers want to redirect stake settlements. Mitigation: signed settlement messages, hardware wallet integration for large stakes, time-locked withdrawals.
- **Inference exfiltration.** Attackers want to extract training data or proprietary ANNs via crafted prompts. Mitigation: rate limits, prompt classification, output filtering, signed receipts.
- **Provider impersonation.** Attackers want to run fake "ANN" endpoints and steal API keys. Mitigation: ANN manifests are signed; SDKs verify signatures before sending.
- **Operator compromise.** Node operators want to under-report usage to keep more rewards. Mitigation: usage attested by independent verifiers, slashing on detected fraud.
- **Enterprise data leakage.** Attackers want to cross tenant boundaries. Mitigation: tenant isolation at network, compute, and storage layers; per-tenant encryption keys.
- **Regulatory non-compliance.** We hold PII (email, billing, audit logs). Mitigation: data residency controls, GDPR-compliant deletion, SOC 2 controls.
- **Smart contract exploits.** Our Qubic integration is exposed to on-chain attack surface. Mitigation: minimal on-chain logic, audits, bug bounty, gradual rollout.

## 2. Authentication

- **Humans:** Email + password (Argon2id), TOTP MFA, WebAuthn passkeys, OAuth (Google, GitHub, Microsoft, Apple)
- **Machines:** API keys (`sk-aigarth-...`), scoped per environment (live/test), per project, with optional IP allowlists
- **Wallets:** Qubic wallet signature (signed nonce from us), verified against on-chain ownership
- **Sessions:** Short-lived JWT (15 min access, 30 day refresh), refresh token rotation on use
- **Service-to-service:** mTLS + signed JWT issued by Identity

## 3. Authorization

- **Model:** Resource-scoped RBAC with named roles
- **Built-in roles:** `owner`, `admin`, `member`, `guest`, `service`
- **Custom roles:** Per-org, with a list of scopes like `compute:read`, `ann:publish`, `billing:read`
- **Enforcement:** At the API gateway (centralized) and at the data layer (defense in depth)
- **Audit:** Every privileged action writes an `AuditEvent` row

## 4. Data protection

| Data class | At rest | In transit |
|---|---|---|
| User PII | AES-256-GCM with per-tenant key | TLS 1.3 |
| API keys | Hashed with Argon2id at rest; plaintext only shown once at creation | TLS 1.3 |
| Wallet seeds | Never stored; client-side only | TLS 1.3 (signing done client-side) |
| Inference inputs/outputs | Not stored by default; opt-in for debugging | TLS 1.3 |
| Training data (custom ANNs) | Encrypted with org-specific key | TLS 1.3 |
| Audit logs | Append-only, WORM storage | TLS 1.3 |
| Backups | Encrypted with rotated keys | TLS 1.3 |

## 5. Network security

- TLS 1.3 everywhere, HSTS, OCSP stapling
- mTLS between services in the cluster
- Per-tenant VPC for Enterprise plans; no cross-tenant traffic
- DDoS protection at the edge (Cloudflare)
- Web Application Firewall (WAF) for known attack patterns
- Rate limits at the gateway and per-API-key
- IP allowlists for Enterprise plans

## 6. Compute security

- Signed inference receipts: every response includes a hash signed by the executing node
- Attested hardware: TEE attestation where available
- Multi-tenant isolation: hardware-level isolation for dedicated clusters, namespace-level for shared
- No cross-tenant data access verified by automated tests
- Ephemeral compute: jobs run in sandboxes, state persisted separately

## 7. Smart contract / Qubic security

- Minimal on-chain logic (the contract should be small and easy to audit)
- All Aigarth services are **off-chain mirrors** of on-chain state; the on-chain contract is the source of truth for stake, settlement, and slashing
- Multi-sig on the treasury and any admin operations
- Time-locked parameter changes (≥ 48h between governance approval and execution)
- External audits before mainnet (Qubic Incubation Program requirements)
- Public bug bounty with severity-tiered rewards
- Gradual rollout: mainnet caps that grow as the system proves itself

## 8. Application security

- **Input validation:** Zod schemas at the API gateway and the service boundary
- **Output encoding:** React's default escaping, no `dangerouslySetInnerHTML` without sanitization
- **Dependency scanning:** Dependabot, npm audit, Snyk on every PR
- **SAST:** CodeQL on every PR
- **DAST:** OWASP ZAP weekly against staging
- **Secrets:** No secrets in code. CI fails on any secret pattern in commits
- **CSP:** Strict Content-Security-Policy on all web properties

## 9. Supply chain

- All dependencies pinned and locked
- Renovate keeps them up to date
- Production builds from CI, not developer machines
- Container images scanned (Trivy) before deploy
- SLSA-compliant build provenance

## 10. Incident response

- 24/7 on-call rotation starting Month 3
- P1: 15-min response, 1-hr mitigation target
- Incident command structure documented
- Status page updated within 15 min of confirmed incident
- Postmortem within 5 business days for any P1/P2
- Tabletop exercises quarterly

## 11. Compliance

Per the `ENDGAME-PROTO-PROPOSAL.md`, our target Year 1 posture:

| Framework | Status | Target |
|---|---|---|
| SOC 2 Type II | In progress | Report by end of M3 |
| ISO 27001 | In progress | Certification by end of M3 |
| HIPAA | Available on Business+ | Year 1 |
| GDPR | Compliant from day 1 | Day 1 |
| CCPA | Compliant from day 1 | Day 1 |
| FedRAMP Moderate | Roadmap | Year 2 |
| PCI DSS | Available on Enterprise | Year 1 |

Customer data residency:
- US, EU, APAC at launch
- Per-tenant region pinning for Enterprise
- Data never leaves the selected region without explicit opt-in

## 12. Bug bounty

- Public program via HackerOne or similar
- Severity-based rewards:
  - Critical: $100K
  - High: $25K
  - Medium: $5K
  - Low: $500
- Safe harbor for security researchers
- Coordinated disclosure, 90-day window
- Public postmortems after fixes

## 13. Privacy

- Data minimization: collect only what we need
- Clear privacy policy and cookie banner
- GDPR-compliant data export and deletion
- No selling of user data, ever
- Opt-in only for non-essential cookies
- DPO appointed (or founder acts in that role in Year 1)

## 14. AI-specific risks

- **Model inversion / extraction.** Mitigation: rate limits, output filtering, signed receipts that allow attribution
- **Training data poisoning.** Mitigation: source ANNs are attested and ranked; creator reputation is part of the marketplace
- **Bias and fairness.** Mitigation: published benchmarks; no deployment of ANNs with sub-threshold benchmark scores for sensitive categories
- **Hallucination in regulated use cases.** Mitigation: optional source-attribution mode; warnings in the UI for high-risk categories

## 15. Linked documents

- [`PRD.md`](./PRD.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`BRD.md`](./BRD.md)
- [`RISK-REGISTER.md`](./RISK-REGISTER.md)
