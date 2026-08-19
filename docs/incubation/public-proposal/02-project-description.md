# Project Description

> Required section 2 of the Qubic Incubation Program proposal.
> See [`README.md`](./README.md) for the full proposal index and [`proposal.md`](./proposal.md) for the executive summary.

---

## 1. What Aigarth Cloud Is

Aigarth Cloud is the access layer that turns Qubic's ANN and UPoW primitives into products a developer can call with a few lines of code and an enterprise can sign a contract for. It does this by combining four things: an OpenAI-compatible API surface, an ANN marketplace, a compute marketplace, and a QUBIC-denominated settlement layer.

## 2. What Aigarth Cloud Is Not

To place the project clearly:

- We are **not a model lab.** We do not train frontier models. We host and route to models created by others.
- We are **not a hyperscaler.** We do not sell raw compute, storage, or networking as a primary product. We sell AI inference and ANN hosting.
- We are **not a general compute marketplace.** Compute is a means to deliver AI inference, not a destination product.
- We are **not a token.** The aigarthpool is a staking and rewards contract denominated in QUBIC. It is not a fundraising vehicle.
- We are **not a wrapper on someone else's API.** Every byte that flows through the gateway either runs on Qubic node operators or, as a transitional fallback, on infrastructure we control.
- We are **not a research project.** The product is shipping code, not a paper.

## 3. The Problem

Qubic has technical capabilities that few other chains can match: Useful Proof of Work, an in-protocol Artificial Neural Network primitive, and a feeless transfer layer. Adoption is gated by a missing access layer. Developers do not want to write smart contracts to call an inference endpoint. Enterprises do not want to operate Qubic nodes to use AI. ANN creators do not have a marketplace. Node operators do not have a customer base.

Without that access layer, Qubic's capabilities stay in the hands of a small group of protocol specialists.

## 4. The Solution

Aigarth Cloud provides the access layer. Four product surfaces:

1. **AI Platform.** OpenAI-compatible APIs, model routing, SDKs, usage analytics. A developer signs up, gets an API key, makes a request, gets billed in QUBIC.
2. **ANN Ecosystem.** A registry and marketplace for ANNs. Creators publish, price, and monetise. Users discover and consume. Licensing is enforced at the gateway.
3. **Compute Economy.** A marketplace where node operators list capacity and the platform consumes it. Settlement in QUBIC.
4. **Enterprise Platform.** SSO, audit logs, RBAC, custom contracts, dedicated infrastructure for organisations that need them.

## 5. User Journeys

Three personas, summarised.

**Developer (Dani).** Signs up with an email. Gets an API key. Runs the `curl` example from the docs. Receives a streaming completion from a hosted ANN. Adds the TypeScript SDK to a Next.js app. Publishes her first application built on Aigarth Cloud. Time to first successful API call: under five minutes.

**Enterprise admin (Erin).** Evaluates Aigarth Cloud for an internal AI workload. Gets a sandbox enterprise account. Configures SSO with their Okta tenant. Onboards a 20-person team. Signs an annual contract with custom SLAs. Deploys a private ANN into a dedicated tier.

**ANN creator (Carlos).** Trains a model outside Aigarth Cloud. Connects his Qubic wallet. Uploads weights and metadata. Sets a per-call price of 0.01 QUBIC. Sees his ANN in the marketplace. Receives payouts daily, denominated in QUBIC, with full revenue attribution in his dashboard.

## 6. QUBIC Integration

Three concrete mechanisms:

1. **Compute access via staking.** Users stake QUBIC to receive compute allocation. The stake stays in the staking contract; the user draws down allocation as they use the platform. Larger stake, more allocation, lower per-call price. This is the on-ramp from QUBIC holdings to platform utility.
2. **Infrastructure participation.** Node operators register capacity, serve inference, and earn QUBIC from the platform's compute marketplace. The aigarthpool contract holds the settlement ledger.
3. **Ecosystem participation.** Developers and enterprises pay for AI services in QUBIC. ANN creators receive payouts in QUBIC. Every transaction contributes to QUBIC velocity.

Each user action on Aigarth Cloud (an API call, a marketplace purchase, a node operator payout) is a QUBIC transaction with a real economic purpose. This is how the platform increases QUBIC utility, in the language of the Incubation Team's first-phase review.

## 7. Aigarth Observatory

A community participation surface, distinct from the commercial product. Users can voluntarily contribute spare compute through a browser-based experience and observe the network's growth. The objective: turn passive observers into active participants.

The Observatory is not in the twelve-month milestone plan. It is referenced here so the Incubation Team has a full picture of the platform. A later phase will ship it as a community engagement layer, separate from the commercial path.

## 8. Linked documents

- [`proposal.md`](./proposal.md) — executive summary and proposal index
- [`01-business-plan.md`](./01-business-plan.md) — business model, market, capital formation
- [`03-technology-stack.md`](./03-technology-stack.md) — front-end, back-end, Qubic primitives
- [`05-milestones.md`](./05-milestones.md) — what we ship and when
