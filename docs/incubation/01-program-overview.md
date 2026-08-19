# Program Overview — Qubic Incubation Program

**Purpose:** explain what the Qubic Incubation Program is, how the money and approval flow, and what happens after a yes.
**Source of truth:** [qubic.org/incubation-program](https://qubic.org/incubation-program) and [Introducing the Qubic Incubation Program](https://qubic.org/blog-detail/introducing-the-qubic-incubation-program).

---

## 1. Two programs, one form

Qubic runs two parallel funding programs from a single application surface at `qubic.org/apply`:

| Dimension | Incubation Program | Grants Program |
|---|---|---|
| Targets | Profit-seeking apps (DEX, launchpads, bridges, AI infrastructure) | Non-profit, open-source infrastructure (liquidity pools, name service, dev tools) |
| Treasury | 200B QUBIC reserved by the 2026 governance framework | Scalable grant budget in QUBIC |
| Payment style | Initial advance + milestone supplements (indexed to USD) | Four equal tranches of 25% each |
| Selection | Incubation Team → Grants Committee → **Discord vote (55% yes)** | Batch review by the Grant team |
| Legal posture | Revenue and IP retained by project | Mandatory open-source code, no token sales |
| Ideal for | Startups aiming for product-market fit and revenue | Teams building shared tools for everyone |

**We are applying to the Incubation Program.** Aigarth Cloud is a profit-seeking commercial product (AI cloud subscriptions, enterprise contracts, marketplace fees), and the funding request is in the same range as other incubation projects (100B QUBIC, four tranche-equivalent milestones). The Grants Program would also accept us but the open-source / no-token-sale posture is a worse fit since the ANN marketplace and aigarthpool involve commercial licensing and QUBIC-denominated fees.

## 2. Approval flow

The Incubation Program runs a three-phase review before any money moves:

### Phase 1 — Adaptation to Qubic's needs (Incubation Team)

The Incubation Team evaluates whether the project aligns with Qubic's network objectives and provides most ecosystem value. They are looking for: clear use of Qubic's UPoW + ANN capabilities, demonstrable demand from a real user segment, and a credible path to increasing QUBIC utility.

**What they read first:** Project Description, Problem statement, QUBIC Integration section. If those do not establish fit, they bounce the proposal before reading further.

### Phase 2 — Functional validation and design (Incubation Team + Grants Committee)

A high-level design review. The Committee checks:

- Is the proposed architecture feasible on Qubic's actual primitives (UPoW, ANNs, smart contracts, QX)?
- Is the business model sound and is the team capable of executing it?
- Are the milestones concrete and testable?

**What they read:** Technology Stack, Milestones, Team Overview, Business Plan. The Committee will poke holes in the design and the budget here. Vague budget items get cut.

### Phase 3 — Market cost adjustment and for-profit orientation (Incubation Team)

The costs of the initial development phases are negotiated. The Incubation Team confirms the funding amount and the tranche structure.

### Phase 4 — Public Discord vote

After the internal review, the proposal is posted to a Discord poll in the dedicated incubation channel. Voting is open for **five days**. The project receives funding if **at least 55% of voters approve**. This is the community veto.

**What this means for us:** the Discord community will read the public GitHub proposal. Write it as if the audience is a Qubic holder voting with their wallet on whether the treasury should fund it. No marketing fluff, no vague claims.

## 3. Timeline expectations

- **Submission to internal decision:** 1–2 weeks.
- **Discord vote window:** 5 days, separate from internal review.
- **Total time to first payment after approval:** depends on Milestone 1 (currently scoped at months 1–3 per `ENDGAME-PROTO-PROPOSAL.md`).
- **Total program horizon:** four milestones over approximately 12 months.

## 4. Payment mechanics

- **No upfront payment.** Qubic pays on delivery.
- Initial advance: tied to Milestone 1 completion.
- Subsequent supplements: per tranche, each released on QA sign-off of the prior milestone.
- **USD-indexed:** amounts are denominated in QUBIC but valued against USD at each release to insulate both sides from token volatility.
- **QA is mandatory:** every milestone triggers a Qubic-led QA review. Testable deliverables from a user perspective (docs, mockups, features, deployed services) are what unlock payment.

## 5. Post-approval — what you get

- A dedicated **Discord channel** for the project.
- A **project manager** as your point of contact for milestone coordination.
- **Audit support** for smart contract work — Qubic covers one audit per project. If we need more, we pay.
- **Mainnet support** for smart contract deployment.
- An **AMA** organized by Qubic for community engagement.

## 6. Decision posture for Aigarth Cloud

- The proto-proposal requests 100B QUBIC across four 25B tranches. This is consistent with the program's posture (initial advance + milestone supplements) and well under the 200B treasury.
- Milestones are scoped to deliverable-from-a-user-perspective, per Qubic's stated requirement. The `ENDGAME-PROTO-PROPOSAL.md` tranche table already names user-perspective success metrics (1,000 users, 100 devs, 10 ANNs, etc.) — these are testable, not vanity.
- We are not requesting a token sale. We are requesting milestone-gated QUBIC disbursements. The aigarthpool is a separate staking-and-rewards smart contract funded by the platform, not by the treasury.
- The QUBIC integration story (compute access via staking, ANN monetisation in QUBIC, node operator rewards) is concrete and aligns with the Incubation Team's "increase QUBIC utility" criterion.
