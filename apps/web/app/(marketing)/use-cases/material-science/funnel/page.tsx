import {
  Atom,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  Coins,
  FlaskConical,
  Lightbulb,
  PencilRuler,
  ShieldCheck,
  Sparkles,
  TestTube,
  TrendingUp,
  Zap,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Code2,
  Server,
  Sprout,
  Users,
} from "lucide-react";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Button, Badge } from "@aigarth/ui";
import { StakeButton } from "@/components/stake";
import Link from "next/link";

export const metadata = {
  title: "Stake to fund material discovery: Aigarth material science ANNs",
  description:
    "8 specialized material science ANNs are live. Stake QUBIC to fund the next cathode, catalyst, or polymer discovery. A research plan in, a lab protocol out.",
};

// =============================================================================
//  Static manifest: mirrors services/ann/src/db/seed-anns.ts (Phase 17 stub)
// =============================================================================

type Ann = {
  slug: string;
  name: string;
  role: string;
  tagline: string;
  accuracy: number;
  latencyMs: number;
  pricePerCall: string;
  stakeRequired: string;
  license: "Open" | "Commercial";
  icon: React.ComponentType<{ className?: string }>;
};

const ANNS: Ann[] = [
  {
    slug: "mat-research-director",
    name: "Research Director",
    role: "director",
    tagline: "Plan a material discovery workflow from a research question.",
    accuracy: 94.5,
    latencyMs: 2000,
    pricePerCall: "0.00005",
    stakeRequired: "3M QUBIC",
    license: "Open",
    icon: Compass,
  },
  {
    slug: "mat-literature-ingester",
    name: "Literature Ingester",
    role: "literature",
    tagline: "Ingest scientific papers into a structured knowledge graph.",
    accuracy: 91.2,
    latencyMs: 5000,
    pricePerCall: "0.0001",
    stakeRequired: "2M QUBIC",
    license: "Open",
    icon: BookOpen,
  },
  {
    slug: "mat-simulation-runner",
    name: "Simulation Runner",
    role: "simulation",
    tagline: "Run DFT, MD, or ML surrogate simulations for material properties.",
    accuracy: 88.6,
    latencyMs: 60000,
    pricePerCall: "0.0005",
    stakeRequired: "15M QUBIC",
    license: "Commercial",
    icon: Atom,
  },
  {
    slug: "mat-physics-reasoner",
    name: "Physics Reasoner",
    role: "physics",
    tagline: "Sanity-check a simulation result against first principles.",
    accuracy: 96.8,
    latencyMs: 200,
    pricePerCall: "0.00002",
    stakeRequired: "1M QUBIC",
    license: "Open",
    icon: Zap,
  },
  {
    slug: "mat-material-designer",
    name: "Material Designer",
    role: "design",
    tagline: "Generate candidate materials for a target property profile.",
    accuracy: 87.4,
    latencyMs: 30000,
    pricePerCall: "0.0002",
    stakeRequired: "8M QUBIC",
    license: "Commercial",
    icon: PencilRuler,
  },
  {
    slug: "mat-multi-obj-optimizer",
    name: "Multi-Objective Optimizer",
    role: "optimization",
    tagline: "Pareto-sort candidates on (energy density, cost, cycle life).",
    accuracy: 93.0,
    latencyMs: 100,
    pricePerCall: "0.00005",
    stakeRequired: "2M QUBIC",
    license: "Open",
    icon: TrendingUp,
  },
  {
    slug: "mat-experiment-planner",
    name: "Experiment Planner",
    role: "experiment",
    tagline: "Convert a candidate material into a synthesizable lab protocol.",
    accuracy: 90.5,
    latencyMs: 2000,
    pricePerCall: "0.00005",
    stakeRequired: "4M QUBIC",
    license: "Commercial",
    icon: TestTube,
  },
  {
    slug: "mat-validation-engine",
    name: "Validation Engine",
    role: "validation",
    tagline: "Cross-check a prediction against literature and historical data.",
    accuracy: 95.2,
    latencyMs: 800,
    pricePerCall: "0.00005",
    stakeRequired: "2M QUBIC",
    license: "Open",
    icon: ShieldCheck,
  },
];

