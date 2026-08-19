# Team and Roles

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Founders
**Last updated:** 2026-07-27

---

## 1. Founding team

| Role | Name (placeholder) | Responsibilities |
|---|---|---|
| CEO / Co-founder | TBD | Vision, fundraising, external relations |
| CTO / Co-founder | TBD | Architecture, technical strategy, hiring |
| Chief Design Officer | TBD | Brand, product design, design system |
| Head of Product | TBD | Roadmap, specs, stakeholder alignment |
| Head of Engineering | TBD | Delivery, hiring, on-call |
| Head of Research | TBD | ANN platform, applied research partnerships |
| Head of Growth | TBD (M3 hire) | Marketing, developer relations, community |

For the incubation proposal period, the founding team is lean. Most engineering capacity is delivered by AI agents + a small senior team.

## 2. AI agent teams

Aigarth Cloud is designed to be built largely by AI agents. Each agent has a clear scope, a contract for inputs and outputs, and a review process.

### 2.1 Engineering agents

| Agent | Scope | Inputs | Outputs |
|---|---|---|---|
| Front-end agent | Dashboard + marketing site pages | Design specs, API contracts | React components, tests |
| API agent | Per-service REST + GraphQL endpoints | OpenAPI specs, data model | Typed handlers, OpenAPI doc |
| Infra agent | Docker, Compose, CI/CD, K8s manifests | Service requirements | Working infra + pipelines |
| QA agent | E2E + unit + integration tests | Acceptance criteria | Test suite + coverage report |
| Docs agent | API reference, guides, tutorials | API contracts, examples | Markdown + MDX |
| Data agent | DB migrations, seeds, models | Schema | Drizzle migrations, seed scripts |

### 2.2 Non-engineering agents

| Agent | Scope |
|---|---|
| Marketing agent | Blog posts, social copy, case studies, landing pages |
| Sales agent | Outbound sequences, lead scoring, demo scripts |
| Support agent | First-line triage, FAQ generation, escalation |
| Compliance agent | SOC 2 evidence collection, policy drafting |

### 2.3 Agent coordination

- Each agent reports to a human lead
- All agent output goes through a human review gate before merge
- Agents have scoped repositories and explicit permission boundaries
- Agent actions are logged for audit

## 3. Hiring plan

Per the `ENDGAME-PROTO-PROPOSAL.md`, the team grows from 3 founders to ~12 FTEs by end of Year 1.

| Quarter | Hire |
|---|---|
| Q1 | 1 senior backend, 1 senior frontend |
| Q2 | 1 ML engineer, 1 SRE |
| Q3 | 1 sales engineer, 1 developer advocate, 1 designer |
| Q4 | 1 enterprise AE, 1 customer success, 1 support lead |

## 4. Decision rights (RACI)

For each major decision type, who's Responsible, Accountable, Consulted, Informed:

| Decision | R | A | C | I |
|---|---|---|---|---|
| Product roadmap | Head of Product | CEO | All leads | Everyone |
| Architecture | CTO | CTO | Head of Eng, security | Engineering |
| Hiring | Hiring manager | CEO | CTO (for eng) | All |
| Fundraising | CEO | CEO | CTO, advisors | All |
| Pricing | Head of Product | CEO | Sales, finance | All |
| Marketing claims | Marketing | CEO | Legal | All |
| Security policy | Security | CTO | Eng leads, legal | All |
| Smart contract changes | Qubic lead | CTO | Security, founders | All |
| Brand changes | Design | CEO | Marketing | All |

## 5. Working hours and time zones

- Founders + core team: async-first, 4-hour overlap window
- Sales: aligned to customer time zones
- Support: 24/7 follow-the-sun (M3 onwards), starting with US + EU coverage
- All-hands: weekly, recorded

## 6. Communication

- **Async default:** Written > meeting
- **Tools:** Linear (issues), Notion (specs), GitHub (code), Slack (chat), Loom (video)
- **Decision log:** Every significant decision documented in the relevant doc (`PRD.md`, `ARCHITECTURE.md`, `RISK-REGISTER.md`) with date and rationale
- **Status updates:** Weekly written update from each lead, posted Monday morning

## 7. Linked documents

- [`PRD.md`](./PRD.md)
- [`BRD.md`](./BRD.md)
- [`GOVERNANCE.md`](./GOVERNANCE.md)
- [`ROADMAP.md`](../../../ROADMAP.md)
