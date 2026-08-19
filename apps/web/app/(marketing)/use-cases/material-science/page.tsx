import {
  Atom,
  Compass,
  BookOpen,
  Zap,
  PencilRuler,
  TrendingUp,
  FlaskConical,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  TrendingUp as TrendingUpIcon,
  ExternalLink,
  Lightbulb,
  GitBranch,
  Server,
  Cpu,
  Inbox,
  TestTube,
  Sparkles,
  CircleCheck,
} from "lucide-react";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Button, Badge } from "@aigarth/ui";
import { StakeButton } from "@/components/stake";
import Link from "next/link";

export const metadata = {
  title: "Use case: Aigarth Cloud as a collaborative ANN lab for material science",
  description:
    "Eight small, specialized AIs, including Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation, all collaborating to help a materials research lab discover new materials faster, without trying to replace the scientist.",
};

type Role = {
  slug: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ROLES: Role[] = [
  {
    slug: "director",
    name: "Research Director",
    description: "Reads the research question, plans the workflow. Returns a structured JSON describing stages, costs, time, and constraints.",
    icon: Compass,
  },
  {
    slug: "literature",
    name: "Literature",
    description: "Ingests scientific papers. Extracts composition, property values, measurement method, citation. Builds a knowledge graph.",
    icon: BookOpen,
  },
  {
    slug: "simulation",
    name: "Simulation",
    description: "Runs the actual science. DFT relaxation (VASP, Q-E), molecular dynamics (LAMMPS, GROMACS), or fast ML surrogates (MACE).",
    icon: Atom,
  },
  {
    slug: "physics",
    name: "Physics Reasoning",
    description: "Sanity-checks predictions against first principles. Catches impossible structures and runaway formation energies.",
    icon: Zap,
  },
  {
    slug: "design",
    name: "Material Design",
    description: "Generates candidate materials. New alloys, new polymers, new battery cathodes. Output is a structure + predicted property + uncertainty.",
    icon: PencilRuler,
  },
  {
    slug: "optimization",
    name: "Optimization",
    description: "Finds the best tradeoff. Multi-objective Pareto on (energy density, cost, cycle life, environmental impact, ...).",
    icon: TrendingUp,
  },
  {
    slug: "experiment",
    name: "Experiment Planning",
    description: "Converts a candidate material into a lab protocol. Synthesize by solid-state reaction at 950 °C for 12 h. XRD, SEM, cycling.",
    icon: FlaskConical,
  },
  {
    slug: "validation",
    name: "Validation",
    description: "Compares predictions against reality. Cross-checks against literature. Logs the result so the next iteration starts from a better baseline.",
    icon: ShieldCheck,
  },
];

const COMPATIBILITY = [
  {
    label: "ANN compatibility",
    score: "8/10",
    verdict: "Extend",
    summary: "Registry, versioning, reviews, marketplace listings, deploy hook: all ready. Add `material_domain` enum, knowledge-graph tables, and 9 new endpoints under `/v1/materials/*`.",
  },
  {
    label: "Compute architecture",
    score: "6/10",
    verdict: "Extend",
    summary: "services/compute is task-agnostic. A DFT relaxation is a job like a video render. But material science is 50–100× more expensive, needs GPU as a first-class resource, and requires capability-tagged workers.",
  },
  {
    label: "Continuous learning",
    score: "5/10",
    verdict: "Greenfield",
    summary: "No per-ANN quality signals today. Material science adds per-prediction provenance, validation against experiments, uncertainty calibration, and *negative* results as first-class signals.",
  },
  {
    label: "Qubic integration",
    score: "9/10",
    verdict: "Blocked",
    summary: "Qubic's outsourced-computing contract is *especially* suited to material science. Same K12 signature verification blocker as the video proposal: solve once, reuse.",
  },
];

const ROADMAP = [
  {
    phase: 0,
    name: "Documentation",
    status: "in_progress",
    desc: "Architecture evaluation, blog article, dashboard, tracker. No code in production.",
  },
  {
    phase: 1,
    name: "Knowledge prototype",
    status: "next",
    desc: "Paper ingestion + knowledge graph + research-question answering. No simulation. Re-evaluation gate: 1,000 papers ingested, answer in < 5 min.",
  },
  {
    phase: 2,
    name: "Simulation integration",
    status: "later",
    desc: "Wire up DFT, MD, and MLIP workers. End-to-end material discovery. ~52 QU per workflow, ~102 h wall-clock on 1× CPU.",
  },
  {
    phase: 3,
    name: "ANN marketplace",
    status: "later",
    desc: "Publish the 8 ANNs as real listings. Per-ANN quality ranking. Reviews and ratings flow into the feedback table.",
  },
  {
    phase: 4,
    name: "Distributed research network",
    status: "later",
    desc: "On-chain ANN ownership, worker registry, reputation, rewards, and `discovery_attribution`. Off-chain rollups + one-way publish.",
  },
];

export default function UseCaseMaterialSciencePage() {
  return (
    <>
      <MarketingPageHero
        badge="Use case · Phase 0 in progress"
        title="Material science, but with a team."
        highlight="Eight specialists, one research plan."
        description="A small Research Director ANN plans the workflow. Then Literature, Simulation, Physics, Design, Optimization, Experiment, and Validation ANNs do their part. Each is published, versioned, and rateable in the Aigarth marketplace. This page is the build-in-public view of the proposal."
      />

      <div className="container-wide border-b py-10">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="http://localhost:4000/material-science" target="_blank" rel="noreferrer">
              View live dashboard
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/docs/use-case-material-science" target="_blank" rel="noreferrer">
              Read the architecture evaluation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/docs/use-case-material-science-proposal" target="_blank" rel="noreferrer">
              <Inbox className="mr-2 h-4 w-4" />
              Original proposal
            </Link>
          </Button>
        </div>
      </div>

      <Section
        title="The team"
        description="Eight small, specialized ANNs collaborate to discover and validate a new material. Each one excellent at exactly one part of the research workflow."
      >
        <FeatureGrid
          features={ROLES.map((r) => ({
            icon: r.icon,
            title: r.name,
            body: r.description,
          }))}
        />
      </Section>

      <Section
        title="How a discovery flows"
        description="A research question becomes a plan. Each stage consumes the plan and produces an artifact. The Physics Reasoning ANN in the middle decides whether to flag a stage for re-run."
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
                  {i < 9 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Every stage emits a structured prediction with uncertainty.
              A bad stage can be re-run alone. The rest of the workflow
              is preserved.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="The 8 ANNs are live today"
        description="Each of the 8 roles is a real, published, deployable ANN in the Aigarth marketplace. Stub backends today; the real Director, Literature, and Experiment Planner are LLM calls; the rest are wired to the existing compute fabric."
      >
        <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { slug: "mat-research-director", name: "Research Director", role: "director", accuracy: 94.5, price: "0.00005", icon: Compass },
            { slug: "mat-literature-ingester", name: "Literature Ingester", role: "literature", accuracy: 91.2, price: "0.0001", icon: BookOpen },
            { slug: "mat-simulation-runner", name: "Simulation Runner", role: "simulation", accuracy: 88.6, price: "0.0005", icon: Atom },
            { slug: "mat-physics-reasoner", name: "Physics Reasoner", role: "physics", accuracy: 96.8, price: "0.00002", icon: Zap },
            { slug: "mat-material-designer", name: "Material Designer", role: "design", accuracy: 87.4, price: "0.0002", icon: PencilRuler },
            { slug: "mat-multi-obj-optimizer", name: "Multi-Obj Optimizer", role: "optimization", accuracy: 93.0, price: "0.00005", icon: TrendingUp },
            { slug: "mat-experiment-planner", name: "Experiment Planner", role: "experiment", accuracy: 90.5, price: "0.00005", icon: TestTube },
            { slug: "mat-validation-engine", name: "Validation Engine", role: "validation", accuracy: 95.2, price: "0.00005", icon: ShieldCheck },
          ].map((ann) => {
            const Icon = ann.icon;
            return (
              <Link
                key={ann.slug}
                href={`/marketplace/${ann.slug}`}
                className="group rounded-xl border bg-card p-4 transition-colors hover:border-garden-500/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-md border bg-background/50 p-1.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="rounded-full border border-garden-500/30 bg-garden-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-garden-700 dark:text-garden-300">
                    Live
                  </span>
                </div>
                <div className="mt-2.5 text-sm font-medium">{ann.name}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">role: {ann.role}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-2 text-[10px] text-muted-foreground">
                  <div>
                    <div>Accuracy</div>
                    <div className="font-mono text-foreground">{ann.accuracy.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div>Price / call</div>
                    <div className="font-mono text-foreground">{ann.price} QU</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/marketplace">
              Browse the 8 in the marketplace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <StakeButton
              context={{
                label: "Material science ANNs",
                purpose:
                  "Stake QUBIC to participate in the material science network: fund the next cathode, catalyst, or polymer discovery.",
                minStakeQubic: 1_000_000_000, // 1,000 QU per the funnel cost model
                successHref: "/use-cases/material-science/funnel",
              }}
              defaultAmount="1000M"
            >
              <Coins className="mr-2 h-4 w-4" />
              Stake to participate
            </StakeButton>
          </Button>
        </div>
      </Section>

      <Section
        title="Will it fit the Aigarth architecture?"
        description="We evaluated four dimensions. Most of the platform is ready. The continuous-learning pillar is greenfield, and the most important one for honest scientific improvement."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPATIBILITY.map((d) => (
            <div
              key={d.label}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Verdict: {d.verdict}
                  </div>
                </div>
                <span className="font-mono text-lg tabular-nums">{d.score}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{d.summary}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Roadmap"
        description="Five phases. Re-evaluate at the end of Phase 1 with 1,000 ingested papers and a research question answered in under 5 minutes."
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {ROADMAP.map((p) => {
            const isCurrent = p.status === "in_progress";
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
                  <span className="font-mono text-xs text-muted-foreground">
                    Phase {p.phase}
                  </span>
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

      <Section
        title="What it costs (illustrative)"
        description="Find-a-new-battery-cathode workflow on a single CPU worker. Numbers are placeholders that will change as we ship and measure."
      >
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Stage</th>
                <th className="px-4 py-3 text-right font-medium">Cost (QU)</th>
                <th className="px-4 py-3 text-right font-medium">Wall time</th>
              </tr>
            </thead>
            <tbody>
              {[
                { stage: "Literature (30 papers)", cost: "0.10", lat: "5 min" },
                { stage: "Research Director (plan)", cost: "0.05", lat: "1 min" },
                { stage: "Material Design (100 candidates)", cost: "1.00", lat: "30 min" },
                { stage: "MLIP screening (MACE)", cost: "5.00", lat: "60 min" },
                { stage: "DFT refinement (VASP, top 10)", cost: "45.00", lat: "~100 h" },
                { stage: "Physics Reasoning", cost: "0.20", lat: "5 min" },
                { stage: "Optimization (Pareto)", cost: "0.10", lat: "1 min" },
                { stage: "Experiment Plan", cost: "0.05", lat: "2 min" },
                { stage: "Validation", cost: "0.05", lat: "1 min" },
              ].map((r) => (
                <tr key={r.stage} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm">{r.stage}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">{r.cost}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {r.lat}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 bg-muted/30 font-medium">
                <td className="px-4 py-3 text-sm">Total</td>
                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">~51.55</td>
                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                  ~102 h
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-muted-foreground">
          Cost is dominated by DFT refinement (87%). MLIP surrogates cut
          the wall time by 10×. A monthly reservation of 1,000 QU covers
          ~20 cathode discoveries per month.
        </p>
      </Section>

      <Section
        title="The single hard precondition"
        description="Everything in Phase 4 (the on-chain portion) depends on one thing we haven't shipped yet."
      >
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-md border border-red-500/30 bg-background/50 p-2">
              <Server className="h-5 w-5 text-red-700 dark:text-red-300" />
            </div>
            <div>
              <div className="text-sm font-medium">K12 signature verification</div>
              <p className="mt-1 text-sm text-muted-foreground">
                services/qubic is currently format-only. The address regex
                passes, but the cryptographic signature isn't actually checked.
                This blocks every on-chain write in the proposal, including
                the new <code className="rounded bg-muted px-1 py-0.5 text-xs">discovery_attribution</code> contract
                for material findings. The fix is to use{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">@noble/curves</code>{" "}
                (already a dep) for real K12 verification. ~3 story points
                of focused work, no new architecture. Same blocker as the
                video proposal: solve once, reuse.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Follow along"
        description="This is a build-in-public project. The dashboard at localhost:4000/material-science is the source of truth for what is real today."
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="http://localhost:4000/material-science" target="_blank" rel="noreferrer">
              <TrendingUpIcon className="mr-2 h-4 w-4" />
              Live dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/docs/use-case-material-science" target="_blank" rel="noreferrer">
              <Lightbulb className="mr-2 h-4 w-4" />
              Architecture evaluation
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/docs/use-case-material-science-proposal" target="_blank" rel="noreferrer">
              <Inbox className="mr-2 h-4 w-4" />
              Original proposal
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/deliveries/phase-17-delivery" target="_blank" rel="noreferrer">
              <GitBranch className="mr-2 h-4 w-4" />
              Phase 17 delivery
            </Link>
          </Button>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
          Numbers, phases, and product surfaces in this article are
          illustrative placeholders that will change as we ship and measure.
          Aigarth Cloud is a build-in-public project; the dashboard is the
          source of truth.
        </p>
      </Section>
    </>
  );
}
