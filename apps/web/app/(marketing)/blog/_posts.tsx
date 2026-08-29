/**
 * Blog post content for the public marketing site.
 *
 * Each post has: metadata (for the index) and a body (for the
 * individual post page). Bodies are JSX so the visual treatment
 * matches the rest of the marketing site (rounded borders,
 * garden color palette, small uppercase labels).
 *
 * The 3 posts in this file map to the v0.2 evolution closeout:
 *   1. "Why we built Aigarth" : the vision, with a roadmap reference.
 *   2. "Eight months of Aigarth" : the journey up to the 2026-08-12
 *      checkpoint.
 *   3. "The Aigarth evolution" : current state since the Wave 3 closeout.
 *
 * The copy follows the project voice rules:
 *   - Plain English, no abstract nouns ("Subscribe to intelligence" was flagged).
 *   - Small uppercase labels under plain-English headlines.
 *   - Em-dashes replaced with colons per the project mojibake policy.
 *   - OS-flavored product names (Seed, Grove, Forest, Canopy) preserved.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button, Badge } from "@aigarth/ui";

export type PostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  category:
    | "Engineering"
    | "Product"
    | "Research"
    | "Vision"
    | "Build in public";
  author: string;
  date: string;
  readTime: string;
};

export type Post = PostMeta & {
  /** The full JSX body. Rendered inside an article container. */
  Body: () => React.ReactElement;
};

const LABEL_CLASS = "text-xs uppercase tracking-wider text-garden-600 dark:text-garden-400";
const H2_CLASS =
  "mt-12 text-balance font-display text-3xl font-medium leading-tight tracking-tight md:text-4xl";
const H3_CLASS = "mt-8 text-xl font-semibold tracking-tight";
const P_CLASS = "mt-4 text-pretty text-base leading-relaxed text-muted-foreground";
const UL_CLASS = "mt-4 space-y-2 text-muted-foreground";
const LI_CLASS = "flex items-start gap-2 text-pretty leading-relaxed";

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className={LI_CLASS}>
      <Check className="mt-1 h-4 w-4 flex-shrink-0 text-garden-500" />
      <span>{children}</span>
    </li>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className={P_CLASS}>{children}</p>;
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <h3 className={H3_CLASS}>{children}</h3>;
}

// ---------------------------------------------------------------------------
// Post 1: Why we built Aigarth
// ---------------------------------------------------------------------------

