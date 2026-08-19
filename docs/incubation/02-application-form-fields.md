# Application Form Fields

**Purpose:** document each of the seven fields on the Qubic Incubation Program application form, what to write, and where the source content lives in our repo.
**Source:** [qubic.org/incubation-program](https://qubic.org/incubation-program) (form labels taken directly from the live page).

---

## 0. Final values to paste into the form

> **Status:** drafted 2026-08-09. Items marked `[TO CONFIRM]` need the founder's decision before submission. Items marked `[TO FILL]` need a real value. Everything else is paste-ready.

| # | Field | Value to submit |
|---|---|---|
| 1 | Project Name | `Aigarth Cloud` |
| 2 | Github Proposal Link | `https://github.com/aigarth-cloud/qubic-incubation-proposal` `[TO FILL: create and publish the repo at this path before submitting the form; the link must resolve without login]` |
| 3 | Contact Email | `incubation@aigarth.cloud` `[TO FILL: set up the shared inbox, test deliverability, add auto-forwarding to founder and ops lead]` |
| 4 | Link to Past Projects | `https://aigarth.cloud/deliveries` `[TO FILL: this should be the public curated subset of our delivery phases; URL is a placeholder until that page is built]` |
| 5 | Team Info (e.g. LinkedIn) | `[TO FILL: 2–4 LinkedIn URLs of the founder(s) and the CTO; see §5 below for the placeholder block]` |
| 6 | Funding Request | `100,000,000,000 QUBIC (25B / 25B / 25B / 25B across four milestones over 12 months, USD-indexed at release)` |
| 7 | Short Description | See §7 below. Final text is in the proposal doc and ready to paste. |

---

## The form at a glance

The public form is a single page with seven fields and one submit button. The detailed proposal does **not** live on the form — it lives in a **public GitHub repo** that the form points to. Our job is to keep the seven form entries short, sharp, and self-consistent with the GitHub proposal.

| # | Field | Type | Length | What to write |
|---|---|---|---|---|
| 1 | Project Name | Text | Short | The product name as it will appear in Qubic communications |
| 2 | Github Proposal Link | URL | Single GitHub URL | The repo or top-level proposal file the public will read |
| 3 | Contact Email | Email | One address | The address Qubic's Incubation Team will use for the entire program |
| 4 | Link to Past Projects | URL | One or more URLs | Evidence of prior work — GitHub org, portfolio, deployments |
| 5 | Team Info (e.g. LinkedIn) | Text | Short | The two to four most relevant founder or lead profiles |
| 6 | Funding Request | Text | Number + currency | Total QUBIC ask, with tranche structure summarised |
| 7 | Short Description | Textarea | ~3–6 sentences | The elevator pitch — what it is, why Qubic, what you deliver |

## Field-by-field guidance

### 1. Project Name

- **Value to submit:** `Aigarth Cloud`
- **Why:** the existing brand. We use "Aigarth" as the ecosystem name and "Aigarth Cloud" as the commercial product. Do not introduce a new name for the submission — Qubic will reference the project by this string in Discord, AMAs, and the treasury release.
- **Cross-check:** the GitHub proposal must use the same name. Avoid "AigarthCloud", "Aigarth-Cloud", or "Aigarth AI Cloud" in the proposal doc — pick one and stick to it.

### 2. Github Proposal Link

- **Value to submit:** a URL pointing to a public GitHub document the community will actually open.
- **What it should be:** the canonical proposal document, ideally at the top level of a public repo or in a `proposals/` folder, with a stable URL.
- **Where our content lives:** [`../ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md) is the narrative. We need to either:
  - (a) copy it into a public GitHub repo under a stable path, or
  - (b) make the existing repo public and link directly.
- **Pick option (a)** — the existing repo is private and contains customer data, contract code, and infrastructure state. Use a clean public repo for the submission. The proposal narrative + the six required team inputs become the public artifact.
- **Rules:**
  - The repo must be public before the form is submitted.
  - The link must resolve without login.
  - The document must render correctly on github.com (standard Markdown, no proprietary shortcodes).
  - All claims in the proposal should be linkable to other docs in the same repo (architecture, BRD, team) — Qubic reviewers will click through.

### 3. Contact Email

- **Value to submit:** the dedicated address for this program.
- **Recommendation:** a shared inbox, not a personal address. Examples: `incubation@aigarth.cloud` or `ops@…`. Avoid personal Gmail.
- **Rules:**
  - Must be monitorable by more than one person.
  - Must respond within one business day during evaluation, within 24 hours after approval.
  - Do not use a role alias that auto-replies or filters Qubic's email into spam.

### 4. Link to Past Projects

- **Value to submit:** one URL, or a list of URLs in the text, pointing to evidence of execution.
- **Strong candidates:**
  - The Aigarth Cloud GitHub organization showing the 23+ delivery phases (if we make the public proposal repo point to the public-facing subset of the codebase).
  - Any prior Qubic or Qubic-adjacent work the team has shipped.
  - Founder or lead profiles with verifiable shipped work.
- **What to avoid:** Dribbble shots, Behance galleries, mockups, pitch decks without shipped code. The Incubation Team explicitly weights "evidence of prior work" in their review.
- **Our advantage:** 23+ phase delivery reports already exist in [`../deliveries/`](../deliveries/). The cleanest submission is to make a curated public subset of these available alongside the proposal and link it here.

### 5. Team Info (e.g. LinkedIn)

- **Value to submit:** a short text block, two to four profiles max.
- **What to include:** founders and the technical lead. LinkedIn URLs preferred, with role and one-line context.
- **What to skip:** advisors, contractors, hires who have not started.
- **Source for our content:** [`../TEAM-AND-ROLES.md`](../TEAM-AND-ROLES.md). The Qubic form is not the place for the full org chart — the proposal doc is.

### 6. Funding Request

- **Value to submit:** the total ask, in QUBIC, with the tranche structure on a single line.
- **Our value:** `100,000,000,000 QUBIC (25B / 25B / 25B / 25B across four milestones over 12 months, USD-indexed at release)`
- **Rules:**
  - Round numbers. Qubic's reviewer is not going to argue about 100B vs 99.7B.
  - Include the tranche structure. It signals we have thought about delivery cadence, not just the headline number.
  - The funding ask must match the Milestones section in the proposal. If they diverge, the proposal is rejected for inconsistency.
  - Do **not** ask for token-sale funding. The 100B QUBIC ask is a milestone-gated grant, not a token offering.

### 7. Short Description

- **Length target:** 3–6 sentences, ~80–150 words. The form is a textarea but Qubic reviewers read hundreds of these — long is worse than short.
- **What it must cover, in order:**
  1. What Aigarth Cloud is (one sentence)
  2. What it does on Qubic specifically (one sentence, name the primitives: UPoW, ANNs, QX)
  3. Why now / what problem it solves (one sentence)
  4. What you will deliver in this program (one sentence, the milestone summary)
  5. What success looks like in 12 months (one sentence, a concrete number)
- **Tone:** plain English. No "synergize", "leverage", "revolutionary", "next-generation". Qubic's own review criteria explicitly reject vague, padded, generic writing.
- **Source for our content:** the Executive Summary and Vision sections of [`../ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md) — but condensed, not pasted.

### Final short description (paste into the form)

> Aigarth Cloud is the commercial AI infrastructure layer for Qubic: an OpenAI-compatible API gateway, ANN marketplace, and decentralized compute marketplace that turn Qubic's Useful Proof of Work and Artificial Neural Network primitives into products developers and enterprises will pay for. The platform stakes QUBIC for compute access and routes payments back through the ecosystem, giving the token real utility beyond transfers. In this twelve-month program we ship the production platform, the AI gateway, both marketplaces, and an enterprise tier, milestone-gated across four tranches of 25B QUBIC. By month 12 we target 1,000 active developers, 50 published ANNs, 1,000,000 compute hours consumed, and 10 enterprise pilots on paid contracts.

## Form-filling rules to remember

- **AI-assisted writing is acceptable** per Qubic's public page, but every important claim should point to evidence, a decision, or a concrete plan. Do not use AI to pad.
- **Vague, padded, generic writing is rejected.** The short description is the first filter — if it reads like a marketing site, the form bounces.
- **All seven fields are required.** None can be empty or "TBD".
- **The form is the front door, not the substance.** The 1–2 week review reads the GitHub proposal, not the form fields. Spend 80% of effort on the proposal doc, 20% on the form.
