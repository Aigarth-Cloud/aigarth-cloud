# Glossary

**Product:** Aigarth Cloud
**Status:** Active
**Last updated:** 2026-07-27

---

## A

- **ANN (Artificial Neural Network):** A trained neural network packaged as a versioned, licensable, revenue-shareable product. In Aigarth, an ANN is more than a model — it has a creator, a license, an accuracy benchmark, and a revenue history.
- **Aigarth:** The platform name. "Aigarth" evokes gardens, growth, ecosystems, intelligence, and living infrastructure.
- **API key:** A scoped, project-bound token used for machine-to-machine authentication. Format: `sk-aigarth-...`

## B

- **Bridge:** (Future) A mechanism to move assets between Qubic and other chains. Not in scope for Year 1.
- **Burn:** The permanent removal of QUBIC tokens from circulation, used to create deflationary pressure tied to network usage.
- **Builder:** A developer who builds applications on top of Aigarth. May also refer to the second-lowest paid plan tier (Builder = 50M QUBIC stake).

## C

- **C-corp:** Delaware C-corporation, the standard legal structure for US tech companies.
- **Cluster:** A logical grouping of compute nodes, often in a single region. Can be shared or dedicated.
- **Compute Pool:** A pool of reserved GPU-hours assigned to an organisation, sourced from their stake.
- **Creator:** A user who has published one or more ANNs.

## D

- **Drizzle:** The TypeScript ORM we use. SQL-first, type-safe, lightweight.
- **Dashboard:** The authenticated operator interface at `/dashboard`.

## E

- **Endgame Proposal:** The submission to the Qubic CCF Incubation Program, captured in `ENDGAME-PROTO-PROPOSAL.md`.
- **Explorer:** The lowest paid plan tier (Explorer = 10M QUBIC stake). Shared compute pool.

## F

- **Foundation Model:** A large pre-trained model that serves as the base for fine-tuning. Examples: Aigarth's `aigarth-reason-1`, OpenAI's `gpt-4o`, Anthropic's `claude-sonnet-4`.
- **Frontend:** The Next.js application in the project root (`/app` directory). Includes both the marketing site and the dashboard.

## G

- **Gateway:** The OpenAI-compatible AI inference service. Single stable surface for all model access.
- **Genesis:** The capital-formation event for Aigarth Cloud. See `/ipo` and the Endgame Proposal.

## H

- **Hero (Hero Plan):** A planned premium plan tier. Not yet defined.
- **Holding:** (Future) An organization-level container for related projects.

## I

- **Identity Service:** The service that owns users, organisations, API keys, sessions, and audit events.
- **IPAM:** (Future) IP address management.
- **IPO:** In Aigarth's context, the Genesis capital-formation event. Not a public stock offering.

## L

- **Ledger:** The on-chain source of truth for stake, rewards, slashing, and treasury.
- **License:** The terms under which an ANN can be used. Types: Open, Commercial, Restricted, Custom.

## M

- **Marketplace:** The two-sided market for ANNs and compute capacity.
- **Milestone:** A defined checkpoint with measurable acceptance criteria, used to gate funding tranches.

## N

- **Node:** A single physical or virtual machine providing compute capacity. Registered, attested, and monitored.
- **Node Operator:** A user who runs compute nodes and earns from network usage.

## O

- **Operator:** See Node Operator.
- **Orchestrator:** (Future) The internal service that coordinates multi-step jobs across clusters.
- **Organisation:** The top-level tenant in Aigarth. Owns projects, members, billing.

## P

- **Pioneer:** The lowest tier in the Genesis offering. Foundational staker.
- **Playground:** The browser-based environment for trying Aigarth models with a personal API key.
- **Proof of Useful Work (PoUW / Useful Proof of Work):** The consensus mechanism used by Qubic. Energy spent produces useful computation, not arbitrary hash puzzles.
- **Protocol:** The on-chain Aigarth contract on Qubic, plus the off-chain services that mirror and extend it.

## Q

- **Qubic:** The base-layer blockchain. Provides Useful Proof of Work, settlement, and identity.
- **Qubic Cloud / Aigarth Cloud:** The off-chain platform that exposes Qubic's capabilities to mainstream users.

## R

- **Region:** A geographic area where Aigarth operates compute. 47 regions at full scale.
- **Reservation:** An allocation of compute capacity tied to a stake.
- **Roadmap:** The phased engineering build plan. See `ROADMAP.md`.
- **Router:** (Future) The component that decides which model + cluster to use for a given request.

## S

- **SDK:** Software Development Kit. We ship in 6 languages.
- **Service:** An independently deployable backend in the Aigarth constellation.
- **SLA:** Service Level Agreement. Contractual uptime, latency, and support commitments.
- **Smart Contract:** A Qubic contract. Aigarth keeps on-chain logic minimal.
- **Stake:** QUBIC locked to reserve compute capacity and earn yield.
- **Stake Pool:** A logical grouping of stakes that share rewards.
- **Staker:** A user who holds stake.
- **Studio:** The web UI for training, fine-tuning, and publishing ANNs.

## T

- **Tier:** A staking plan tier (Explorer, Builder, Startup, Business, Enterprise).
- **Tokenomics:** The economic design of the Aigarth protocol: stake, burn, rewards, treasury.
- **Treasury:** The on-chain wallet that holds protocol funds, controlled by governance.
- **TTI (Time to Inference):** A key SLO metric. P50 / P95 / P99 latency from request to first token.

## U

- **Useful Proof of Work:** See Proof of Useful Work.
- **Upstream:** A model, library, or service we depend on but don't control.

## V

- **Validator:** A node operator that participates in Qubic consensus.
- **Version:** A specific release of an ANN, with a semver, a signed manifest, and a benchmark.

## W

- **Workspace:** The local-only directory in this repo. Gitignored. Used for working docs, drafts, downloads, and the project tracker dashboard.

## X

- *(none yet)*

## Y

- **Yield:** The return earned by stakers, from a combination of protocol fees and emissions.

## Z

- **Z-Order:** (Future) The order in which UI layers stack. Currently handled by Tailwind's `z-*` utilities.