const post1: Post = {
  slug: "why-we-built-aigarth",
  title: "Why we built Aigarth: adaptive intelligence in everyone's hands",
  excerpt:
    "The vision behind the platform, the 32 phases that turn it into a product, and the roadmap to the first self-improving Organism.",
  category: "Vision",
  author: "Aigarth Cloud Team",
  date: "Aug 13, 2026",
  readTime: "7 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>VISION 01</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        Most of today's AI sits behind a wall. A few companies own the models,
        the GPUs, and the data. Everyone else rents access. We started Aigarth
        because we think the opposite shape is possible, and we want to help
        build it.
      </p>

      <h2 className={H2_CLASS}>The thesis, in one sentence</h2>
      <Para>
        Useful intelligence should grow like a garden: tended by many, owned by
        everyone, and improving with every cycle. The platform that makes that
        possible is what we are building.
      </Para>

      <h2 className={H2_CLASS}>What the platform actually does</h2>
      <Para>
        Seven primitives, working together:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Adaptive intelligence</strong>: the Organism, a single
          entity that learns, mutates, and forks over time.
        </CheckBullet>
        <CheckBullet>
          <strong>Memory</strong>: short, long, and episodic, signed, and
          auditable.
        </CheckBullet>
        <CheckBullet>
          <strong>Evolution</strong>: a fitness ledger that ranks every
          variant, generation after generation.
        </CheckBullet>
        <CheckBullet>
          <strong>Experimentation</strong>: the Work Runtime routes any
          workload, with the right compute class, to the right worker.
        </CheckBullet>
        <CheckBullet>
          <strong>Distributed computation</strong>: four tiers, from a
          local Docker runner to federated cross-region workers to the
          Qubic on-chain processor.
        </CheckBullet>
        <CheckBullet>
          <strong>Verification</strong>: replication, challenge, and
          reputation on every result. If a worker lies, it loses standing.
        </CheckBullet>
        <CheckBullet>
          <strong>External reality</strong>: Oracle Machines read; the OC
          processor writes. A closed loop, not a frozen model.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>The roadmap, in plain English</h2>
      <Para>
        We have a public roadmap. It is grouped by what each phase unlocks for
        you, not by what we are working on internally. Here is the short
        version, with the full version on the roadmap page:
      </Para>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <div className={LABEL_CLASS}>Q3 2026 (NOW)</div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            Phase 26: Organism + Phase 27: Work Runtime
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Adaptive intelligence primitive ships this quarter. The
            Work Runtime routes work items to local workers with
            replication, challenge, and reputation verification.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <div className={LABEL_CLASS}>Q4 2026</div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            Phase 28: Federated workers
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Workers that live in your own data center, your laptop, or a
            partner's network. Cross-deployment reputation.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <div className={LABEL_CLASS}>Q1 2027</div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            Phase 29: OC processor
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The Qubic on-chain processor reads Organism work items and
            commits 451-of-676 computor signatures. Real, on-chain
            verification, not a mock.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <div className={LABEL_CLASS}>Q2 2027</div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            Phase 30: Multi-workload scheduler
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The scheduler stops being a per-workload router. It becomes
            an economic allocator, balancing cost, latency, and
            reputation across every Organism in the garden.
          </p>
        </div>
      </div>

      <Para>
        Beyond Phase 30, we are reserving the right to be surprised. Two
        things we are not doing, on purpose:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          We are not building a "play store" for intelligences. The
          marketplace is a surface, not a moat.
        </CheckBullet>
        <CheckBullet>
          We are not replacing the LLM in your stack. We are giving it
          a fitness function and a feedback loop.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>What you can do today</h2>
      <Para>
        The platform is live in dev. You can register an Organism, fork it,
        watch its fitness curve climb, and submit work items that the
        Work Runtime will route and verify. The full{" "}
        <Link href="/roadmap" className="text-garden-600 underline">
          roadmap
        </Link>{" "}
        is on the site, with every phase marked as shipped, in progress, or
        planned.
      </Para>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/roadmap">
          <Button size="lg" className="gap-1.5">
            See the full roadmap
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/contact">
          <Button size="lg" variant="outline">
            Talk to us
          </Button>
        </Link>
      </div>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Post 2: Eight months of Aigarth (journey up to the 2026-08-12 checkpoint)
// ---------------------------------------------------------------------------

const post2: Post = {
  slug: "eight-months-of-aigarth",
  title: "Eight months of Aigarth: from a single ANN to a 12-service platform",
  excerpt:
    "A look at the work between January and the August 12 checkpoint. Twenty-four phases, twelve services, and the team that made it real.",
  category: "Engineering",
  author: "Aigarth Cloud Team",
  date: "Aug 13, 2026",
  readTime: "9 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>JOURNEY 02</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        We approved the Aigarth evolution PEP on August 12, 2026. To set the
        stage for what that means, here is what shipped in the eight months
        before it.
      </p>

      <h2 className={H2_CLASS}>The platform, in numbers</h2>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>12 services</strong> running in production: identity, qubic,
          compute, gateway, billing, ann, marketplace, tissue, dataset,
          economy, training, and the new <em>work</em> runtime.
        </CheckBullet>
        <CheckBullet>
          <strong>26 database migrations</strong> across all services, with a
          per-service migration table to keep the journals clean.
        </CheckBullet>
        <CheckBullet>
          <strong>5 training recipes</strong> (mlp, cnn, text, gradient
          boost, and the trinary classifier that powers the consensus
          tissue).
        </CheckBullet>
        <CheckBullet>
          <strong>5 consensus policies</strong> for tissue-level decisions:
          majority, unanimous, any, veto-aware, and short-circuit.
        </CheckBullet>
        <CheckBullet>
          <strong>3 ADRs</strong> governing the platform (Trinary Protocol
          v1, Dataset Licensing, and the Aigarth evolution ADR 005).
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>The phases that matter most</h2>

      <Subhead>Phase 0-9: The foundation</Subhead>
      <Para>
        Identity with JWT auth, the qubic client, compute reservations,
        gateway routing, billing and credits, the first ANN registry, the
        marketplace, and the tissue service. None of this is exciting on
        its own. All of it is required.
      </Para>

      <Subhead>Phase 10-14: The intelligence layer</Subhead>
      <Para>
        The ANN registry grew from a single class to a versioned,
        licensable, deployable model. The dataset service added schema
        sniffing and connectors. The first experiments with retraining
        and A/B shadowing showed up here.
      </Para>

      <Subhead>Phase 17: Material science, end to end</Subhead>
      <Para>
        An 8-ANN coordinator (Director, Literature, Simulation, Physics,
        Design, Optimization, Experiment, Validation) showed that a
        swarm of small, specialized AIs can outperform a single
        generalist on a real research task. The cost model showed that
        DFT relaxation dominates at 87% of the budget. The Phase 1
        re-evaluation gate became the standard for moving from "we
        tried it" to "we shipped it."
      </Para>

      <Subhead>Phase 18: The Trinary Intelligence Layer</Subhead>
      <Para>
        The trinary package (state, sign, envelope, consensus) reached
        100% test coverage with 90+ cases. The tissue service signed
        every IntentEnvelope with HMAC-SHA-256. The five consensus
        policies turned the tissue from a name into a real primitive.
      </Para>

      <Subhead>Phase 19: Training, the real one</Subhead>
      <Para>
        Five training recipes. Real LLM invocation. SSE progress events.
        Auto-publish to the ANN registry. Decision outcome tracking.
        Auto-retrain on degraded performance. The training service
        stopped being a sandbox and started being production-grade.
      </Para>

      <Subhead>Phase 20-24: Staking, treasury, mainnet</Subhead>
      <Para>
        AigarthPool (on-chain settlement with a 30/60/10 default split,
        QPI contract plus a TypeScript simulator). The multi-sig
        treasury. The pre-mainnet gates. The hardware presale. Each
        phase moved the platform from "a thing you can run" to "a thing
        you can fund."
      </Para>

      <h2 className={H2_CLASS}>The 2026-08-12 checkpoint</h2>
      <Para>
        We froze the state on August 12 and wrote a PEP for the next
        chapter. The PEP is called{" "}
        <em>The Aigarth evolution</em>: it adds the Organism primitive
        and the Work Runtime, two pieces that turn the platform from a
        model registry into a place where intelligences actually grow.
      </Para>
      <Para>
        You can read the full PEP in our docs. The next post in this
        series covers what the evolution actually shipped, three weeks
        later.
      </Para>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Post 3: The Aigarth evolution (current state since the closeout)
// ---------------------------------------------------------------------------

const post3: Post = {
  slug: "the-aigarth-evolution",
  title: "The Aigarth evolution: what the Organism and Work Runtime just unlocked",
  excerpt:
    "Three weeks after the PEP was approved, the Organism primitive and the Work Runtime are live. Here is what that means for you, and what is next.",
  category: "Product",
  author: "Aigarth Cloud Team",
  date: "Aug 13, 2026",
  readTime: "8 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>EVOLUTION 03</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        We approved the Aigarth evolution PEP on August 12. We closed out
        the build on August 13. Here is what shipped, why it matters, and
        what we are working on next.
      </p>

      <h2 className={H2_CLASS}>The Organism, in one paragraph</h2>
      <Para>
        An Organism is a single, addressable intelligence that lives in
        your Garden. It has a mutable genome, an episodic memory, a
        fitness history, and a lineage. You can fork it, mutate it, and
        watch it improve (or not) over time. The schema, the routes, the
        Garden view, and the marketplace listing are all live.
      </Para>

      <h2 className={H2_CLASS}>The Work Runtime, in one paragraph</h2>
      <Para>
        The Work Runtime is the engine that turns Organism intent into
        executed work. You submit a work item, the scheduler picks a
        worker, the worker runs the algorithm, the verifier checks the
        result against three replicas, and the accountant emits the
        billing event. Five new tables, thirteen new routes, a
        four-tier compute model, and a v1 verification stack
        (replication + challenge + reputation) that catches the obvious
        attacks while we earn the right to add TEE and ZK.
      </Para>

      <h2 className={H2_CLASS}>What you can do today</h2>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Create an Organism</strong>: one POST, returns a draft
          with a slug, a genome, and a creator.
        </CheckBullet>
        <CheckBullet>
          <strong>Fork and mutate</strong>: every Organism has a
          lineage. Every mutation is signed and auditable. The
          fitness history is append-only.
        </CheckBullet>
        <CheckBullet>
          <strong>Submit a work item</strong>: the Work Runtime picks
          the best worker, runs the algorithm, and verifies the
          result. Disputed results pause the credit settlement.
        </CheckBullet>
        <CheckBullet>
          <strong>List your Organism</strong>: the marketplace
          listing includes a lineage preview, a fork count, and a
          fitness max. Forks are billable.
        </CheckBullet>
        <CheckBullet>
          <strong>Read the fitness curve</strong>: the Garden view
          renders the Organism header, the lineage breadcrumb, the
          fitness curve, the experience stream, and an art-directed
          live neural field (clearly labeled as a visualisation, not a
          literal read of the genome).
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>What is next</h2>
      <Para>
        Phase 28 (federated workers) is on the schedule for Q4 2026.
        Phase 29 (the Qubic OC processor) is on the schedule for Q1
        2027. We are not changing the public roadmap; the one we
        published in{" "}
        <Link href="/blog/why-we-built-aigarth" className="text-garden-600 underline">
          the first post in this series
        </Link>{" "}
        is the one we are running against.
      </Para>

      <Subhead>Two open questions, named out loud</Subhead>
      <Para>
        We are not hiding the hard parts. Two open questions from the
        evolution ADR are still being decided:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Verification upgrade trigger</strong>: when do we
          move from replication+challenge+reputation to TEE or ZK?
          Volume, value, adversarial rate, or a manual decision? We
          will pick one and document the function in a follow-up
          ADR.
        </CheckBullet>
        <CheckBullet>
          <strong>Dispute resolution</strong>: when all three
          replicas disagree, who decides who is right? Deterministic
          re-run on a high-reputation worker, manual admin review,
          or refund to the payer? Same deal: a follow-up ADR with a
          default.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>The numbers</h2>
      <ul className={UL_CLASS}>
        <CheckBullet>
          60+ new test cases shipped in this wave, on top of the 213
          from Wave 2.
        </CheckBullet>
        <CheckBullet>
          6 packages typecheck clean. The Work Runtime service
          (port 7012) is the new 12th service in the platform.
        </CheckBullet>
        <CheckBullet>
          3 new ADRs (Organism primitive, Work Runtime, OC
          processor) plus the governance-migrations ADR from
          Wave 1.
        </CheckBullet>
        <CheckBullet>
          Zero regressions across the existing 200+ tests.
        </CheckBullet>
      </ul>

      <Para>
        The full engineering record is in the docs. The roadmap is on
        the site. If you want to see the platform run, the dev
        environment is open.
      </Para>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/roadmap">
          <Button size="lg" className="gap-1.5">
            See the roadmap
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/contact">
          <Button size="lg" variant="outline">
            Try it
          </Button>
        </Link>
      </div>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Post 4: How Aigarth is built (Build in Public 01)
// ---------------------------------------------------------------------------

const post4: Post = {
  slug: "how-aigarth-is-built",
  title: "How Aigarth is built: the 90/10 split",
  excerpt:
    "The first post in our build-in-public series. The honest number, the pattern, and what it means if you are thinking about doing the same.",
  category: "Build in public",
  author: "Aigarth Cloud Team",
  date: "Aug 15, 2026",
  readTime: "5 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>BUILD IN PUBLIC 01</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        We want to be honest about how Aigarth is built. Not the
        marketing version. The real one.
      </p>

      <h2 className={H2_CLASS}>The number</h2>
      <Para>
        By content volume, about <strong>90% of what we ship is generated by AI</strong>.
        By decisions, about <strong>90% is human</strong>. The two numbers
        do not add to 100% on purpose. They measure different things.
        The first is who typed the words. The second is who decided
        what to build and what to throw away.
      </Para>
      <Para>
        Most of the time, both numbers are right at the same time.
        The agent is typing. The team is deciding. They are not the
        same job.
      </Para>

      <h2 className={H2_CLASS}>What the AI actually does</h2>
      <Para>It writes the code. All of it. Concretely:</Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          The 12 services that run in production (identity, qubic,
          compute, gateway, billing, ann, marketplace, tissue,
          dataset, economy, training, and the new work runtime).
        </CheckBullet>
        <CheckBullet>
          The 30K+ lines of TypeScript. The Drizzle schemas. The
          Postgres migrations. The vitest cases.
        </CheckBullet>
        <CheckBullet>
          The Next.js pages, the API routes, the marketing copy.
        </CheckBullet>
        <CheckBullet>
          The blog posts, the ADRs, the research audits, the
          closeout reports. Including this one.
        </CheckBullet>
      </ul>
      <Para>
        It also does the build orchestration. When we want to ship
        a phase, we write a one-paragraph brief. The agent reads the
        relevant docs, drafts a build plan, ships the code, runs the
        typechecker and the tests, and reports back with a diff. We
        review. Accept, reject, or steer.
      </Para>
      <Para>
        It does the verification. Every wave gets verified end
        to end before we sign it off.
      </Para>

      <h2 className={H2_CLASS}>What we actually do</h2>
      <Para>
        Four things, in this order of how often we do them.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>We write the briefs.</strong> Most of them are one
          paragraph. Some are one sentence. The brief for the v0.2
          evolution was: "Here is the 7-primitive thesis, here is
          the 10-task list, here is the Falsification Audit. Make
          this moment a checkpoint and ship the engineering."
        </CheckBullet>
        <CheckBullet>
          <strong>We make the calls.</strong> "Accept both,
          document." "Do not run pnpm dev." "Use plain English, no
          'Subscribe to intelligence.'" "The Work Runtime is a
          separate service, not a sidecar in tissue." These are
          10-second decisions that shape 10-hour builds.
        </CheckBullet>
        <CheckBullet>
          <strong>We write the copy voice rules.</strong> Not the
          copy itself. The rules. Plain English. No abstract nouns.
          Em-dashes become colons. Small uppercase labels under
          plain-English headlines. Then the agent writes everything
          inside those rules.
        </CheckBullet>
        <CheckBullet>
          <strong>We decide what to ship and what to throw away.</strong>{" "}
          There are 30 phases on the roadmap. We shipped 27. The 3
          we did not ship (ZK proofs, TEE attestation, Neuraxon) are
          explicitly named as deferred. The decision to defer is a
          product call, not an engineering call.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>A typical afternoon</h2>
      <Para>
        We open the laptop. We want to ship Phase 28 (federated
        workers). Here is what happens.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          We write a one-paragraph brief. The contract is in
          ADR 006. Build it.
        </CheckBullet>
        <CheckBullet>
          The agent reads the ADR, drafts a build plan, ships the
          first cut. About 40 minutes.
        </CheckBullet>
        <CheckBullet>
          We review the diff. We find three things we do not
          like. We steer with one paragraph each.
        </CheckBullet>
        <CheckBullet>
          The agent revises. About 15 minutes.
        </CheckBullet>
        <CheckBullet>
          We accept. Phase 28 ships.
        </CheckBullet>
      </ul>
      <Para>
        Total wall clock: about 90 minutes for a 2 SP piece of work.
        By a single developer, that would be 2 to 3 days of coding. With a junior
        engineer, about 1 to 2 days. With a senior engineer, about 1
        day. The pattern is faster than any of those, with a different
        mix of who does what.
      </Para>

      <h2 className={H2_CLASS}>What this means if you want to try it</h2>
      <Para>Four things we learned the hard way.</Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>The AI is good at execution. Bad at taste.</strong>{" "}
          It can write 10 versions of a sentence in 5 seconds. It
          cannot tell you which one sounds like a person. That is
          your job.
        </CheckBullet>
        <CheckBullet>
          <strong>The founder is the editor, not the author.</strong>{" "}
          The founder spends maybe 10% of their time typing and 90%
          reviewing. The reviewing is the work. The typing is free.
        </CheckBullet>
        <CheckBullet>
          <strong>The pattern only works if you have a strong point of view.</strong>{" "}
          If you do not know what your product is for, the agent
          cannot help. It will produce a lot of code, a lot of
          documentation, and a lot of nothing. The point of view
          comes first. The agent executes against it.
        </CheckBullet>
        <CheckBullet>
          <strong>Copy voice rules force the agent to write things you would actually say.</strong>{" "}
          Without rules, the agent drifts into "intelligence for
          everyone" and "subscribe to the future." With rules, the
          agent writes sentences you would write yourself.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>What is next in this series</h2>
      <Para>
        This is post 01 of the Build in Public series. Future posts
        will cover:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          The 7 primitives and why each one is its own service.
        </CheckBullet>
        <CheckBullet>
          How we test a 12-service platform with 600+ tests and a
          4-minute CI loop.
        </CheckBullet>
        <CheckBullet>
          The Falsification Audit: how we decide what is shipped and
          what is thrown away.
        </CheckBullet>
        <CheckBullet>
          The cost model: what it actually costs to run an Organism
          through a Work Runtime cycle.
        </CheckBullet>
      </ul>
      <Para>
        If you want to follow along, the roadmap is on the site. The
        blog updates when there is something honest to say.
      </Para>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/roadmap">
          <Button size="lg" className="gap-1.5">
            See the roadmap
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/blog">
          <Button size="lg" variant="outline">
            More posts
          </Button>
        </Link>
      </div>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Post 5: The 7 primitives and why each one is its own service (Build in Public 02)
// ---------------------------------------------------------------------------

const post5: Post = {
  slug: "the-seven-primitives",
  title: "The 7 primitives and why each one is its own service",
  excerpt:
    "Post 02 in the build-in-public series. How we split Aigarth into 12 services, and why the 7 primitives are the right level to think at.",
  category: "Build in public",
  author: "Aigarth Cloud Team",
  date: "Aug 16, 2026",
  readTime: "6 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>BUILD IN PUBLIC 02</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        Aigarth runs as 12 services. The way to think about that is
        7 primitives. Each primitive is a single idea. Each service
        implements one or two of them. This post is about why we
        drew the lines where we did.
      </p>

      <h2 className={H2_CLASS}>The 7 primitives</h2>
      <Para>
        The whole platform can be described as the sum of seven
        things. The boxed equation, paraphrased:
      </Para>
      <div className="mt-6 rounded-2xl border bg-muted/40 p-6">
        <ul className="space-y-2 text-pretty font-mono text-sm">
          <li>Adaptive Intelligence</li>
          <li>+ Memory</li>
          <li>+ Evolution</li>
          <li>+ Experimentation</li>
          <li>+ Distributed Computation</li>
          <li>+ Verification</li>
          <li>+ External Reality</li>
        </ul>
      </div>
      <Para>
        In plain English:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Adaptive Intelligence</strong> is the Organism. A
          single addressable thing that learns, mutates, and forks.
        </CheckBullet>
        <CheckBullet>
          <strong>Memory</strong> is the episodic and long-term store
          an Organism writes to and reads from.
        </CheckBullet>
        <CheckBullet>
          <strong>Evolution</strong> is the fitness ledger and the
          lineage. Every variant ranked, every generation tracked.
        </CheckBullet>
        <CheckBullet>
          <strong>Experimentation</strong> is the Work Item. The
          envelope that says "try this with these constraints, here
          is the reward."
        </CheckBullet>
        <CheckBullet>
          <strong>Distributed Computation</strong> is the Worker. The
          four tiers from a local Docker runner up to a Qubic
          on-chain processor.
        </CheckBullet>
        <CheckBullet>
          <strong>Verification</strong> is the proof that a Worker
          actually did the work. Replication, challenge, reputation.
        </CheckBullet>
        <CheckBullet>
          <strong>External Reality</strong> is the boundary with the
          outside world. Oracle Machines read; the OC processor
          writes.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>Why each primitive is its own service</h2>
      <Para>
        Four reasons, in this order of how much they matter.
      </Para>
      <Subhead>1. Testability</Subhead>
      <Para>
        A service that does one thing is a service you can test
        without spinning up the rest. The Work Runtime has 38
        vitest cases. None of them touch the ANN service. None of
        them touch billing. None of them touch identity. If we
        had bundled the Work Runtime into the ANN service, every
        test would have needed a Postgres + NATS + an ANN schema.
        The test would have been 10x slower and 5x more brittle.
      </Para>

      <Subhead>2. Blast radius</Subhead>
      <Para>
        A primitive that breaks should break its own service and
        nothing else. When the Work Runtime had a race condition in
        its lease-expiry sweeper, the only thing that went down was
        the Work Runtime. The ANNs kept serving decisions. The
        billing kept emitting events. Identity kept issuing tokens.
        If we had put the Work Runtime inside the ANN service, a
        single race condition would have taken down the entire
        intelligence layer.
      </Para>

      <Subhead>3. Scaling</Subhead>
      <Para>
        Different primitives have different load shapes. Identity is
        read-heavy and bursty. ANN is read-heavy and steady. Billing
        is write-heavy. The Work Runtime is both, with spikes. They
        do not share a scaling profile. When they are in one
        service, you scale them all at once. When they are split,
        you scale each one to its own load.
      </Para>

      <Subhead>4. Ownership</Subhead>
      <Para>
        A primitive is a unit of design. When it lives in one
        service, the ADR that defines it is a single, readable
        document. When it is split across three services, the
        primitive is a constraint that has to be enforced in every
        place it touches. We have three ADRs (005, 006, 007) that
        name the three core primitives. They are readable in one
        sitting because the primitives they describe live in
        well-bounded places.
      </Para>

      <h2 className={H2_CLASS}>The hard calls</h2>
      <Para>
        Two boundaries almost went the other way. Both are good
        examples of what a wrong call would have looked like.
      </Para>
      <Subhead>The Work Runtime almost lived inside the Tissue service</Subhead>
      <Para>
        The first version of the design put the Work Runtime in
        tissue. Tissues were already the "combine multiple ANNs
        into a single decision" primitive, and the Work Runtime
        looked like a natural extension. We rejected the bundling
        for a specific reason: the Tissue service is stateless. A
        tissue call comes in, fans out to ANNs, combines, returns.
        A Work Item is stateful across its whole lifecycle
        (queued, running, verified, failed, or disputed). Bundling
        the two would have forced the Tissue service to track
        per-Work-Item state, breaking the stateless invariant that
        downstream consumers rely on. The Work Runtime got its own
        service (port 7012, 5 tables, 13 routes). The Tissue
        service stayed stateless.
      </Para>

      <Subhead>The Organism almost lived inside the ANN service</Subhead>
      <Para>
        The first draft of the Organism primitive was a new
        endpoint on the ANN service. An Organism has a genome, and
        a genome looks a lot like an ANN version. We rejected the
        bundling because an Organism is a unit of evolution, not
        a unit of inference. An ANN answers questions. An Organism
        forks, mutates, and improves across generations. They have
        different lifecycles, different access patterns, and
        different users. The Organism got its own tables in the
        ANN database (so we could reuse the auth + billing
        integration) but its own routes, services, and ADRs.
      </Para>

      <h2 className={H2_CLASS}>The cost of getting it wrong</h2>
      <Para>
        Coupled primitives are brittle primitives. Two examples
        from the v0.2 evolution PEP that we named explicitly so we
        do not forget.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          If Verification (the Work Runtime's job) lived inside
          Experimentation (the Work Item envelope), every change
          to the verification stack would be a change to every
          work item. That is the wrong direction. Verification
          should be replaceable (replication today, TEE tomorrow,
          ZK someday) without changing the work item.
        </CheckBullet>
        <CheckBullet>
          If Memory (the Organism's episodic store) lived inside
          Adaptive Intelligence (the Organism itself), a memory
          write would be a genome mutation. The two have different
          audit trails, different retention rules, and different
          consumers. Bundling them would couple those rules
          together.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>What we would do differently</h2>
      <Para>
        Two things.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          The OC processor (External Reality, ADR 007) should have
          been its own service from day one, not a sidecar in
          the Qubic service. We deferred that call to keep v0.2
          small. It is the next big refactor on the list.
        </CheckBullet>
        <CheckBullet>
          The Datasets service should be merged with the Training
          service. The boundary between them is thin. They share
          most of their access patterns. We will likely do this
          in the next refactor.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>What is next in this series</h2>
      <Para>
        Post 03 will cover how we test a 12-service platform with
        600+ tests and a 4-minute CI loop. It is a long post
        because the test architecture is the most underrated part
        of the platform.
      </Para>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/blog/how-aigarth-is-built">
          <Button size="lg" variant="outline" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Build in Public 01
          </Button>
        </Link>
        <Link href="/roadmap">
          <Button size="lg" className="gap-1.5">
            See the roadmap
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Post 6: How we test a 12-service platform (Build in Public 03)
// ---------------------------------------------------------------------------

const post6: Post = {
  slug: "how-we-test-the-platform",
  title: "How we test a 12-service platform with 600+ tests and a 4-minute CI loop",
  excerpt:
    "Post 03 in the build-in-public series. The test architecture, the no-dev-server rule, and the dual-mode pg-mem harness that lets us ship a real-DB schema test in 4 minutes.",
  category: "Build in public",
  author: "Aigarth Cloud Team",
  date: "Aug 16, 2026",
  readTime: "6 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>BUILD IN PUBLIC 03</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        Aigarth runs as 12 services. Each one is its own package.
        The way we test them is the most underrated part of the
        platform. This post is about how that test architecture
        works, why the no-dev-server rule matters, and the one
        piece of infrastructure (a dual-mode pg-mem harness) that
        makes the whole thing fast.
      </p>

      <h2 className={H2_CLASS}>The number</h2>
      <Para>
        As of this week, the platform has more than 600 vitest cases
        across 12 services. The breakdown:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>services/ann:</strong> 224 cases. The biggest
          test surface. Includes the Organism routes, the lineage
          and memory primitives, the retrain cron, the integration
          test harness.
        </CheckBullet>
        <CheckBullet>
          <strong>services/training:</strong> 48 cases. The
          training orchestrator, the recipe registry, the retrain
          guardrail.
        </CheckBullet>
        <CheckBullet>
          <strong>services/work:</strong> 38 cases. The new Work
          Runtime. The Work Item envelope, the scheduler scoring,
          the verifier V01-V03 adversarial cases, the ULID
          generator.
        </CheckBullet>
        <CheckBullet>
          <strong>services/marketplace:</strong> 16 new cases for
          the Organism listings. Plus the older tissue listing
          tests.
        </CheckBullet>
        <CheckBullet>
          <strong>services/tissue, services/identity,
          services/billing, services/compute, services/dataset,
          services/gateway, services/economy, services/qubic,
          packages/trinary, packages/aigarthpool, packages/observability:</strong>{" "}
          the rest. Smaller per-service, but they add up.
        </CheckBullet>
      </ul>
      <Para>
        Total: well over 600 cases. The number will be a little
        higher by the time you read this, because the Work Runtime
        is new and we are still filling in coverage.
      </Para>

      <h2 className={H2_CLASS}>The no-dev-server rule</h2>
      <Para>
        The most important rule in the test architecture:{" "}
        <strong>tests do not run against a live platform stack</strong>.
        No pnpm dev. No pnpm stack:dev. No Postgres running. No
        NATS running. The tests run against the build, not the
        platform.
      </Para>
      <Para>
        The reason is simple. A test that needs a running stack
        is a test that is flaky. A flaky test is a test that
        someone eventually disables. A disabled test is a test
        that does not exist. So we banned the dev server from
        the test path entirely.
      </Para>
      <Para>
        The cost of this rule: every test has to bring its own
        database (or its own mock of one). The benefit: the same
        test that passes in CI passes on a developer laptop, with
        zero setup. The tests are not infrastructure-dependent.
        They are code.
      </Para>

      <h2 className={H2_CLASS}>The three test patterns we use</h2>
      <Para>
        Three patterns, picked by what the code is doing.
      </Para>

      <Subhead>1. Pure function tests (no DB, no HTTP)</Subhead>
      <Para>
        For logic that does not touch the database, the test is
        just a function in, function out. The Work Runtime's
        scheduler scoring and the verifier decision logic are
        both pure functions. Their tests run in tens of
        milliseconds. The whole Work Runtime test suite runs in
        under a second.
      </Para>
      <Para>
        This is the cheapest pattern. When the test is pure, the
        test is also the documentation. You can read the test and
        understand the contract without running anything.
      </Para>

      <Subhead>2. Unit tests with a mocked DB (in-memory)</Subhead>
      <Para>
        For logic that touches the database, the test uses a mock
        Drizzle client. The Organism CRUD routes in services/ann
        use this pattern. The mock returns canned data; the test
        asserts that the right query was called with the right
        arguments. These tests run in low hundreds of milliseconds
        per case. The 37 HTTP-level cases in services/ann run in
        about 30 seconds total.
      </Para>
      <Para>
        The mock is a hand-written stub, not a generated one. It
        is small (a few hundred lines) and the tests reference the
        same fixtures the production code uses. When the schema
        changes, the mock changes too. The cost of keeping the
        mock in sync is real, but smaller than the cost of
        running a real database in CI.
      </Para>

      <Subhead>3. Integration tests with a real schema (pg-mem)</Subhead>
      <Para>
        For the few tests that genuinely need a real database
        (the recursive CTE in the lineage, the FK on parent_id,
        the slug UNIQUE constraint, the CHECK on memory kind),
        the test uses a pg-mem-backed Postgres emulator. The
        harness is in services/ann/src/tests/integration/setup.ts.
        It runs every migration in services/ann/drizzle against
        a fresh in-memory database per test file, and the test
        runs against the real schema.
      </Para>
      <Para>
        pg-mem is not perfect. It does not implement every
        Postgres feature (no GIN trigram indexes, no
        collations). For the few features it does not support, we
        either fall back to JS-level checks in the test, or we
        skip the test and document the gap. We do not silently
        skip. The skip is always visible in the test output.
      </Para>
      <Para>
        The integration suite is opt-in via{" "}
        <code>pnpm --filter @aigarth/ann test:integration</code>.
        It does not run on every save. It runs on every push. The
        full integration suite (11 cases) runs in about 10
        seconds. The pg-mem setup is fast enough that we can
        afford it on every CI run.
      </Para>

      <h2 className={H2_CLASS}>The dual-mode harness</h2>
      <Para>
        The harness in services/ann/src/tests/integration/setup.ts
        has two modes. <code>pg-mem</code> is the default. It
        runs in any environment, no setup. <code>postgres</code>{" "}
        is opt-in, set via <code>INTEGRATION_DB_MODE=postgres</code>.
        It connects to a real Postgres at the existing
        docker-compose URL, creates a fresh database per test
        file, and runs the same migrations.
      </Para>
      <Para>
        Why two modes. The pg-mem mode is the fast path. It
        runs in CI on every push. The postgres mode is the
        confidence check. We run it before every release. The
        two modes exercise the same test code, so the only thing
        that changes between them is the database underneath. If
        a test passes in pg-mem and fails in postgres, we know
        pg-mem is missing a feature we need. If a test passes in
        both, we know the schema is right.
      </Para>
      <Para>
        The harness also handles one annoying thing: the
        self-referential FK on the organisms table (parent_id and
        root_id both reference organisms.id). pg-mem's eager FK
        check fires before the row is added, which breaks the
        founder-insert case. The harness disables the eager
        check on the self-referencing tables and the test
        re-implements the check in JS. Not pretty, but it works.
        And the workaround is documented in the code.
      </Para>

      <h2 className={H2_CLASS}>The 4-minute CI loop</h2>
      <Para>
        The CI runs in parallel across the services, courtesy of
        Turborepo. The slowest single test run is services/ann at
        about 44 seconds. The other services finish in 10-30
        seconds. The whole pipeline runs in about 4 minutes wall
        clock, end to end.
      </Para>
      <Para>
        We could go faster. We do not need to. A 4-minute loop
        is fast enough that a developer will not context-switch
        while waiting for CI. It is slow enough that we cannot
        afford to run a real database on every push. The
        dual-mode harness is the compromise.
      </Para>

      <h2 className={H2_CLASS}>What we would do differently</h2>
      <Para>Two things.</Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          The pg-mem + Postgres dual-mode harness is in
          services/ann. It should be a shared package so every
          service can use it. The Work Runtime would benefit
          from a real-DB integration test for the 5-table
          schema. Today it has only the pure-function tests.
          We will likely extract the harness in the next
          refactor.
        </CheckBullet>
        <CheckBullet>
          The CI cache is not warm. A cold CI run takes 4
          minutes; a warm run (after the first push) takes about
          90 seconds. The first push of the day still feels
          slow. We can fix this with a better Turbo remote cache,
          but the engineering effort is not worth the win for a
          team our size.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>What is next in this series</h2>
      <Para>
        Post 04 will cover the Falsification Audit: how we decide
        what is shipped and what is thrown away. The Audit is
        the most underrated document in the v0.2 evolution PEP.
        It is also the one we are most often asked about.
      </Para>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/blog/the-seven-primitives">
          <Button size="lg" variant="outline" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Build in Public 02
          </Button>
        </Link>
        <Link href="/blog">
          <Button size="lg" className="gap-1.5">
            All posts
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Post 7: Epoch 227, a Qubic halving and a marker for Aigarth Cloud
// ---------------------------------------------------------------------------

const post7: Post = {
  slug: "qubic-halving-epoch-227",
  title: "Epoch 227: a Qubic halving, and a marker for Aigarth Cloud",
  excerpt:
    "On August 19, 2026, Qubic enters its second halving. We have spent the last eight months building Aigarth Cloud. This is the moment we mark it in public.",
  category: "Vision",
  author: "Aigarth Cloud Team",
  date: "Aug 19, 2026",
  readTime: "6 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>EPOCH 227</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        August 19, 2026 is a Qubic milestone. It is also one for
        us. Aigarth Cloud is live at aigarthcloud.lucidmindlabs.com,
        and we wanted to mark the moment in public.
      </p>

      <h2 className={H2_CLASS}>Why now</h2>
      <Para>
        The second halving of the Qubic network lands on August 19.
        We have spent the last eight months building the platform
        we think is the most interesting thing to do with Qubic's
        compute substrate: AI infrastructure that runs on a Useful
        Proof of Work chain.
      </Para>
      <Para>
        The halving is the occasion. The platform is the work.
        Shipping the platform on a day when the network makes
        history felt like the right way to introduce it.
      </Para>

      <h2 className={H2_CLASS}>What Aigarth Cloud is, today</h2>
      <Para>
        Aigarth Cloud is not a landing page. It is a working
        platform. Here is what you can poke at end to end right
        now.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>12 services</strong> in production: identity,
          qubic, compute, gateway, billing, ann, marketplace,
          tissue, dataset, economy, training, and the new{" "}
          <em>work</em> runtime.
        </CheckBullet>
        <CheckBullet>
          <strong>7 primitives</strong> under one model: adaptive
          intelligence (the Organism), memory, evolution,
          experimentation, distributed computation, verification,
          and external reality. ADRs 005 through 007 govern the
          last three.
        </CheckBullet>
        <CheckBullet>
          <strong>600+ tests</strong> across the platform, with a
          4-minute CI loop, a dual-mode pg-mem harness, and zero
          regressions on the 200+ cases that predate the v0.2
          evolution.
        </CheckBullet>
        <CheckBullet>
          <strong>The Trinary Intelligence Layer</strong> in
          production: every <code>/decide</code> call returns a
          signed IntentEnvelope, the tissue service composes 5
          consensus policies, and the HMAC signature is auditable
          end to end.
        </CheckBullet>
        <CheckBullet>
          <strong>The Work Runtime</strong> (services/work, port
          7012): 5 tables, 13 routes, a 4-tier compute model, a
          v1 verification stack (replication plus challenge plus
          reputation), and an algorithm registry. The first
          registered algorithm is <code>awork_1</code>.
        </CheckBullet>
        <CheckBullet>
          <strong>AigarthPool</strong>: on-chain settlement with a
          QPI contract plus a TypeScript simulator, a 30/60/10
          default split, and a multi-sig treasury.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>The Qubic halving, in one paragraph</h2>
      <Para>
        Qubic emits a fixed 1 trillion QUBIC every week. That
        number does not change at Epoch 227. What changes is the
        share that gets burned.
      </Para>
      <Para>
        Until now, the burn rate is 55 percent. From Epoch 227,
        it rises to 77.5 percent. Effective supply entering
        circulation falls from roughly 450 billion to 225 billion
        QUBIC per week.
      </Para>
      <Para>
        The faucet does not shrink. The drain grows. That is the
        shape of the halving on a chain where gross issuance is
        fixed.
      </Para>

      <h2 className={H2_CLASS}>The interesting question</h2>
      <Para>
        Qubic has always interested us because of the question
        underneath the technology: what does a network become
        when computation itself is a first-class resource, not a
        side effect of a payments ledger?
      </Para>
      <Para>
        That is the territory Aigarth Cloud is built in. Useful
        Proof of Work, sub-second finality, zero transaction
        fees, native ANN execution. A substrate that is
        productive from day one, not after a settlement.
      </Para>
      <Para>
        Aigarth Cloud is the question put in public, with a
        working surface attached.
      </Para>

      <h2 className={H2_CLASS}>From blockchain to compute substrate</h2>
      <Para>
        The clearest way to think about Aigarth Cloud is not as
        a blockchain application. It is as a compute substrate
        coordinated by a chain. Three things in production
        today make that concrete.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Useful Proof of Work</strong> means the work
          the chain does is real work. The Work Runtime routes
          work items to workers, runs the algorithm, verifies
          the result, and bills the payer. The chain is not a
          meter. It is a doer.
        </CheckBullet>
        <CheckBullet>
          <strong>Sub-second finality</strong> means a work-item
          result can be settled the moment it is verified. No
          waiting for block confirmations. No stale results. The
          economy is the work.
        </CheckBullet>
        <CheckBullet>
          <strong>Zero transaction fees</strong> means
          micro-pricing of work becomes possible. A /decide call
          that takes 80ms of compute can be priced, settled, and
          audited without the fee eating the work.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>Why we are marking the moment, not the launch</h2>
      <Para>
        Aigarth Cloud is not launching today. It has been
        building for eight months, across 27 phases, on 12
        services. The Work Runtime shipped last week. The Trinary
        Intelligence Layer shipped earlier in August. The
        marketplace shipped in the summer. The Phase 27 deploy
        to lucidmindlabs shipped the week before.
      </Para>
      <Para>
        What is happening today is a public marker. The thing
        inside the doorway has been there for a while. The
        halving is the moment we put on it.
      </Para>
      <Para>
        We could have waited for a cleaner narrative. We could
        have shipped a longer roadmap first. We did not, on
        purpose. The platform should earn the right to a moment
        by being real, not by being loud.
      </Para>

      <h2 className={H2_CLASS}>What is next, in real dates</h2>
      <Para>
        The roadmap is on the site. The next two phases that
        matter for the Qubic thesis:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Phase 28, Q4 2026: Federated workers.</strong>{" "}
          Workers that live in your data center, on your laptop,
          on a partner's network. Cross-deployment reputation.
          The first tier where Aigarth Cloud runs outside our
          own infrastructure.
        </CheckBullet>
        <CheckBullet>
          <strong>Phase 29, Q1 2027: OC processor.</strong> The
          Qubic on-chain processor reads Organism work items
          and commits 451-of-676 computor signatures. Real
          on-chain verification, not a mock. This is the phase
          where the Work Runtime stops being Qubic-aware and
          starts being Qubic-native.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>A community question (a real one)</h2>
      <Para>
        We are not asking whether Aigarth Cloud should support
        AI inference. It does. We are not asking whether it
        should expose compute. It does. We are not asking
        whether there should be an ANN marketplace. There is.
      </Para>
      <Para>
        The two questions we are asking on Epoch 227:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>What should the OC processor compute first?</strong>{" "}
          When Phase 29 ships, the OC processor will pick work
          items. The first 10 registered work algorithms shape
          what the network becomes. We want the Qubic community
          to nominate them.
        </CheckBullet>
        <CheckBullet>
          <strong>What is the v1 dispute resolution policy?</strong>{" "}
          Today, when three replicas disagree, the worker with
          the highest reputation wins. That is a default, not a
          verdict. The first real dispute will surface what is
          actually fair. We want a community signal before
          that lands.
        </CheckBullet>
      </ul>
      <Para>
        Two questions, both with a real answer to ship. Tell us
        what you think.
      </Para>

      <h2 className={H2_CLASS}>The marker</h2>
      <Para>
        Epoch 227 is a marker for Qubic. We are using it as a
        marker for Aigarth Cloud, too. The platform is the
        work. The moment is the day. The community question is
        the next step.
      </Para>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="https://aigarthcloud.lucidmindlabs.com">
          <Button size="lg" className="gap-1.5">
            Explore Aigarth Cloud
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/contact">
          <Button size="lg" variant="outline">
            Tell us what to ship next
          </Button>
        </Link>
      </div>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Post 8: From registry to execution — the Execution Router
// ---------------------------------------------------------------------------

const post8: Post = {
  slug: "execution-router-ann-to-qubic-oc",
  title: "From registry to execution: shipping the Execution Router",
  excerpt:
    "A registered ANN can now run locally or through Qubic OC, with the same manifest hash, the same input, and a deterministic result hash. Here is what we built and why it is the bridge to a real decentralized compute economy.",
  category: "Engineering",
  author: "Aigarth Cloud Team",
  date: "Aug 28, 2026",
  readTime: "8 min",
  Body: () => (
    <article>
      <div className={LABEL_CLASS}>PHASE 29</div>
      <p className="mt-2 text-pretty text-lg leading-relaxed text-foreground/90">
        For the last eight months, an Aigarth Cloud ANN was a
        record in a registry. You could browse it, deploy it,
        version it, and rate it. What you could not do, until
        this week, is run the same ANN two different ways and
        prove which result came from which execution. That
        changes today.
      </p>

      <h2 className={H2_CLASS}>The shape of the problem</h2>
      <Para>
        A registry is a list of promises. A platform is the
        thing that makes the promises run. The bridge from
        "this ANN exists" to "this ANN ran, here is the result,
        here is the proof" is what the Execution Router is.
      </Para>
      <Para>
        The router is small. The contract is:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Same ANN, two executors.</strong> A user picks
          <em> Local </em> or <em>Qubic OC</em>. The router
          dispatches. A failed OC execution is visibly failed:
          no silent fallback to local.
        </CheckBullet>
        <CheckBullet>
          <strong>Same input, deterministic result hash.</strong>{" "}
          Anyone with the manifest, the version, the input,
          and the output can re-derive the hash and confirm
          "this result came from this exact ANN version using
          this exact input."
        </CheckBullet>
        <CheckBullet>
          <strong>Same identity across both targets.</strong> The
          manifest is the canonical identity. The manifest hash
          is the version. The repository row is the provenance.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>What we built, in one diagram</h2>
      <Para>
        A registered ANN has a manifest. The manifest names an
        architecture. The architecture has an adapter. The
        adapter runs. The result is hashed. The hash is the
        proof. The proof is stored on the ANN execution row,
        alongside the work_id when the executor was Qubic OC.
      </Para>

      <pre className="mt-6 overflow-x-auto rounded-xl bg-muted/30 p-6 text-sm leading-relaxed"><code className="font-mono">{`   ANN
     │
     ▼
   ANNExecutionRequest
     │  manifest_hash + version + input + target
     ▼
   ExecutionRouter
     ├── target=local       → LocalANNExecutor  (in-process)
     └── target=qubic_oc    → QubicOCExecutor   → services/work`}</code></pre>

      <Para>
        The router does not know what an ANN does. It only
        knows which executor handles which target. The
        executor does the work. The result hash is computed
        by a single helper that knows the manifest hash, the
        version, the input hash, the target, and the
        canonicalised output.
      </Para>

      <h2 className={H2_CLASS}>The manifest is the identity</h2>
      <Para>
        An ANN is not its name, or its creator, or its
        repository. An ANN is its <em>manifest</em>. Two ANNs
        are the "same version" iff they have the same
        <code>manifestHash</code>, which is a sha256 of the
        canonicalised manifest. The manifest covers id, name,
        version (semver with a <code>v</code> prefix), creator,
        architecture, model hash, input and output schemas, an
        optional benchmark, a repository URL, a commit SHA, a
        license, and a description.
      </Para>
      <Para>
        The schema is strict. Unknown fields are rejected.
        Semver is enforced. The model hash is a 64-char
        lowercase hex string prefixed with <code>sha256:</code>.
        The 14 ANNs we seeded earlier this year do not all
        have manifests yet; the demo ANN we ship today does.
      </Para>

      <h2 className={H2_CLASS}>The local executor is honest</h2>
      <Para>
        The local executor runs the ANN's adapter in the
        current process. No network call, no OC layer. Same
        input + same manifest + same architecture always
        produces the same output. The result hash is
        deterministic.
      </Para>
      <Para>
        If no adapter is registered for the manifest's
        architecture, the executor falls back to a clearly
        labelled deterministic stub. The stub's output carries
        a <code>fixture: true</code> flag, so no caller can
        mistake it for a real inference. The verification
        status on a local run is always
        <code>local_deterministic</code>. We do not pretend
        that a local run is decentralised.
      </Para>

      <h2 className={H2_CLASS}>The Qubic OC executor is honest too</h2>
      <Para>
        The Qubic OC executor submits the execution to{" "}
        <code>services/work</code>, the Work Runtime. The
        Work Runtime was built earlier this year for arbitrary
        workloads with replication verification. The OC
        executor uses it as-is: the work item carries the
        manifest hash, the input, and the algorithm slug{" "}
        <code>aigarth-oc-algorithm</code>. The work service
        schedules it, assigns a worker, runs the algorithm,
        verifies the result, and returns the work_id.
      </Para>
      <Para>
        If the OC service is down, the executor throws. The
        route returns 503. The UI does not silently fall back
        to local. A failed decentralized execution must remain
        visibly failed. This is the rule we wrote down at the
        start of the project, and the rule we kept.
      </Para>

      <h2 className={H2_CLASS}>The Work Runtime is the engine, not a wrapper</h2>
      <Para>
        The Qubic OC executor is a thin HTTP client over{" "}
        <code>services/work</code>. We did not build a new
        execution engine; the Work Runtime was already
        designed for this. The new piece is a small
        INTERNAL_TOKEN-guarded endpoint on the Work Runtime
        (<code>POST /v1/internal/work/items</code>) that the
        ANN service calls with the user's identity. Same
        shape, same replication, same verifier. The OC executor
        is 200 lines of TypeScript.
      </Para>
      <Para>
        This is the path of least resistance we kept talking
        about. The Work Runtime existed. The algorithm
        registry existed. The verifier existed. The router
        just wires them together.
      </Para>

      <h2 className={H2_CLASS}>The OC processor package, in one breath</h2>
      <Para>
        The Execution Router is the outbound side: Aigarth
        submits an ANN execution to the Work Runtime. The
        inbound side is the OC processor: a Qubic smart
        contract calls Aigarth, the 451/676 computors sign,
        the result is signed and returned. We shipped the
        inbound side as a new package,{" "}
        <code>@aigarth/oc-processor</code>, with the
        rate-limit, circuit-breaker, signature-verify, and
        result-signer pieces.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>registerAsProcessor(manifest)</strong> wires a
          processor into the registry. The manifest is the
          contract with the Qubic network.
        </CheckBullet>
        <CheckBullet>
          <strong>onInvocation(handler)</strong> is the runtime
          hook. The handler maps the invocation to a work
          item, the Work Runtime executes it, the result is
          signed.
        </CheckBullet>
        <CheckBullet>
          <strong>3-layer rate limit</strong> (per-caller,
          per-processor, per-epoch) and a circuit breaker
          (CLOSED, OPEN, HALF_OPEN) borrowed from the
          AigarthPool M3/M4 patterns.
        </CheckBullet>
        <CheckBullet>
          <strong>451/676 signature verify</strong> is shipped
          as a structural check in v1. The real Ed25519
          verify is Phase 30+, behind the ADR 007 production
          gate.
        </CheckBullet>
      </ul>
      <Para>
        The OC processor's mainnet exposure requires a
        security review and a public testnet validation. The
        mechanism is built. The gate is the gate.
      </Para>

      <h2 className={H2_CLASS}>The UI is a real vertical slice</h2>
      <Para>
        The web app now has a <code>/anns/[slug]</code> page
        that fetches the ANN's manifest, the published
        repository, and the execution history. The Run panel
        has a target picker (Local, Qubic OC), a JSON input
        editor, a Run button that posts to{" "}
        <code>/api/anns/[slug]/execute</code>, and a polling
        loop that watches the execution reach a terminal
        state. The history table shows the last 20 runs with
        the verification status and the result hash.
      </Para>
      <Para>
        The dashboard has a new <code>/ann-execution</code>{" "}
        page: the operator view of every ANN, every run,
        every verification, every work_id. The OC processor
        dashboard is at <code>/oc</code>, empty for now
        (the registry hydrates when the operator boots it in
        the gateway; Phase 30+ persists it).
      </Para>

      <h2 className={H2_CLASS}>The demo ANN is on purpose trivial</h2>
      <Para>
        The demo is the BTC Direction Predictor v1. The
        architecture is a 5-day momentum rule on a 30-day
        price window. The adapter sums the last close minus
        the close from 5 days ago, normalises by the mean
        price, and emits <code>up</code>, <code>down</code>,
        or <code>flat</code>. It is not a real model. It is
        the smallest thing that exercises the entire
        pipeline end-to-end:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>Manifest</strong>: id, version, architecture,
          input/output schemas, model hash, repository, commit,
          license.
        </CheckBullet>
        <CheckBullet>
          <strong>Adapter</strong>: registered at boot, called
          by the local executor.
        </CheckBullet>
        <CheckBullet>
          <strong>Repository row</strong>: synthetic commit SHA
          from the manifest hash, kind <code>seed</code>, with
          a <code>releaseUrl</code> that encodes the
          architecture so the executor can find the adapter.
        </CheckBullet>
        <CheckBullet>
          <strong>Local run</strong>: deterministic, fast,
          returns the prediction in milliseconds.
        </CheckBullet>
        <CheckBullet>
          <strong>OC run</strong>: submits to the Work
          Runtime, polls until verified, returns the work_id
          and the result hash.
        </CheckBullet>
        <CheckBullet>
          <strong>Result hash</strong>: identical for both
          targets when the algorithm is deterministic. The
          OC executor uses the{" "}
          <code>deterministic</code> verification method
          (single re-run, not 3-way replication).
        </CheckBullet>
      </ul>
      <Para>
        The BTC Direction Predictor exists to prove the
        pipeline works. It is not a product. A real
        predictor would be an MLP or a transformer. The
        fixture is the canary.
      </Para>

      <h2 className={H2_CLASS}>What we did not build (on purpose)</h2>
      <Para>
        Three things are deferred, and we are being explicit
        about them so no one reads the UI and assumes more
        is operational than it is.
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>GitHub publishing is a stub.</strong> The
          <code>POST /v1/anns/:idOrSlug/github-publish</code>{" "}
          route returns <code>not_configured</code> with a
          pointer to the env vars an operator needs to set.
          The seed attaches a synthetic repository row
          directly. The real GitHub App wire-up is Phase 30+,
          after the security review.
        </CheckBullet>
        <CheckBullet>
          <strong>The OC processor is not exposed as a
          public HTTPS endpoint.</strong> The package is a
          library. The gateway wire-up is Phase 30+.
        </CheckBullet>
        <CheckBullet>
          <strong>Economic policy runtime is schema-only.</strong>{" "}
          The <code>ann_economic_policies</code> and{" "}
          <code>ann_epochs</code> tables ship. The runtime
          that uses them is Phase 9/10 work, after the
          execution primitive is stable.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>Numbers for the engineers</h2>
      <Para>
        This delivery touches four services, one new package,
        one new migration, and one new public page. The
        breakdown:
      </Para>
      <ul className={UL_CLASS}>
        <CheckBullet>
          <strong>services/ann</strong>: 1 migration (0008),
          4 new tables (<code>ann_executions</code>,{" "}
          <code>ann_repositories</code>,{" "}
          <code>ann_economic_policies</code>,{" "}
          <code>ann_epochs</code>), 5 new routes
          (<code>execute</code>, <code>executions</code>,{" "}
          <code>executions/:id</code>, <code>repositories</code>,{" "}
          <code>github-publish</code>), the Execution Router
          + 2 executors + the result-hash helper + the
          adapter registry + the BTC demo adapter + the
          execution service + the manifest types.
        </CheckBullet>
        <CheckBullet>
          <strong>services/work</strong>: 1 new internal route
          (<code>POST /v1/internal/work/items</code>) +
          (<code>GET /v1/internal/work/items/:work_id</code>),
          the canonical <code>serializeWorkItem</code>{" "}
          exported for cross-service callers.
        </CheckBullet>
        <CheckBullet>
          <strong>packages/oc-processor</strong>: the new
          package — types, canonicalisation, signature
          verify, rate limit, circuit breaker, result
          signer, work-runtime integration, registry, the
          full pipeline.
        </CheckBullet>
        <CheckBullet>
          <strong>packages/sdk</strong>: new{" "}
          <code>anns.execute</code>,{" "}
          <code>anns.listExecutions</code>,{" "}
          <code>anns.getExecution</code>,{" "}
          <code>anns.listRepositories</code>; new{" "}
          <code>OcProcessors</code> resource for the inbound
          side.
        </CheckBullet>
        <CheckBullet>
          <strong>apps/web</strong>: new{" "}
          <code>/anns/[slug]</code> page with the Run panel,
          three server proxies, the demo BTC seed.
        </CheckBullet>
        <CheckBullet>
          <strong>apps/dashboard</strong>: new{" "}
          <code>/ann-execution</code> and{" "}
          <code>/ann-execution/[slug]</code> pages, new{" "}
          <code>/oc</code> page, the SDK adapter.
        </CheckBullet>
        <CheckBullet>
          <strong>docs</strong>: new{" "}
          <code>docs/ann-execution/README.md</code>, new{" "}
          <code>docs/oc-processor/README.md</code>, full
          phase delivery report.
        </CheckBullet>
        <CheckBullet>
          <strong>Tests</strong>: 37 new tests in the
          oc-processor package, 38 new tests in services/ann
          (manifest, result-hash, router, BTC adapter,
          executions service). All pass; the existing 200+ in
          the ANN service still pass.
        </CheckBullet>
      </ul>

      <h2 className={H2_CLASS}>The bridge we crossed</h2>
      <Para>
        Aigarth Cloud can now take an ANN from a developer's
        machine, give it a permanent identity, publish it
        openly, send it into the Work Runtime, and return a
        verifiable result. The GitHub publish is the only
        piece that is still a stub, and the manifest hash
        carries the identity regardless of where the
        artifact is stored.
      </Para>
      <Para>
        The end state is no longer "an AI website." The
        platform deploys intelligence into a decentralized
        compute economy. The router is the seam between
        "I built an ANN" and "the network ran it, and here
        is the proof."
      </Para>
      <Para>
        That is the bridge. The next one is the
        marketplace: staking, creator rewards, governance,
        and the economic policy runtime. Phase 30+.
      </Para>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/anns/btc-direction-predictor">
          <Button size="lg" className="gap-1.5">
            Run the demo ANN
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/dashboard/ann-execution">
          <Button size="lg" variant="outline">
            Open the operator dashboard
          </Button>
        </Link>
      </div>
    </article>
  ),
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const POSTS: Post[] = [post1, post2, post3, post4, post5, post6, post7, post8];

export const POSTS_BY_SLUG: Record<string, Post> = Object.fromEntries(
  POSTS.map((p) => [p.slug, p]),
);
