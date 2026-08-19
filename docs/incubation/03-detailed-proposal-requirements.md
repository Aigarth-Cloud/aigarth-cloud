# Detailed Proposal Requirements

**Purpose:** map each of the six items Qubic's Incubation Program requires teams to provide, and identify where the Aigarth Cloud content that satisfies each one already lives.
**Source of truth:** [Introducing the Qubic Incubation Program](https://qubic.org/blog-detail/introducing-the-qubic-incubation-program), [qubic.org/incubation-program](https://qubic.org/incubation-program), [github.com/qubic/grants](https://github.com/qubic/grants).

---

## 1. The six required items

Per Qubic's program page, "Teams must provide the following":

1. **Business Plan** — how the project's objectives will be achieved
2. **Project Description** — a detailed explanation of the project
3. **Technology Stack** — front-end, back-end, and protocols
4. **Team Overview** — team members, background, current roles
5. **Milestones** — clearly defined, deliverable milestones
6. **Commitment** — at least one year of maintaining, developing, and delivering the project

The Grants Program version of these requirements is stricter on technical design diagrams and audit. For Incubation, the bar is "testable deliverables from a user perspective" rather than a full security-audit packet. We satisfy the stricter version anyway.

## 2. Per-item spec and source map

### 2.1 Business Plan

**What Qubic wants:** how we will achieve the project's objectives, including revenue model, market, and sustainability. The Incubation Team specifically evaluates the business model in Phase 2 of the review.

**What to include:**

- Mission (one paragraph)
- Revenue model with the seven streams and a year-one composition
- Customer segments (developer, enterprise, ANN creator, compute contributor)
- Market context and competitive positioning
- Sustainability after the grant — what keeps the lights on after tranche 4
- Capital efficiency: monthly burn, runway, break-even target

**Where our content lives:**

- [`../ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md) — Business Model and ROII sections
- [`../BRD.md`](../BRD.md) — full business requirements, unit economics, customer acquisition, competitive positioning
- [`../RISK-REGISTER.md`](../RISK-REGISTER.md) — top-of-register risks for the Incubation Team's "feasibility" check

**Gaps to fill before submission:**

- Add a written statement of what happens after tranche 4. Our current proto-proposal is light on this. Two acceptable framings: (a) revenue from the platform covers operating costs by month 12, or (b) we will pursue a Series A or a second incubation round to extend. Pick one and write it down.

### 2.2 Project Description

**What Qubic wants:** a detailed explanation of the project — what it is, who it serves, what problem it solves, why it exists.

**What to include:**

- The platform's purpose in plain language
- The user-facing surfaces (developer dashboard, ANN marketplace, enterprise console, Aigarth Observatory)
- The user journey for at least two personas (a developer and an enterprise admin)
- Why Qubic specifically — which primitives we use, how the platform increases QUBIC utility
- What the platform is *not* (be explicit; this helps Qubic's reviewer place it)

**Where our content lives:**

- [`../ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md) — Vision, Current Status, Problem, Solution sections
- [`../PRD.md`](../PRD.md) — full product requirements, personas, user flows
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — system view that supports the description

**Gaps to fill before submission:**

- Add a "What Aigarth Cloud is not" paragraph. Specifically: not a hyperscaler, not a model lab, not a general compute provider. Qubic reviewers will appreciate the clarity.
- Add a short diagram of the user journey for each persona. The Grants Program spec requires diagrams; Incubation does not, but they increase clarity.

### 2.3 Technology Stack

**What Qubic wants:** the front-end, back-end, and protocols we will use, and the rationale. The Grants spec asks for "diagrams, flowcharts, and any other relevant documentation". For Incubation, the bar is lower but the same content wins points.

**What to include:**

- Front-end: framework, UI library, state, deployment target
- Back-end: services, language, runtime, inter-service communication
- Data: stores, queues, caches
- Protocols and on-chain components: which Qubic primitives, which smart contracts
- Infrastructure: container orchestration, CI/CD, observability
- Security: auth, secret management, audit posture
- Diagrams: at least one system diagram, one data flow, one deployment diagram

**Where our content lives:**

- [`../TECH-STACK.md`](../TECH-STACK.md) — full stack with versions
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — service map, data flow
- [`../API-SPEC.md`](../API-SPEC.md) — REST and GraphQL surface
- [`../SECURITY.md`](../SECURITY.md) — auth, secret management, audit posture
- [`../aigarthpool/contract.md`](../aigarthpool/contract.md) — on-chain staking and rewards
- [`../deliveries/`](../deliveries/) — evidence that the stack is real and working

**Gaps to fill before submission:**

- Produce at least three diagrams in the public proposal repo: (1) service map, (2) request flow for an OpenAI-compatible completion, (3) QUBIC settlement and staking flow. PNG or SVG, embedded in the proposal doc.

### 2.4 Team Overview

**What Qubic wants:** team members, their backgrounds, and their current roles. AI-assisted building is fine (Qubic's spec implies they understand modern AI-augmented teams), but the human leads and their track record need to be visible.

**What to include:**

- Founders with role, background, and one-line track record
- The technical lead (CTO or Head of Engineering) with the same
- The AI-agent team structure and how it slots under human review (this is novel, Qubic may not have seen it; spell it out)
- The hiring plan for the program's duration
- The commitment: who is full-time, who is part-time, who is an advisor

**Where our content lives:**

- [`../TEAM-AND-ROLES.md`](../TEAM-AND-ROLES.md) — full team and agent structure, RACI, hiring plan

**Gaps to fill before submission:**

- Add LinkedIn or equivalent for each named human. The form field "Team Info (e.g. LinkedIn)" collects the highlights; the proposal doc should mirror those plus a sentence on track record per lead.
- Spell out the human-in-the-loop review process for AI-agent output. Qubic's reviewer is going to ask "if the agents do the work, what do the humans do?" — answer it in writing.

### 2.5 Milestones

**What Qubic wants:** clearly defined, deliverable milestones. Qubic's program spec says: "Milestones must be composed of testable deliverables from a user perspective (documentation, mockups, features…)." Per-milestone QA gates payment.

**What to include per milestone:**

- Title and timeline (months X–Y)
- Funding release amount
- Deliverables (each testable from a user perspective)
- Success metrics (numbers a reviewer can verify)
- What is and is not in scope for the milestone

**Where our content lives:**

- [`../ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md) — Milestones 1–4 sections
- [`../BRD.md`](../BRD.md) — tranche table with the same numbers
- [`../SPRINT-PLAN.md`](../SPRINT-PLAN.md) — per-sprint work
- [`../deliveries/`](../deliveries/) — evidence of prior execution at the speed we will need

**Gaps to fill before submission:**

- For each milestone, write the QA acceptance criteria as a separate checklist. The Qubic project manager will use these to gate payment, so they need to be objective: "1,000 registered users in production", "100 unique API keys with at least one successful completion", etc.
- Add an explicit non-scope list per milestone. Scope creep is the single most common cause of milestone slip in incubation programs. State what is *not* delivered in M1, M2, M3, M4.

### 2.6 Commitment

**What Qubic wants:** an explicit commitment to at least one year of maintaining, developing, and delivering the project. The "long-term stability" language in Qubic's blog post is doing real work — they want to know the team is not going to disappear after tranche 4.

**What to include:**

- Named individuals who are committed full-time
- Length of commitment (1 year minimum, with a stated longer horizon if real)
- What "maintaining" means concretely: security patches, dependency updates, on-call, customer support
- What happens at month 12: a public roadmap for months 13–24, ownership of the codebase, and a community hand-off plan
- Where the code lives and who has commit access

**Where our content lives:**

- [`../GOVERNANCE.md`](../GOVERNANCE.md) — project governance
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — how external contributors engage
- The repository itself once made public (commit history, contributor graph)

**Gaps to fill before submission:**

- Write a one-page "Commitment & Long-Term Plan" annex. Name the humans, state the one-year minimum, and outline a 24-month public roadmap at the milestone level.
- Confirm the public repo's licence (Apache 2.0, GPLv3, MIT, or Unlicense — see `04-compliance-and-eligibility.md`).

## 3. Cross-cutting writing rules

These apply to every section above and to the proposal as a whole:

- **Every important claim points to evidence, a decision, or a concrete plan.** This is a direct quote from Qubic's program page. If a sentence does not, cut it.
- **No vague, padded, or generic writing.** Reject adjectives that do not earn their keep. Cut "revolutionary", "next-generation", "cutting-edge", "seamless", "robust", "scalable" unless they are followed by a number.
- **Plain English.** Founder's brand-voice rule applies. See [`../BRAND-VOICE.md`](../BRAND-VOICE.md) if it exists, or default to: short sentences, concrete nouns, no abstract jargon.
- **All numbers are sourced.** If the proposal says "1,000 developers in year 1", the source is `BRD.md` §3.2 or `ENDGAME-PROTO-PROPOSAL.md` ROII section. Hyperlink, do not just repeat.
- **Diagrams where the text would otherwise be ambiguous.** Service maps, request flows, and staking flows earn their place in the proposal.
