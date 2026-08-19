# Annex: Months 0–3 Working Capital Plan

**Purpose:** document how Aigarth Cloud will fund operations from program start through the end of Milestone 1, given that Qubic pays on delivery and there is no upfront payment.
**Scope:** months 0–3 of the program.

---

## 1. The cash-flow reality

Qubic's Incubation Program releases tranches only on milestone delivery and QA sign-off. For our program:

- **Tranche 1 (25B QUBIC):** released on QA sign-off of Milestone 1, end of month 3.
- **Tranche 2 (25B QUBIC):** end of month 6.
- **Tranche 3 (25B QUBIC):** end of month 9.
- **Tranche 4 (25B QUBIC):** end of month 12.

QUBIC amounts are USD-indexed at release. The USD value of each tranche depends on the QUBIC market price at the release date; we do not assume a particular price in this annex.

Months 0–3 are unfunded by the program. The team must cover the entire Milestone 1 burn from non-tranche capital.

## 2. The gap, in our own numbers

Per our internal Business Requirements Document, the indicative monthly operating cost is **~$248K** (see BRD §5). That puts the Milestone 1 burn at approximately:

| Item | Monthly | Months 0–3 total |
|---|---|---|
| Compute (cloud + Qubic node costs) | $40K | $120K |
| Engineering payroll (incl. AI agents) | $120K | $360K |
| Founders + operations | $30K | $90K |
| Legal + compliance | $15K | $45K |
| Marketing + community | $20K | $60K |
| Infrastructure (Postgres, Redis, CDN, observability) | $8K | $24K |
| Reserve / buffer | $15K | $45K |
| **Subtotal** | **$248K** | **$744K** |

These are placeholders from BRD §5. They will be firmed up before submission against actuals.

## 3. Funding options for the gap

Four options. We will pick a primary and a backstop before submitting.

### Option A — Founder capital (recommended baseline)

The founders cover the $744K gap from personal capital or pre-existing reserves. The simplest path, no external dependencies, no covenant overhead.

**Pros:** zero coordination cost. No new agreements. Keeps the program simple.
**Cons:** caps the founder's runway if the program slips past month 6.

### Option B — Pre-existing reserves

Aigarth Cloud's existing entity or affiliate holds cash reserves earmarked for the program. Same characteristics as A, just sourced from the company rather than the founders personally.

**Pros:** cleaner separation of personal and company cash.
**Cons:** requires an existing entity with reserves on hand.

### Option C — Working-capital facility

A line of credit, a SAFE note from an existing investor, or a convertible bridge from a friendly investor. The facility is repaid from Tranche 1 when it lands.

**Pros:** preserves founder liquidity. Standard structure.
**Cons:** adds a counterparty, legal work, and a small cost of capital.

### Option D — Reduced M1 scope

Cut the Milestone 1 deliverables to what is achievable on a smaller monthly burn, with the cut scope rolled into Milestone 2.

**Pros:** lowers the cash requirement.
**Cons:** delays the public alpha. Risks the milestone cadence. We do not recommend this unless A, B, and C are not viable.

## 4. Recommended posture

**Primary:** Option A (founder capital) sized to the BRD placeholder ($744K) with a 15% buffer to absorb scope growth, totalling **~$855K** of pre-tranche cash deployed in months 0–3.

**Backstop:** Option C (working-capital facility) sized to two months of burn (~$500K), drawable only if the primary source runs short. This is the only external agreement we will enter before program approval; we will not close it without confirmation from the Incubation Team that the structure is acceptable.

**What we will not do:**

- We will not commit to M1 deliverables that require cash we have not yet confirmed we can deploy.
- We will not take a token-sale structure (ICO, IDO, IEO, or pre-mine) to bridge the gap. The Qubic program explicitly disallows this.
- We will not solicit QUBIC-denominated loans from the community to bridge the gap.

## 5. Founder to fill in before submission

- [ ] **Confirm Option A source and size.** $855K pre-tranche cash, or actual figure.
- [ ] **Name the backstop facility (if any).** Lender, instrument, size, draw conditions.
- [ ] **Confirm the BRD monthly burn of $248K.** If actuals differ, update BRD §5 and this annex together.
- [ ] **Confirm the team is comfortable with the milestone cadence** given the gap and the bridge.

## 6. Tranche-handling policy

When each tranche is released, the cash is treated as restricted: dedicated to the next milestone's burn, not redirected to new initiatives or founder distributions. The CFO function (or its part-time equivalent in Year 1) tracks tranche cash separately from operating cash.

## 7. Linked documents

- [`../proposal.md` §1.3 — Capital Formation](./proposal.md#13-capital-formation)
- [`../proposal.md` §5 — Milestones](./proposal.md#5-milestones)
- [`../../BRD.md` §5 — Operating costs](../../BRD.md) (internal)
- [`../annex-milestone-detail.md`](./annex-milestone-detail.md) — the deliverables each tranche pays for
