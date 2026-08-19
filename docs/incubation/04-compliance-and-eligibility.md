# Compliance, Eligibility, and Restrictions

**Purpose:** enumerate the hard rules that gate the Qubic Incubation Program. These are non-negotiable. Any of them in the "no" column is a rejection.
**Sources:** [Qubic Incubation Program](https://qubic.org/incubation-program), [Qubic Grants GitHub repo](https://github.com/qubic/grants), [Qubic Governance Framework 2026](https://qubic.org/blog-detail/qubic-governance-framework-2026-all-hands-recap).

---

## 1. The hard "no"s

| # | Rule | What it means for Aigarth Cloud | Verdict |
|---|---|---|---|
| 1 | **No token sales** | The 100B QUBIC ask is a milestone-gated grant disbursement, not a token offering. The aigarthpool is a QUBIC-denominated staking and rewards contract funded by platform usage, not by the treasury. | OK — no token sale |
| 2 | **No upfront payment** | Tranche 1 is released on completion of Milestone 1 deliverables, not on signing. Plan working capital for months 1–3. | OK — but a real cash-flow constraint; see §4 |
| 3 | **All code must be open source** | Every line we ship on Qubic must be under Apache 2.0, GPLv3, MIT, or Unlicense. No closed-source dependencies for full functionality. | OK — confirm before submission, see §2 |
| 4 | **No projects that encourage criminal activity** | Standard. | OK — non-controversial |
| 5 | **Adhere to all relevant laws and regulations** | Export controls, sanctions, KYC/AML for the platform's fiat off-ramps, GDPR for EU users, securities law if any aigarthpool instrument is structured wrong. | OK — flag with legal before submission, see §5 |
| 6 | **Anti Military Licence compliance** (Grants Program spec; Incubation inherits) | We do not ship dual-use military AI. | OK — Aigarth Cloud is civilian infrastructure |
| 7 | **One-year minimum commitment** | At least one named human must be committed for 12 months of maintenance and delivery. | OK — see Commitment section in `03-detailed-proposal-requirements.md` |

## 2. Open-source posture

Per Qubic's spec, "All produced code must be open-source and should not rely on closed-source software for full functionality. Preferred licenses include Apache 2.0, GPLv3, MIT, or Unlicense."

**What we need to verify before submission:**

- The public proposal repo's licence is one of the four preferred. **Decision needed:** we have not yet picked. Apache 2.0 is the safest default for a commercial product that wants patent grant protection and permissive reuse.
- Every shipped Qubic service and the aigarthpool contract are under the chosen licence.
- No dependency we rely on for full functionality is closed-source. AI models hosted on the platform are user-contributed; that is fine — the platform itself must be open.
- A `LICENSE` file is at the top of the public proposal repo.

**Note on the SDK and the dashboard:** the SDK is shipped under the chosen licence, but the `apps/web` and `apps/dashboard` Next.js code is also under the same licence. This is fine for the program but means we cannot offer a "premium closed-source" version of the same UI later. If a commercial product branch is planned, fork at the licence boundary (open-core model is allowed; the closed-source parts must be a separate product, not a downgrade of the open one).

## 3. No token sale — narrow exceptions

The Grants spec says: "There will be exceptions, such as token swaps with other communities that benefit the interoperability and use of Qubic's technology, and some other specific cases."

**For Aigarth Cloud:**

- The aigarthpool issues rewards denominated in QUBIC. This is not a token sale — it is a staking contract distributing platform revenue to participants. The contract is open source, the rewards come from platform usage fees, and there is no fundraising event. This is within the rule.
- If a future partnership with another chain involves a token swap (e.g., a wQUBIC listing on a partner DEX), the swap would fall under the "cross-chain interoperability" exception. Flag any such partnership in the proposal so Qubic can pre-approve the framing.

## 4. Milestone-based payment — cash-flow planning

Qubic pays on delivery. No upfront payment under any circumstances. This is a real constraint, not paperwork:

- **Month 0 → Month 3:** zero QUBIC inflow, full team cost. Plan to cover from founder capital, prior cash, or a separate working-capital facility.
- **Month 3 (post-M1 QA):** first tranche released. USD-indexed at release.
- **Month 6, 9, 12:** subsequent tranches on QA pass.

**Implication for the proposal:** the Milestones section should not promise anything that requires cash we do not have before the first tranche. Specifically:

- All hires planned for M1 should be costed against founder capital or a pre-existing facility. Do not rely on tranche 1 to fund the team that delivers tranche 1.
- Infrastructure spend (cloud, Qubic nodes, observability) for M1 must be affordable on pre-tranche cash.

If we cannot self-fund M1, the funding request should be restructured: either reduce the M1 scope, raise the first tranche, or add a working-capital line to the budget. This is a negotiation point with the Incubation Team in Phase 1 (Adaptation).

## 5. Legal and compliance posture

The proposal should make Qubic's compliance team comfortable. Cover:

- **Entity structure:** a legal entity is not strictly required for an Incubation Program submission, but having one (LLC, C-Corp, or equivalent in the founder's jurisdiction) reduces the compliance friction. If no entity exists yet, state when one will be formed.
- **KYC/AML:** the platform will need KYC for fiat off-ramps. State the plan (sumsub, Persona, or in-house) and the regulator (US: FinCEN MSB or state money transmitter; EU: MiCA registration once applicable).
- **Sanctions:** OFAC and EU sanctions screening for all users before any reward claim.
- **Data protection:** GDPR for EU users, CCPA for California users, equivalent for the markets we serve. State the data residency posture (US, EU, both).
- **Securities:** the aigarthpool rewards contract and any QUBIC-denominated yield product must be analysed by counsel for securities-law fit. Qubic is not going to take on our legal risk; they are going to ask whether we have.
- **Export controls:** the platform's compute services may be subject to US export controls if any workload is in a controlled category. Standard posture: no military, no dual-use, no restricted-party access.

The Qubic program page does not require a legal opinion in the proposal, but it does require "ensure that your proposal adheres to all relevant laws and regulations." A one-page compliance annex that covers the bullets above satisfies the rule and signals seriousness.

## 6. Multiple grants — not a problem for us

Qubic allows a team to apply for several grants. "Outline how you plan to manage multiple projects and ensure quality across all of them."

Aigarth Cloud is a single program. The aigarthpool contract is part of the same project, not a separate grant. If we later apply for a Qubic grant for a separate piece of work (e.g., a developer tool, a QX extension), the Incubation Program project manager is the right first contact to confirm there is no overlap or conflict.

## 7. Audit cost share

"If your project includes SC development, Qubic will cover audit costs (1 per project; if more are required the project team assumes the costs)."

- The aigarthpool contract is the only smart contract in scope for this program. It is auditable.
- One audit is included in the program. Budget for one self-funded re-audit if we change the contract post-launch.
- Pick the auditor before submission, name them in the proposal, and confirm they are willing to take the engagement on Qubic's terms. Common choices for Qubic-adjacent code: CertiK, Hacken, Quantstamp, or a Qubic-recommended boutique.

## 8. Communication and conduct

Not stated explicitly on the program page, but inferred from the Discord-vote structure:

- Public Discord activity is the community's main signal. Be present, respond to questions, do not be defensive.
- Avoid public disputes with the Incubation Team or the Grants Committee. If there is a disagreement, take it to the project manager in DMs.
- The community will ask hard questions about the budget, the team's ability to deliver, and the project's long-term viability. The proposal must answer these in writing so the answers can be linked in Discord rather than re-typed each time.

## 9. Quick compliance checklist before submit

- [ ] Public proposal repo's `LICENSE` file uses Apache 2.0, GPLv3, MIT, or Unlicense
- [ ] No token sale, swap, or fundraising event in the proposal
- [ ] All Milestone 1 costs are fundable from pre-tranche cash
- [ ] Smart contract auditor identified and willing to take the engagement
- [ ] One-page compliance annex covers entity, KYC/AML, sanctions, data protection, securities, export controls
- [ ] No claim in the proposal relies on closed-source software for full functionality
- [ ] One-year commitment is named with at least one full-time human lead
- [ ] All numbers in the proposal trace to `BRD.md`, `ENDGAME-PROTO-PROPOSAL.md`, or another in-repo source
