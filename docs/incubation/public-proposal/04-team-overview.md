# Team Overview

> Required section 4 of the Qubic Incubation Program proposal.
> See [`README.md`](./README.md) for the full proposal index and [`proposal.md`](./proposal.md) for the executive summary.

---

## 1. Founders and Leads

[TO BE FILLED by founder before submission]

| Role | Name | Background | Commitment |
|---|---|---|---|
| CEO / Co-founder | [name] | [one line: prior roles, prior shipped work] | Full-time, 12 months |
| CTO / Co-founder | [name] | [one line: prior roles, prior shipped work] | Full-time, 12 months |
| Chief Design Officer | [name] | [one line] | Full-time, 12 months |
| Head of Product | [name] | [one line] | Full-time, 12 months |
| Head of Engineering | [name] | [one line] | Full-time, 12 months |

The full commitment, including the four M1 hires and the four M3/M4 hires, is in [`annex-commitment.md` §1](./annex-commitment.md#1-named-commitment).

## 2. AI-Agent Team Structure

Aigarth Cloud is built largely by AI agents, with named humans as the review gate for every change. This is not a future plan. It is how the codebase is structured today: 23+ shipped delivery phases, each authored by an agent and reviewed by a named human.

### 2.1 Engineering agents

| Agent | Scope | Inputs | Outputs |
|---|---|---|---|
| Front-end agent | Dashboard and marketing site pages | Design specs, API contracts | React components, tests |
| API agent | Per-service REST and GraphQL endpoints | OpenAPI specs, data model | Typed handlers, OpenAPI doc |
| Infra agent | Docker, Compose, CI/CD, K8s manifests | Service requirements | Working infra, pipelines |
| QA agent | E2E, unit, integration tests | Acceptance criteria | Test suite, coverage report |
| Docs agent | API reference, guides, tutorials | API contracts, examples | Markdown, MDX |
| Data agent | DB migrations, seeds, models | Schema | Drizzle migrations, seed scripts |

### 2.2 Non-engineering agents

Marketing, sales, support, compliance. Each operates on the same model: scoped inputs and outputs, human review gate before publication, audit log of actions.

### 2.3 Coordination

- Every agent reports to a named human lead.
- All agent output goes through human review before merge.
- Agents have scoped repositories and explicit permission boundaries.
- Agent actions are logged for audit.

### 2.4 Why this is in the proposal

The Incubation Team and the Discord voters will ask "if the agents do the work, what do the humans do?" The honest answer is: the humans set the contract, review the work, and own the result. The agents do the repeatable parts. This is a delivery model, not a headcount trick.

## 3. Hiring Plan

| Quarter | Hire |
|---|---|
| Q1 (months 1–3) | 1 senior backend, 1 senior frontend |
| Q2 (months 4–6) | 1 ML engineer, 1 SRE |
| Q3 (months 7–9) | 1 sales engineer, 1 developer advocate, 1 designer |
| Q4 (months 10–12) | 1 enterprise AE, 1 customer success, 1 support lead |

Each hire is in service of a milestone's deliverables. The full plan is in [`annex-commitment.md` §1](./annex-commitment.md#1-named-commitment).

## 4. Working Model

- Async-first. 4-hour overlap window across US and EU.
- Decision log: every significant decision documented in the relevant repo doc (this proposal, the architecture, the risk register) with date and rationale.
- Weekly written update from each lead, posted Monday morning.
- Recorded all-hands, weekly, with the recording published internally.

## 5. Prior Work and Evidence of Execution

The platform's engineering track record is on the public proposal repo and the linked delivery history. Highlights:

- 23+ delivery phases shipped to date, each documented at the parent project level (see the parent project repo at the org root).
- Working microservices stack with 11 services and 2 apps, all runnable via `pnpm dev`.
- OpenAI-compatible API surface implemented and tested.
- ANN registry and deployment pipeline in place.
- Compute scheduler with Qubic node routing implemented.
- Identity, billing, and economy services with KYC/AML hooks ready.

These are not promises. They are shipped code and shipped phases. The proposal reviewers can verify each claim by following the links in the relevant section files.

## 6. Linked documents

- [`proposal.md`](./proposal.md) — executive summary and proposal index
- [`01-business-plan.md`](./01-business-plan.md) — business model, market, capital formation
- [`06-commitment.md`](./06-commitment.md) — twelve-month commitment, hand-off plan
- [`annex-commitment.md`](./annex-commitment.md) — named humans, 24-month public roadmap
