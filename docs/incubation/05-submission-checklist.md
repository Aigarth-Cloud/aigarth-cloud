# Submission Checklist

**Purpose:** the working document the team runs the Qubic Incubation prep against. Each row is one piece of work. Tick when shipped, link to the artifact.
**Last updated:** 2026-08-09 (post-draft pass)
**Status legend:** `[ ]` not started · `[~]` drafted, pending review · `[x]` done · `[!]` blocked · `[?]` founder decision needed

---

## 1. Public proposal repository

- [?] **Decide on a licence.** Recommendation: Apache 2.0. Drafted at `docs/incubation/public-proposal/LICENSE`. Founder to confirm.
- [ ] **Create a public GitHub repo** for the submission. Owner: CTO. Recommended path: `aigarth-cloud/qubic-incubation-proposal`.
- [~] **Add `LICENSE`** at the repo root with the chosen licence. Drafted, not yet pushed to a public repo.
- [~] **Add `README.md`** linking to the proposal, the team, and the supporting docs. Drafted at `docs/incubation/public-proposal/README.md`.
- [~] **Add the main proposal.** Six required sections, executive summary, three Mermaid diagrams, closing. Drafted at `docs/incubation/public-proposal/proposal.md` (~700 lines).
- [~] **Add the milestone detail annex.** Per-milestone QA acceptance criteria and explicit non-scope. Drafted at `docs/incubation/public-proposal/annex-milestone-detail.md`.
- [~] **Add the cash-flow annex.** Months 0–3 working capital plan with founder fill-in section. Drafted at `docs/incubation/public-proposal/annex-cash-flow.md`.
- [~] **Add the compliance annex.** Entity, KYC/AML, sanctions, data protection, securities, export, audit. Drafted at `docs/incubation/public-proposal/annex-compliance.md`.
- [~] **Add the commitment annex.** Named humans, twelve-month minimum, twenty-four-month public roadmap, hand-off plan. Drafted at `docs/incubation/public-proposal/annex-commitment.md`.
- [~] **Three diagrams are inline in the proposal.** Service map, OpenAI-compatible request flow, QUBIC settlement + staking flow. Mermaid, renders natively on github.com. No separate file needed.
- [x] **"What Aigarth Cloud is not" paragraph.** Included in `proposal.md` §2.2. Six explicit negations.
- [~] **Per-milestone QA acceptance criteria.** Drafted in `annex-milestone-detail.md`, one table per milestone. Founder to review and confirm each criterion is verifiable on their side.
- [~] **Non-scope per milestone.** Drafted in `annex-milestone-detail.md`. Founder to confirm no important deliverable is missing from M1–M4.
- [ ] **Curate a public subset of `../deliveries/`** and link from the proposal. Owner: Head of Engineering. Founder to identify which delivery phases are safe to expose publicly.
- [ ] **Final read-through** by founder for plain English, no vague adjectives. Owner: Founder.
- [ ] **Push the public repo** to `aigarth-cloud/qubic-incubation-proposal` and confirm all links resolve without login.

## 2. Application form fields

