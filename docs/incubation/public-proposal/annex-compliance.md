# Annex: Legal and Compliance Posture

**Purpose:** document Aigarth Cloud's legal structure and compliance posture across the dimensions the Qubic Incubation Program and its review process care about.
**Length target:** one page. Every claim is auditable.

---

## 1. Entity

**Status at submission:** [TO BE FILLED BY FOUNDER — entity name, jurisdiction, registration number, formation date]

**Plan if no entity exists at submission:** form a single-member LLC (or local equivalent) in the founder's jurisdiction by the end of Milestone 1 month 1. The legal entity becomes the contracting party for the Qubic Incubation agreement, the smart contract audit, and all platform user agreements.

**Why this matters:** Qubic's Incubation agreement is signed by a legal entity, not an individual. A clearly-named entity simplifies the agreement execution and downstream banking, payments, and tax.

## 2. KYC / AML

**Platform off-ramp posture:** any user who wishes to convert platform earnings to fiat must complete KYC before the first withdrawal. The KYC provider will be selected from the standard shortlist (Sumsub, Persona, or equivalent) before the public alpha.

**Threshold:** KYC is required for any single withdrawal over $1,000 or cumulative withdrawals over $5,000 in any 30-day period. Below the threshold, account-level identity is collected but full document verification is not.

**Regulator:** for US users, FinCEN Money Services Business registration (or state money transmitter licensing, depending on the platform's exact product mix) is in scope. For EU users, MiCA registration once applicable.

**Recordkeeping:** all KYC records retained for at least five years from account closure, per FATF Recommendation 11.

## 3. Sanctions screening

Every user passes OFAC, EU, UK, and UN sanctions screening at signup and on every withdrawal. Sanctioned jurisdictions are blocked at the IP level via the WAF layer.

**Tooling:** the platform's KYC provider (above) ships with sanctions screening included. The platform does not maintain a separate list.

**Re-screening cadence:** every user is re-screened on each withdrawal event. Watchlist updates from the KYC provider are applied automatically.

## 4. Data protection

**Jurisdictions served at launch:** US, EU, UK. Other jurisdictions added as legal review clears them.

**US:** CCPA / CPRA. Privacy policy published at `aigarth.cloud/privacy`. Data Subject Access Request process documented in the policy.

**EU / UK:** GDPR. Lawful basis is contract (service delivery) and legitimate interest (security, fraud prevention). Data Protection Officer appointed before the public alpha. Standard Contractual Clauses in place for any non-EEA processor.

**Data residency:** user data is stored in the user's selected region. Default is US for US users, EU for EU users, with a region selector at signup. Cross-region data movement is opt-in only.

**Retention:** account data retained for the life of the account plus 30 days for account-closure grace, then 5 years for financial records.

## 5. Securities

**Aigarthpool review:** the aigarthpool is a QUBIC-denominated staking contract that distributes a share of platform usage fees to participants. Counsel will opine on the securities-law fit (US: Howey; EU: MiCA ART/EMT) before the staking contract is deployed to mainnet.

**Outcome options:**

- If counsel concludes the aigarthpool is **not** a security in the relevant jurisdictions, the staking contract ships as designed.
- If counsel concludes the aigarthpool **is** a security, the staking contract is gated to non-US persons, or restructured to remove the security characteristics, or registered (none of these are recommended for Year 1).

**What we will not do:** ship the staking contract to mainnet without the legal opinion. The opinion is a Milestone 3 deliverable per [`annex-milestone-detail.md`](./annex-milestone-detail.md).

## 6. Export controls

**Workload categories accepted at launch:** general-purpose AI inference and training workloads. The platform's acceptable use policy prohibits:

- Military, weapons, or dual-use systems design.
- Surveillance of individuals by state actors.
- Sanctioned-party access (covered by §3).
- Cryptographic anonymity tooling intended to defeat the platform's own KYC/AML controls.

**Tooling:** the acceptable use policy is enforced via a combination of user self-attestation at signup, content scanning on outputs, and a user reporting flow. The enforcement tooling is in scope for Milestone 2.

**Regulator:** US Department of Commerce (BIS), EU dual-use regulation 2021/821 where applicable. None of our planned workloads require an export licence at launch, but the legal review confirms this and is revisited annually.

## 7. Smart contract audit

**Auditor:** [TO BE FILLED — three candidates shortlisted: CertiK, Hacken, Quantstamp; final selection before Milestone 3 deploy]

**Coverage:** the aigarthpool staking contract is the only in-scope contract for this program. Qubic covers the cost of one audit per project per the program terms. If a re-audit is required after a contract change, Aigarth Cloud covers the cost.

**Timeline:** the audit completes before the contract is deployed to Qubic mainnet. Per the milestone plan, that is before the end of Milestone 3.

## 8. Open-source compliance

All code shipped under this program is released under the Apache License 2.0. The licence is in [`LICENSE`](./LICENSE). Every shipped service, the SDK, the aigarthpool contract, and the dashboard UI are under the same licence.

**No closed-source dependencies for full functionality:** the platform's core paths (auth, compute, billing, AI gateway, ANN registry, marketplace) function without any closed-source component. Optional third-party AI models hosted on the platform are user-contributed; the platform itself does not depend on them for full functionality.

## 9. Founder to fill in before submission

- [ ] **Entity name, jurisdiction, registration number, formation date** (§1)
- [ ] **KYC provider shortlist** (Sumsub, Persona, or other) (§2)
- [ ] **Auditor selection** with letter of intent (§7)
- [ ] **Securities counsel engagement** for the aigarthpool review (§5)
- [ ] **Privacy policy and DPA drafts** (§4) — link or "drafted, available on request"

## 10. Linked documents

- [`../proposal.md` §2 — Project Description](./proposal.md#2-project-description)
- [`../proposal.md` §3.6 — Security](./proposal.md#36-security)
- [`../annex-commitment.md`](./annex-commitment.md) — operational continuity
- [`../annex-milestone-detail.md`](./annex-milestone-detail.md) — when compliance deliverables ship
