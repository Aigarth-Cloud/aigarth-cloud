# Aigarth Cloud — Qubic Incubation Proposal

This repository is the public proposal submitted to the [Qubic Incubation Program](https://qubic.org/incubation-program). It is the canonical artifact that the public Discord vote reads and the Incubation Team reviews.

The file layout follows the structure recommended in the [Qubic proposal convention](https://github.com/qubic/proposal): one markdown file per required section, with annexes for the supporting detail.

## Read in this order

1. [`proposal.md`](./proposal.md) — executive summary and proposal index (read this first).
2. The six required sections, in the order the Incubation Program spec lists them:
   1. [`01-business-plan.md`](./01-business-plan.md) — Business Plan
   2. [`02-project-description.md`](./02-project-description.md) — Project Description
   3. [`03-technology-stack.md`](./03-technology-stack.md) — Technology Stack
   4. [`04-team-overview.md`](./04-team-overview.md) — Team Overview
   5. [`05-milestones.md`](./05-milestones.md) — Milestones
   6. [`06-commitment.md`](./06-commitment.md) — Commitment
3. The annexes, for the supporting detail the reviewers will check behind the section summaries:
   - [`annex-milestone-detail.md`](./annex-milestone-detail.md) — per-milestone QA acceptance criteria and explicit non-scope
   - [`annex-cash-flow.md`](./annex-cash-flow.md) — months 0–3 working capital plan (Qubic pays on delivery, not upfront)
   - [`annex-compliance.md`](./annex-compliance.md) — legal, KYC/AML, sanctions, data protection, securities, export controls
   - [`annex-commitment.md`](./annex-commitment.md) — named humans, twelve-month minimum, twenty-four-month public roadmap

## Why this layout

The Qubic Incubation Program requires six items from each team ([source](https://qubic.org/blog-detail/introducing-the-qubic-incubation-program)):

- Business Plan
- Project Description
- Technology Stack
- Team Overview
- Milestones
- Commitment

Splitting the proposal into one file per required item makes it easier for the Incubation Team, the Grants Committee, and the Discord community to read, quote, and link directly to the section they are commenting on. The annexes cover the material that supports a section but is too detailed for the section summary.

This mirrors the convention used in the [Qubic proposal repo](https://github.com/qubic/proposal) for CCF funding requests, where each proposal is a single markdown file with H1/H2 sections; here, each H1 section is a separate file, linked from the index.

## Repository structure

```
public-proposal/
├── README.md                          ← this file
├── LICENSE                            ← Apache 2.0
├── proposal.md                        ← executive summary + index
├── 01-business-plan.md                ← required section 1
├── 02-project-description.md          ← required section 2
├── 03-technology-stack.md             ← required section 3
├── 04-team-overview.md                ← required section 4
├── 05-milestones.md                   ← required section 5
├── 06-commitment.md                   ← required section 6
├── annex-milestone-detail.md          ← per-milestone QA + non-scope
├── annex-cash-flow.md                 ← months 0–3 working capital
├── annex-compliance.md                ← legal and compliance posture
└── annex-commitment.md                ← named humans, 24-month roadmap
```

## Licence

This proposal and all code shipped under the program are released under the [Apache License 2.0](./LICENSE).

## Contact

- Incubation email: `incubation@aigarth.cloud`
- Project lead: see [Team Overview](./04-team-overview.md)
