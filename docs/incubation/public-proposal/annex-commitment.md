# Annex: Commitment and Long-Term Plan

**Purpose:** document the Aigarth Cloud team's commitment to the Qubic Incubation Program, the named individuals who will deliver it, and the plan for the platform after the twelve-month program ends.

---

## 1. Named commitment

The following individuals are committed to Aigarth Cloud for the duration of the twelve-month program. Each is committed at the level stated, with at least one full-time founder for the entire period.

| Role | Name (placeholder) | Commitment | Time in role |
|---|---|---|---|
| CEO / Co-founder | [TO BE FILLED] | Full-time, 12 months minimum | Pre-existing |
| CTO / Co-founder | [TO BE FILLED] | Full-time, 12 months minimum | Pre-existing |
| Chief Design Officer | [TO BE FILLED] | Full-time, 12 months minimum | Pre-existing |
| Head of Product | [TO BE FILLED] | Full-time, 12 months minimum | Pre-existing or month 1 hire |
| Head of Engineering | [TO BE FILLED] | Full-time, 12 months minimum | Pre-existing or month 1 hire |
| Head of Research | [TO BE FILLED] | Full-time from month 6 | M3 hire |
| Head of Growth | [TO BE FILLED] | Full-time from month 9 | M4 hire |
| Senior backend engineer | [TO BE FILLED] | Full-time, 12 months | Q1 hire |
| Senior frontend engineer | [TO BE FILLED] | Full-time, 12 months | Q1 hire |
| ML engineer | [TO BE FILLED] | Full-time, 12 months | Q2 hire |
| SRE | [TO BE FILLED] | Full-time, 12 months | Q2 hire |

The full organizational chart, including AI-agent teams with human review gates, is in [`../proposal.md` §4.2](./proposal.md#42-ai-agent-team-structure).

**Key commitment statement:** at least one named founder is full-time on Aigarth Cloud for the full twelve months. This is the minimum Qubic's program spec requires. Our actual commitment extends to twenty-four months at the milestone level (see §3 below).

## 2. What "maintaining" means in practice

Maintenance and support post-program is a real obligation, not a phrase. The team commits to the following for at least twenty-four months from program start:

### 2.1 Security and dependency updates

- Critical security patches: deployed within 24 hours of disclosure.
- High-severity issues: deployed within 7 days.
- Dependency updates: monthly review of upstream advisories, with a documented policy for major-version upgrades.
- Smart contract incident response: on-call rotation named in advance, with a 4-hour response SLA for any contract issue.

### 2.2 On-call and incident response

- 24/7 follow-the-sun on-call rotation, starting with US and EU coverage.
- Public status page at `status.aigarth.cloud`.
- Post-incident reviews published within 5 business days for any user-impacting incident.

### 2.3 Customer support

- Tier-1 support: AI-agent triage + human escalation. Response within 4 business hours for paid users, 24 hours for free-tier.
- Tier-2 support: engineering involvement within 1 business day for technical issues.
- Tier-3 support: dedicated customer success for enterprise contracts.

### 2.4 Community engagement

- Bi-weekly community calls, alternating time zones for global coverage.
- Public roadmap updates at every milestone transition.
- Active presence in the Qubic Discord, including a dedicated channel provided to us on approval.

## 3. Twenty-four month public roadmap

Months 13–24 are post-program. The roadmap at the milestone level:

| Quarter | Theme | Headline deliverables |
|---|---|---|
| Q5 (months 13–15) | Scale and harden | Multi-region deployment, 99.9% SLA, second smart contract audit, mobile SDK alpha |
| Q6 (months 16–18) | Marketplace maturity | ANN marketplace fee optimisation, creator revenue dashboards, dispute resolution flow |
| Q7 (months 19–21) | Enterprise expansion | SSO/SAML, audit logs, role-based access, SOC 2 Type 1 readiness |
| Q8 (months 22–24) | Ecosystem plays | Hardware reference designs, partner integrations (cloud marketplaces, system integrators) |

This roadmap is public and binding: we will report progress against it quarterly. Significant deviations are communicated in writing with at least 30 days' notice.

## 4. Code ownership and hand-off

### 4.1 Where the code lives

- The public proposal repo (this one) remains public for the full program and post-program.
- The platform's services, SDK, and aigarthpool contract repos are public under Apache 2.0 for the full program.
- Mirror copies of release-tagged code are kept for at least seven years from program end.

### 4.2 Who has commit access

- Founders and named leads have merge rights to their respective repos.
- AI agents operate through PRs that require human review. There is no path for an AI agent to merge to a default branch without a named human approver.
- A public contributor list (CONTRIBUTORS.md) is maintained per repo.

### 4.3 Hand-off

If the founding team cannot continue (e.g., the company is acquired, or a founder leaves), the following is in place:

- The codebase, deployment keys, and operational runbooks are held by the entity (not by individual founders personally).
- A designated successor team — internal, partner, or community — is named in writing before any founder exit.
- A 90-day transition window is guaranteed, with the departing founder(s) available for the full window.
- The Qubic Incubation Team and the Aigarth Cloud community are notified in writing within 7 days of any founder-departure event.

## 5. Sustainability after the program

The program is the acceleration phase, not the business. By the end of month 12, the platform is generating revenue from the seven streams in the Business Model (see [`../proposal.md` §1.2](./proposal.md#12-business-model--seven-revenue-streams)). Tranche 4 funds the M4 delivery, not M5.

**Post-program funding sources, in order of preference:**

1. **Operating cash from platform revenue** — the primary source, growing month-over-month.
2. **Strategic commercial partnerships** — cloud marketplace listings, system integrators, vertical-specific partners.
3. **A subsequent funding round** — Series A, strategic investment, or a second incubation grant from Qubic for adjacent work.
4. **A founder follow-on** — only if 1–3 are insufficient, and only with explicit Qubic alignment.

**What we will not do:** raise a token sale to fund post-program operations. The Qubic program terms disallow this, and it would not be the right structure for the business anyway.

## 6. Founder to fill in before submission

- [ ] **Names for the seven role rows in §1.** LinkedIn URLs in the proposal.
- [ ] **A signed commitment letter** from each named full-time founder, attached to the proposal or available on request.
- [ ] **Hiring plan adjustments** if any of the M1 hires have already been made.

## 7. Linked documents

- [`../proposal.md` §4 — Team Overview](./proposal.md#4-team-overview)
- [`../proposal.md` §6 — Commitment](./proposal.md#6-commitment)
- [`../../TEAM-AND-ROLES.md`](../../TEAM-AND-ROLES.md) (internal) — full org chart
