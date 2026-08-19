# Risk Register

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Founders
**Last updated:** 2026-07-27
**Source docs:** [`PRD.md`](./PRD.md), [`BRD.md`](./BRD.md), [`SPRINT-PLAN.md`](./SPRINT-PLAN.md)

---

## 1. Scoring

Each risk is scored on **likelihood** (1–5) and **impact** (1–5). Score = `likelihood × impact`. Max = 25.

| Score band | Treatment |
|---|---|
| 1–6 | Monitor, no mitigation needed |
| 7–12 | Track, mitigations in plan |
| 13–19 | Active mitigation, weekly review |
| 20–25 | Stop-the-line risk, daily review |

## 2. Top risks (sorted by score)

| # | Risk | Likelihood | Impact | Score | Owner | Mitigation |
|---|---|---|---|---|---|---|
| 1 | Qubic mainnet doesn't support our staking flow on time | 3 | 5 | 15 | Qubic lead | Build to testnet first, ship shadow mode against mainnet, gradual rollout with mainnet caps |
| 2 | Milestone acceptance criteria are subjective, leading to tranche delays | 4 | 4 | 16 | Founders | Define measurable, externally-auditable criteria in writing before signing. Self-validate. |
| 3 | Talent competition makes it hard to hire senior engineers | 4 | 4 | 16 | Founders | Lean on AI agents; hire for product/design leadership first; remote-friendly |
| 4 | A front-runner (OpenAI, Anthropic, Together) ships a "decentralized" tier that commoditizes our pitch | 3 | 4 | 12 | Founders | Differentiate on Qubic-native stake-to-compute, not "decentralized" branding |
| 5 | Smart contract bug drains the stake pool | 2 | 5 | 10 | Security | Minimal on-chain logic; external audits; multi-sig; gradual mainnet caps |
| 6 | Inference exfiltration via crafted prompts | 3 | 4 | 12 | Security | Rate limits, prompt classification, output filtering, signed receipts |
| 7 | Operator fraud: under-reporting usage to keep more rewards | 3 | 4 | 12 | Core lead | Independent verification; slashing on detected fraud; sampling-based audit |
| 8 | Enterprise procurement cycles slip due to compliance gaps | 3 | 4 | 12 | Enterprise | SOC 2 + ISO 27001 by M3; HIPAA available Y1; FedRAMP roadmap |
| 9 | Qubic token volatility makes staking economics unstable | 4 | 3 | 12 | Tokenomics | Stake value is in QUBIC but billed in USD; settle in stablecoin; treasury hedging |
| 10 | Customer concentration: a few large customers leaving breaks unit economics | 2 | 4 | 8 | Sales | Multi-tenant by default; per-tenant cost caps; avoid deep bespoke work for any one customer |
| 11 | Qubic network outage cascades into Aigarth outage | 2 | 4 | 8 | Infra | Read-replica of Qubic data; degrade gracefully; status page |
| 12 | Brand confusion with qubic.org if our naming overlaps | 3 | 2 | 6 | Brand | "Aigarth" is clearly separate; co-branded "Powered by Qubic" always; legal review |
| 13 | Data residency violation in EU | 2 | 4 | 8 | Compliance | Per-tenant region pinning; quarterly audit; data deletion SLA |
| 14 | SDK breaking change disrupts downstream apps | 3 | 3 | 9 | DevRel | Strict SemVer; 6-month deprecation window; LTS branches |
| 15 | Front-end mock data leaks into production demo | 3 | 3 | 9 | Engineering | Environment-aware data layer; mock data only loaded in `APP_ENV=dev`; e2e tests against staging |
| 16 | OSS dependency with a critical CVE ships | 3 | 3 | 9 | Security | Renovate + auto-PR; npm audit on every PR; pinned versions; vendor fallback for critical deps |
| 17 | A high-profile ANN creator's model produces harmful output | 3 | 4 | 12 | Trust & Safety | Content moderation; takedown process; creator reputation system; reporting |
| 18 | Marketing claims (e.g. "verified on mainnet at 15.5M TPS") invite scrutiny | 2 | 3 | 6 | Marketing | Cite primary sources; clear "as of date X" caveats; legal review before publication |
| 19 | Customer churn in Year 1 is higher than projected | 3 | 4 | 12 | Customer Success | Quarterly business reviews; usage alerts; save-the-customer playbook |
| 20 | ANN marketplace quality concerns (low-quality, inaccurate models) | 3 | 3 | 9 | Trust & Safety | Reputation system; mandatory benchmarks; verified creators; community flagging |

## 3. Risks by category

### 3.1 Technical (5)
- Qubic mainnet timing (#1)
- Smart contract bug (#5)
- Inference exfiltration (#6)
- Operator fraud (#7)
- Qubic network outage (#11)
- OSS CVE (#16)

### 3.2 Market & competition (3)
- Front-runner decentralization (#4)
- Customer concentration (#10)
- Qubic token volatility (#9)

### 3.3 Compliance & legal (3)
- Enterprise compliance gaps (#8)
- Data residency (#13)
- Brand confusion (#12)

### 3.4 People (1)
- Talent hiring (#3)

### 3.5 Funding (1)
- Tranche delays (#2)

### 3.6 Product (4)
- SDK breaking change (#14)
- Mock data leakage (#15)
- High-profile ANN safety (#17)
- Marketing scrutiny (#18)
- Marketplace quality (#20)
- Customer churn (#19)

## 4. Active mitigations (underway)

- **#1 Qubic mainnet:** Testnet deploys in Sprint 3. Shadow-mode against mainnet from Sprint 5.
- **#2 Tranche delays:** Measurable milestone criteria written into the funding agreement.
- **#3 Talent:** Remote-friendly hiring; AI agents do repeatable work.
- **#8 Compliance:** SOC 2 Type II audit firm selected (target: end of M3).

## 5. Risk review cadence

- **Weekly:** Top 10 risks reviewed in the Monday team sync
- **Monthly:** Full register reviewed; new risks added; old risks closed
- **Quarterly:** Top risks re-scored against actual outcomes

## 6. Escalation

- Score 13+ risks → notify founders within 24h of any change
- Score 20+ risks → daily standup until risk drops below 15

## 7. Linked documents

- [`PRD.md`](./PRD.md)
- [`BRD.md`](./BRD.md)
- [`SPRINT-PLAN.md`](./SPRINT-PLAN.md)
- [`SECURITY.md`](./SECURITY.md)