Final values are in [`02-application-form-fields.md` §0](./02-application-form-fields.md#0-final-values-to-paste-into-the-form).

- [x] **Project Name** = `Aigarth Cloud` (locked, paste-ready)
- [ ] **Github Proposal Link** = public repo URL above. Blocked on repo creation.
- [ ] **Contact Email** = `incubation@aigarth.cloud`. Set up the inbox, test deliverability, add auto-forwarding to the founder and ops lead.
- [ ] **Link to Past Projects** = public deliveries URL. Blocked on the public subset of `../deliveries/`.
- [?] **Team Info (e.g. LinkedIn)** = 2–4 LinkedIn URLs of founder(s) + CTO. Founder to supply.
- [x] **Funding Request** = `100,000,000,000 QUBIC (25B / 25B / 25B / 25B across four milestones over 12 months, USD-indexed at release)` (locked, paste-ready)
- [x] **Short Description** = final version in `02-application-form-fields.md` §7 (locked, paste-ready)

## 3. Founder decisions before submission

These are not technical tasks. They are decisions the founder has to make. Each is called out in the relevant annex with a "Founder to fill in" section.

- [?] **Entity name, jurisdiction, registration number, formation date** for the legal entity. See `annex-compliance.md` §1 and §9.
- [?] **Licence confirmation.** Apache 2.0 recommended, alternatives are GPLv3, MIT, or Unlicense.
- [?] **M1 cash-flow source and size.** Recommended $855K founder capital + $500K working-capital backstop. See `annex-cash-flow.md` §4 and §5.
- [?] **Auditor selection.** Three candidates shortlisted: CertiK, Hacken, Quantstamp. Letter of intent needed before submission. See `annex-compliance.md` §7.
- [?] **Securities counsel engagement** for the aigarthpool review. See `annex-compliance.md` §5.
- [?] **KYC provider shortlist** (Sumsub, Persona, or equivalent). See `annex-compliance.md` §2.
- [?] **Privacy policy and DPA drafts.** Can be "drafted, available on request" at submission time. See `annex-compliance.md` §4.
- [?] **Founder + lead names** for the team section, with LinkedIn URLs. See `proposal.md` §4.1 and `annex-commitment.md` §1.
- [?] **M1 hire status.** Have any of the Q1 hires been made? Update `annex-commitment.md` §1 accordingly.

## 4. Internal alignment before submission

- [ ] **Walkthrough with the full team.** Founder, CTO, Head of Product, Head of Engineering. One hour. Goal: every lead can defend the proposal's claims about their area.
- [ ] **Discord presence check.** Founder and at least one other lead have working Discord accounts in the Qubic server before the proposal goes live.
- [ ] **Pre-submission community scan.** Read the last 30 days of `#incubation` in the Qubic Discord. Note the questions that come up, the objections, the patterns. Adjust the proposal to anticipate them.
- [ ] **Smart contract auditor identified.** One name, willing to take the engagement on Qubic's terms. See `annex-compliance.md` §7.
- [ ] **Entity status confirmed.** If a legal entity exists, it is named in the proposal. If not, the plan to form one is named. See `annex-compliance.md` §1.

## 5. Post-submission

- [ ] **Discord vote monitoring.** 5-day window. Founder and CTO both present in the channel daily. Respond to every substantive question within 24 hours.
- [ ] **Incubation Team follow-ups.** Reply within one business day during the 1–2 week internal review.
- [ ] **Project manager kickoff.** Once approved, the assigned project manager gets: the public proposal, the per-milestone QA acceptance criteria, the cash-flow plan, the auditor name, and the contact email distribution list.
- [ ] **Milestone 1 readiness check.** Confirm the M1 deliverables are scoped, resourced, and the team is committed to delivery on the agreed dates before accepting tranche 1.

## 6. Risk register for the submission

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Public repo leaks internal data | Medium | High | Curate carefully. Strip customer data, contract code, infra state. Use a new repo, not the existing private one. |
| Discord vote fails (below 55%) | Low–Medium | High | Spend 1–2 weeks in `#incubation` before submission. Pre-answer the hard questions in the proposal. |
| Incubation Team cuts the budget | Medium | Medium | Have a 75B and a 50B fallback tranche structure ready. Know which milestones you would cut. |
| Milestone 1 slips | Medium | High | Confirm cash-flow runway for at least 6 months regardless of tranche timing. Milestone 1 is the make-or-break. |
| Qubic primitives (UPoW, ANNs, QX) change during the program | Low | Medium | Architect for portability. Document the assumption set in `../ARCHITECTURE.md`. |
| Token-sale rule is read more strictly than expected | Low | High | Frame the aigarthpool as a staking-rewards contract, not a token offering. Get pre-clearance from the project manager if uncertain. |
| Auditor letter of intent arrives late | Medium | Medium | Engage the three candidates now. The auditor is not blocking submission, but a signed letter of intent before the form goes in raises the proposal's credibility. |
| Licence is challenged by a downstream consumer | Low | Low | Apache 2.0 is the most permissive of the four allowed options. If we are challenged, switching to MIT is a one-line change. |

## 7. Submission sequence (the day-of)

1. Open the public proposal repo in one tab. Confirm every link resolves, every diagram renders, the licence file is present.
2. Open the form at `qubic.org/incubation-program` in a second tab.
3. Fill the seven fields. Copy-paste the short description last, after a final read.
4. Submit. Capture a screenshot of the confirmation screen.
5. Post a short announcement in the Qubic Discord `#incubation` channel linking to the public proposal. Founder voice, plain English, no marketing fluff. One paragraph.
6. Set a calendar reminder for the 1–2 week evaluation window. Add a 24-hour response SLA on the contact email inbox.

## 8. Linked documents

### Internal prep pack

- [`00-README.md`](./00-README.md) — index and orientation
- [`01-program-overview.md`](./01-program-overview.md) — program structure and flow
- [`02-application-form-fields.md`](./02-application-form-fields.md) — the seven form fields with final values
- [`03-detailed-proposal-requirements.md`](./03-detailed-proposal-requirements.md) — the six required team inputs
- [`04-compliance-and-eligibility.md`](./04-compliance-and-eligibility.md) — restrictions, open source, no token sale

### Public submission packet (paste into `aigarth-cloud/qubic-incubation-proposal`)

The proposal is organised as one markdown file per required section, with annexes for supporting detail. This follows the [Qubic proposal convention](https://github.com/qubic/proposal) and makes the six required items easy to read, quote, and link.

- [`public-proposal/README.md`](./public-proposal/README.md) — public repo readme
- [`public-proposal/LICENSE`](./public-proposal/LICENSE) — Apache 2.0
- [`public-proposal/proposal.md`](./public-proposal/proposal.md) — executive summary and proposal index
- [`public-proposal/01-business-plan.md`](./public-proposal/01-business-plan.md) — required section 1: Business Plan
- [`public-proposal/02-project-description.md`](./public-proposal/02-project-description.md) — required section 2: Project Description
- [`public-proposal/03-technology-stack.md`](./public-proposal/03-technology-stack.md) — required section 3: Technology Stack
- [`public-proposal/04-team-overview.md`](./public-proposal/04-team-overview.md) — required section 4: Team Overview
- [`public-proposal/05-milestones.md`](./public-proposal/05-milestones.md) — required section 5: Milestones
- [`public-proposal/06-commitment.md`](./public-proposal/06-commitment.md) — required section 6: Commitment
- [`public-proposal/annex-milestone-detail.md`](./public-proposal/annex-milestone-detail.md) — per-milestone QA + non-scope
- [`public-proposal/annex-cash-flow.md`](./public-proposal/annex-cash-flow.md) — months 0–3 working capital plan
- [`public-proposal/annex-compliance.md`](./public-proposal/annex-compliance.md) — legal and compliance posture
- [`public-proposal/annex-commitment.md`](./public-proposal/annex-commitment.md) — twelve-month commitment, twenty-four-month roadmap

### Source-of-truth Aigarth Cloud docs

- [`../ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md) — the proto-proposal, source for the public version
- [`../BRD.md`](../BRD.md) — business model, milestone tranche table
- [`../TEAM-AND-ROLES.md`](../TEAM-AND-ROLES.md) — team content
- [`../TECH-STACK.md`](../TECH-STACK.md) and [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — technology stack content
- [`../RISK-REGISTER.md`](../RISK-REGISTER.md) — top-of-register risks
