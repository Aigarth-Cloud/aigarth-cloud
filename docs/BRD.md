# Business Requirements Document

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Founders / Business
**Last updated:** 2026-07-27
**Source docs:** [`ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md), [`PRD.md`](./PRD.md)

---

## 1. Mission

Transform Qubic's technological capabilities into a globally accessible AI infrastructure ecosystem, increasing practical demand for QUBIC by connecting token utility to productive infrastructure.

## 2. Business model

Aigarth Cloud generates sustainable commercial activity across **seven revenue streams**:

| # | Stream | Model | Year 1 target |
|---|---|---|---|
| 1 | AI API subscriptions | Per-token / per-call metering | 70% of revenue |
| 2 | Enterprise plans | Annual contracts, custom | 15% of revenue |
| 3 | ANN marketplace fees | 10% of license/subscription revenue | 8% of revenue |
| 4 | Compute marketplace fees | 5–15% of transaction value | 4% of revenue |
| 5 | Managed AI infrastructure | Monthly retainer | 2% of revenue |
| 6 | Hardware ecosystem sales | One-time + subscription | 1% of revenue |
| 7 | Developer services | Training, certification, support | < 1% of revenue |

Revenue composition will shift over time as the marketplace flywheel matures (more ANNs → more usage → more marketplace activity → more staker yield → more staking → more capacity → more usage).

## 3. Capital formation

### 3.1 Incubation request

Per `ENDGAME-PROTO-PROPOSAL.md`:

- **Total request:** 100B QUBIC equivalent
- **Structure:** 4 milestone-gated tranches of 25B QUBIC each
- **Tranche gating:** Acceptance criteria for each milestone must be met before next release

### 3.2 Milestone-based tranches

| Tranche | Months | Deliverables (high-level) | Success metric |
|---|---|---|---|
| M1 | 1–3 | Production deployment, auth, Qubic wallet, dev dashboard, API keys, ANN registry, docs, simulator | Public alpha, 1,000 users, 100 devs |
| M2 | 3–6 | AI gateway, OpenAI-compatible APIs, usage tracking, scheduler, ANN deploy | 10 ANNs, 100 API users |
| M3 | 6–9 | ANN marketplace, compute marketplace, creator profiles, licensing, revenue dashboards, staking | 50 ANNs, 500 marketplace users |
| M4 | 9–12 | Enterprise platform, node operator system, SDKs, hardware roadmap, partnerships | 10 enterprise pilots, 1,000 devs, revenue begins |

## 4. Unit economics (illustrative)

To be confirmed with real data once production is live. All values are placeholders.

- **Inference margin:** ~70% gross margin after Qubic settlement + compute
- **Average developer LTV:** $480 / year (Builder plan, 1 year retention)
- **Average enterprise LTV:** $58K / year (Business plan, 3 year retention)
- **CAC ceiling:** 25% of LTV
- **Payback period:** 9 months for developers, 14 months for enterprise

## 5. Operating costs (Year 1 estimate)

| Category | Monthly estimate |
|---|---|
| Compute (cloud + Qubic) | $40K |
| Engineering payroll (incl. AI agents) | $120K |
| Founders + operations | $30K |
| Legal + compliance | $15K |
| Marketing + community | $20K |
| Infrastructure (Postgres, Redis, CDN, observability) | $8K |
| Reserve / buffer | $15K |
| **Total monthly** | **~$248K** |

Year 1 total cash burn: **~$3M** (before any revenue offset).

## 6. Customer acquisition

### 6.1 Developer acquisition (Year 1)

- **Organic:** documentation discoverability, blog content, conference talks
- **Community:** Discord, GitHub, dev.to, HackerNews
- **Partnerships:** framework integrations (Next.js, FastAPI, LangChain)
- **Hackathons:** 1 sponsored per quarter, $50K total budget

### 6.2 Enterprise acquisition (Year 1)

- **Outbound sales:** 1 sales hire in M3, 2 by end of Year 1
- **Inbound:** enterprise landing page, case studies, whitepaper
- **Partners:** system integrators, consulting partners, cloud marketplaces
- **Direct:** founder-led relationships in regulated industries (healthcare, finance, government)

## 7. Competitive positioning

| Competitor | What we take | What we keep |
|---|---|---|
| AWS / GCP / Azure | Predictable economics, OpenAI compat | We don't compete on hyperscaler features |
| OpenAI | Cost, openness, ANN ownership | We don't compete on frontier model capability |
| Hugging Face | ANN marketplace, integrated compute | We don't compete on model hub breadth (yet) |
| Together / Anyscale | OpenAI compatibility, cost | We don't compete on OSS-only positioning |
| Render / Fly | AI-specific tooling, Qubic integration | We don't compete on general compute |

## 8. Risks (top of register)

Full register in [`RISK-REGISTER.md`](./RISK-REGISTER.md). Top three:

1. **Qubic dependency.** Aigarth's value proposition is coupled to Qubic's continued success. Mitigation: design for portability from day one (typed bindings, no on-chain logic in Aigarth services), but commit to Qubic as primary anchor.
2. **Funding tranches at risk.** Acceptance criteria for milestones are subjective. Mitigation: define measurable, externally auditable criteria in writing before signing.
3. **Talent competition.** Competing for senior AI and infra engineers is hard. Mitigation: lean on AI agents for repeatable work, hire for product and design leadership first.

## 9. Linked documents

- [`PRD.md`](./PRD.md)
- [`ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md)
- [`ROADMAP.md`](../../../ROADMAP.md)
- [`SPRINT-PLAN.md`](./SPRINT-PLAN.md)
- [`RISK-REGISTER.md`](./RISK-REGISTER.md)