const PARTICIPATION_TIERS = [
  {
    name: "Pioneer",
    icon: Sprout,
    desc: "Foundational staker. The earliest way to participate.",
    highlight: "For people who want to be part of the founding moment.",
    cta: "Start as a Pioneer",
  },
  {
    name: "Builder",
    icon: Code2,
    desc: "Developer / researcher. Earn allocation, deploy material science ANNs, get marketplace priority.",
    highlight: "For people who will build and run on the network.",
    cta: "Become a Builder",
    featured: true,
  },
  {
    name: "Infrastructure Partner",
    icon: Server,
    desc: "Node operator. Register a DFT or MD worker, earn per simulation.",
    highlight: "For HPC labs with idle compute.",
    cta: "Become a Partner",
  },
  {
    name: "Enterprise Partner",
    icon: Building2,
    desc: "Organization. Private infrastructure, dedicated support, custom SLAs.",
    highlight: "For research institutions and corporate R&D.",
    cta: "Talk to us",
  },
];

export default function MaterialScienceStakeFunnelPage() {
  return (
    <>
      <MarketingPageHero
        badge="Material science · 8 ANNs live · Phase 0"
        title="Stake to fund the next material discovery."
        highlight="Research plan in. Lab protocol out."
        description="Eight specialized material science ANNs are live in the Aigarth marketplace today. A research question becomes a 5-stage plan, a DFT-validated candidate, and a printable lab protocol. Stake QUBIC to participate in the network, and in the revenue when a discovery ships."
      />

      <div className="container-wide border-b py-10">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <StakeButton
              size="lg"
              context={{
                label: "Aigarth material discovery",
                purpose:
                  "Fund the next material discovery. ~1,000 QUBIC / month covers ~20 cathode discoveries.",
                minStakeQubic: 1_000_000_000,
                successHref: "/dashboard",
              }}
              defaultAmount="1000M"
            >
              <Coins className="mr-2 h-4 w-4" />
              Stake QUBIC on Qubic
            </StakeButton>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/material-science" target="_blank" rel="noreferrer">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Open the case study
            </Link>
          </Button>
        </div>
      </div>

      {/* ============ The 8 ANNs ============ */}
      <Section
        title="The team"
        description="Eight small, specialized ANNs collaborate to discover and validate a new material. Each is published, versioned, rateable, and live in the Aigarth marketplace today."
      >
        <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ANNS.map((ann) => {
            const Icon = ann.icon;
            return (
              <div
                key={ann.slug}
                className="group rounded-xl border bg-card p-4 transition-colors hover:border-garden-500/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-md border bg-background/50 p-1.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge
                    variant={ann.license === "Open" ? "success" : "warning"}
                    className="text-[9px]"
                  >
                    {ann.license}
                  </Badge>
                </div>
                <div className="mt-2.5 text-sm font-medium">{ann.name}</div>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{ann.tagline}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-2 text-[10px] text-muted-foreground">
                  <div>
                    <div>Accuracy</div>
                    <div className="font-mono text-foreground">{ann.accuracy.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div>Price / call</div>
                    <div className="font-mono text-foreground">{ann.pricePerCall} QU</div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  Stake to deploy: <span className="font-mono text-foreground">{ann.stakeRequired}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          All 8 are running on the Aigarth stub backend. Every deploy, stake, and call is
          recorded. The <code className="rounded bg-muted px-1 py-0.5">format-only</code>{" "}
          signature on each version is the Phase 0 placeholder: real K12 signatures
          ship once the Qu bic verification milestone lands.
        </p>
      </Section>

      {/* ============ The math ============ */}
      <Section
        title="The math"
        description="Real numbers from the Phase 17 architecture evaluation. Every cost and every revenue share is visible before you commit."
      >
        <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
          {[
            {
              stat: "~52 QU",
              label: "Cost of a single 'find a battery cathode' workflow",
              sub: "DFT refinement dominates at 87% of the total.",
            },
            {
              stat: "~1,000 QU / mo",
              label: "Stake to fund ~20 discoveries per month",
              sub: "A monthly reservation, billed per workflow.",
            },
            {
              stat: "30% / 50% / 10% / 10%",
              label: "Revenue share: stakers / workers / creators / treasury",
              sub: "Stakers get 30%. A 1,000 QU/month stake earns 0.3 × network revenue.",
            },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border bg-card p-5">
              <div className="font-mono text-2xl tabular-nums text-garden-600 dark:text-garden-400">
                {c.stat}
              </div>
              <div className="mt-2 text-sm font-medium">{c.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          Numbers are illustrative Phase 0 placeholders. They will be updated as we ship
          and measure. The cost structure matters more than the number. A researcher can
          always see the per-stage breakdown before committing.
        </p>
      </Section>

      {/* ============ How a discovery flows ============ */}
      <Section
        title="How a discovery flows"
        description="A research question becomes a plan. Each stage consumes the plan and produces an artifact. The Physics Reasoner in the middle decides whether to flag a stage for re-run."
      >
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
              {["question", "Director", "Literature", "Design", "Simulation", "Physics", "Optimize", "Experiment", "Validation", "candidate"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-3 py-1.5 font-mono ${
                      s === "candidate" || s === "question"
                        ? "border-garden-500/30 bg-garden-500/5"
                        : "bg-background"
                    }`}
                  >
                    {s}
                  </span>
                  {i < 9 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Every stage emits a structured prediction with uncertainty.
              A bad stage can be re-run alone. The rest of the workflow is preserved.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-6 grid max-w-4xl gap-3 md:grid-cols-3">
          {[
            {
              title: "Pre-flight estimate",
              body: "The Director's plan includes a per-stage cost + duration. The user must confirm before the workflow starts. No $1,000 surprise at the end.",
            },
            {
              title: "MLIP surrogate first",
              body: "The Simulation Runner routes through a fast ML surrogate (MACE) before paying for full DFT. Cuts wall time by 10× and cost by ~9×.",
            },
            {
              title: "Input-deck caching",
              body: "The same simulation is never paid for twice. The orchestrator hashes the input deck and serves from cache.",
            },
          ].map((p) => (
            <div key={p.title} className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-garden-500" />
                {p.title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ============ Attribution ============ */}
      <Section
        title="Real attribution, on chain"
        description="When a material discovery is published, the on-chain attribution is fixed immediately. That's what makes it useful as a real citation in a real research paper."
      >
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-md border border-amber-500/30 bg-background/50 p-2">
                <Lightbulb className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <div className="text-sm font-medium">discovery_attribution contract</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  A new Qubic primitive that ships in Phase 4. The publish action is{" "}
                  <strong>one-way and immediate</strong>: not via daily rollup. Once a
                  material is published, the ANN authors, the workers who ran the
                  simulations, the researchers who funded the work, and the stakers
                  who backed the network are all recorded. Immutable. Citable.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  The same primitive will be reusable for other high-stakes use cases
                 : drug discovery, clinical trials, regulatory submissions. The
                  architecture stands to benefit more than just material science.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ============ Why this fits the existing stack ============ */}
      <Section
        title="Why this fits the existing Aigarth stack"
        description="258 story points and 7 backend services already ship. The 8 material science ANNs run on the same infrastructure that powers the rest of the marketplace. No new architecture."
      >
        <FeatureGrid
          features={[
            {
              icon: Server,
              title: "services/ann: registry, versioning, reviews, deploy",
              body: "All 8 ANNs are published, versioned, rateable, and deployable as compute jobs. Same as the other 6 ANNs in the marketplace today.",
            },
            {
              icon: Users,
              title: "services/marketplace: listings, offers, auctions",
              body: "License the whole 8-ANN workflow as a single pre-composed 'Battery Cathode Discovery Pack' listing. Pay per call, or per workflow.",
            },
            {
              icon: Sparkles,
              title: "services/gateway: LLM call routing",
              body: "Director, Literature, Experiment Planner route through the OpenAI-compatible gateway. Real LLM today, stub during Phase 0.",
            },
            {
              icon: Coins,
              title: "services/qubic: Qearn staking, on-chain registry",
              body: "Stake QUBIC on Qubic → Aigarth credit balance → per-workflow deduction. Revenue share flows back to stakers via Qearn.",
            },
          ]}
        />
      </Section>

      {/* ============ Stake to participate ============ */}
      <Section
        title="Stake to participate"
        description="Four ways to join. Most material science researchers and computational labs start with the Builder or Infrastructure Partner tier."
      >
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PARTICIPATION_TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.name}
                className={`rounded-xl border p-5 ${
                  tier.featured
                    ? "border-garden-500/30 bg-garden-500/5"
                    : "bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-garden-600 dark:text-garden-400" />
                  <span className="text-sm font-semibold">{tier.name}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{tier.desc}</p>
                <p className="mt-3 text-xs text-foreground/80">{tier.highlight}</p>
                <StakeButton
                  size="sm"
                  className="mt-4 w-full"
                  context={{
                    label: `Aigarth ${tier.name} participation`,
                    purpose:
                      tier.name === "Builder"
                        ? "Earn allocation, deploy material science ANNs, get marketplace priority."
                        : tier.name === "Infrastructure Partner"
                        ? "Register a DFT or MD worker, earn per simulation."
                        : tier.name === "Enterprise Partner"
                        ? "Private infrastructure, dedicated support, custom SLAs."
                        : "Foundational staker. The earliest way to participate.",
                    minStakeQubic:
                      tier.name === "Pioneer"
                        ? 10_000_000 // 10M: Qearn minimum
                        : tier.name === "Builder"
                        ? 100_000_000 // 100M
                        : tier.name === "Infrastructure Partner"
                        ? 1_000_000_000 // 1B
                        : 10_000_000_000, // 10B: Enterprise
                    successHref: "/dashboard",
                  }}
                  defaultAmount={
                    tier.name === "Pioneer"
                      ? "10M"
                      : tier.name === "Builder"
                      ? "100M"
                      : tier.name === "Infrastructure Partner"
                      ? "1000M"
                      : "10000M"
                  }
                >
                  {tier.cta}
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </StakeButton>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          All four tiers run through the Aigarth Genesis Offering at{" "}
          <Link href="https://qubic.org/genesis" className="underline" target="_blank" rel="noreferrer">
            qubic.org/genesis
          </Link>
          . Material science participants get marketplace priority placement and
          0% commission on the first 1,000 workflows (Phase 0 promo).
        </p>
      </Section>

      {/* ============ Roadmap ============ */}
      <Section
        title="What ships next"
        description="5 phases, 84 story points estimated total. Phase 0 is done: 8 ANNs live as stubs. Re-evaluation gate at the end of Phase 1."
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {[
            {
              phase: 0,
              name: "Documentation + 8 stub ANNs (live now)",
              status: "current",
              desc: "8 specialized ANNs registered, listed in the marketplace, deployable as jobs. Real LLM, synthetic compute.",
            },
            {
              phase: 1,
              name: "Knowledge prototype",
              status: "next",
              desc: "Ingest 1,000 papers, answer a research question in < 5 min. Director + Literature real. Rest still stubs.",
            },
            {
              phase: 2,
              name: "Simulation integration",
              status: "later",
              desc: "DFT, MD, MLIP workers. End-to-end material discovery. ~52 QU per workflow, ~102 h on 1× CPU.",
            },
            {
              phase: 3,
              name: "ANN marketplace",
              status: "later",
              desc: "Per-ANN quality ranking, 'Battery Cathode Discovery Pack' pipeline listing, reviews + ratings.",
            },
            {
              phase: 4,
              name: "Distributed research network",
              status: "later",
              desc: "On-chain ANN ownership, worker registry, reputation, rewards, and the new discovery_attribution contract.",
            },
          ].map((p) => {
            const isCurrent = p.status === "current";
            const isNext = p.status === "next";
            return (
              <div
                key={p.phase}
                className={`rounded-xl border p-5 ${
                  isCurrent
                    ? "border-amber-500/40 bg-amber-500/5"
                    : isNext
                    ? "border-garden-500/30 bg-garden-500/5"
                    : "bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">Phase {p.phase}</span>
                  <span className="text-sm font-medium">{p.name}</span>
                  {isCurrent && <Badge variant="warning">In progress</Badge>}
                  {isNext && <Badge variant="glow">Next</Badge>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ============ Final CTA ============ */}
      <Section
        title="Stake. Train. Discover."
        description="The 8 ANNs are live today on stubs. The Phase 1 knowledge prototype is the first real gate. Stake to be part of the founding moment, and to participate in the revenue when the first discovery ships."
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <StakeButton
              size="lg"
              context={{
                label: "Aigarth material discovery",
                purpose:
                  "Fund the next material discovery. ~1,000 QUBIC / month covers ~20 cathode discoveries.",
                minStakeQubic: 1_000_000_000,
                successHref: "/dashboard",
              }}
              defaultAmount="1000M"
            >
              <Coins className="mr-2 h-4 w-4" />
              Stake QUBIC on Qubic
            </StakeButton>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="http://localhost:3003/use-cases/material-science" target="_blank" rel="noreferrer">
              Read the full case study
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="http://localhost:4000/material-science" target="_blank" rel="noreferrer">
              Open the build-in-public tracker
            </Link>
          </Button>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
          This page is part of the Aigarth Cloud Genesis Offering. Numbers are
          illustrative Phase 0 placeholders that will change as we ship and measure.
          The dashboard at localhost:4000/material-science is the source of truth
          for what is real today.
        </p>
      </Section>
    </>
  );
}
