"use client";

/**
 * /material-science — Material Science Intelligence ANN use case dashboard.
 *
 * A static manifest of the proposed architecture, compatibility
 * verdicts, roadmap, risk register, and cost model. All data is
 * illustrative and tracks the contents of:
 *   - docs/use-cases/material-science-eval.md
 *   - docs/use-cases/material-science.md
 *
 * No live data is fetched. The two docs above are the source of
 * truth and are linked from each section.
 */

import * as React from "react";
import Link from "next/link";
import {
  Atom,
  Compass,
  BookOpen,
  Cpu,
  Zap,
  PencilRuler,
  TrendingUp,
  FlaskConical,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Database,
  Globe,
  Activity,
  Clock,
  Briefcase,
  FileText,
  Layers,
  Coins,
  Inbox,
} from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

// ============================================================================
//  Static manifest — mirrors docs/use-cases/material-science-eval.md
// ============================================================================

type Verdict = "ready" | "extend" | "greenfield" | "blocked";

type Dimension = {
  name: string;
  verdict: Verdict;
  score: number; // out of 10
  summary: string;
  gap: string;
  service: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DIMENSIONS: Dimension[] = [
  {
    name: "ANN compatibility",
    verdict: "extend",
    score: 8,
    summary:
      "ANN registry, versioning, reviews, marketplace listings, deploy hook — all ready in services/ann. We need a `material_domain` enum (battery, alloy, polymer, catalyst, ...) and a knowledge-graph table to link materials, properties, papers, and structures.",
    gap: "Add `material_domain` enum on `anns`, `material_knowledge_nodes` + `material_knowledge_edges` tables, 9 new endpoints (`/v1/materials/*`). No existing flow changes.",
    service: "services/ann",
    icon: Layers,
  },
  {
    name: "Compute architecture",
    verdict: "extend",
    score: 6,
    summary:
      "services/compute is task-agnostic — a DFT relaxation is a job with a typed `kind` and a payload, exactly like a video render. But material-science compute is 50–100× more expensive, needs GPU as a first-class resource, and requires capability-tagged workers (DFT, MD, MLIP are different engines).",
    gap: "Add 8 new compute kinds (lit_ingest, dft_relax, md_run, mlip_predict, design_generate, optimize_pareto, experiment_plan, validation_compare). Add `compute_simulation_results` table, `input_deck_hash` column for caching, capability-tagged workers with GPU counts.",
    service: "services/compute",
    icon: Cpu,
  },
  {
    name: "Continuous learning",
    verdict: "greenfield",
    score: 5,
    summary:
      "No per-ANN quality signals today. Material science adds a sharper requirement: per-prediction provenance, validation against experiments, uncertainty calibration, and — critically — *negative* results as first-class signals. An experiment that disproves a prediction is more valuable than one that confirms it.",
    gap: "Add `material_predictions` (per-prediction provenance + uncertainty), `material_validation_results` (experimental + literature validation), `material_feedback_events` (positive + negative + cross-ANN corrections). Materialized view for per-ANN quality rollup with uncertainty calibration score.",
    service: "services/ann + services/compute",
    icon: TrendingUp,
  },
  {
    name: "Qubic integration",
    verdict: "blocked",
    score: 9,
    summary:
      "Material science is *especially* well-suited to Qubic's `outsourced-computing` contract — distributed simulation compute is exactly what it was designed for. The on-chain layer maps cleanly: ANN ownership, worker registry, reputation, rewards, and a new `discovery_attribution` contract for one-way publish actions.",
    gap: "Ship real K12 signature verification (precondition). Then deploy on-chain `ann_registry`, `worker_registry`, `reputation`, `rewards`, and the new `discovery_attribution` contracts. Off-chain rollup commits to chain once per day; publish is one-way and immediate.",
    service: "services/qubic",
    icon: Globe,
  },
];

// ----- ANN roles -----

type Role = {
  slug: string;
  name: string;
  description: string;
  status: "ready" | "designed" | "future";
  computeKind?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ROLES: Role[] = [
  {
    slug: "director",
    name: "Research Director",
    description:
      "Reads the research question, plans the workflow. Returns a structured JSON describing stages, costs, time, and constraints.",
    status: "designed",
    computeKind: "(LLM call, not a compute job)",
    icon: Compass,
  },
  {
    slug: "literature",
    name: "Literature",
    description:
      "Ingests scientific papers. Extracts composition, property values, measurement method, citation. Builds a knowledge graph the other ANNs can query.",
    status: "designed",
    computeKind: "lit_ingest",
    icon: BookOpen,
  },
  {
    slug: "simulation",
    name: "Simulation",
    description:
      "Runs the actual science. DFT relaxation (VASP, Q-E), molecular dynamics (LAMMPS, GROMACS), or fast ML surrogates (MACE, Allegro).",
    status: "designed",
    computeKind: "dft_relax / md_run / mlip_predict",
    icon: Atom,
  },
  {
    slug: "physics",
    name: "Physics Reasoning",
    description:
      "Sanity-checks predictions against first principles. Catches impossible structures, runaway formation energies, metastable traps.",
    status: "designed",
    computeKind: "(rule-based, no GPU)",
    icon: Zap,
  },
  {
    slug: "design",
    name: "Material Design",
    description:
      "Generates candidate materials. New alloys, new polymers, new battery cathodes. Output is a structure + predicted property + uncertainty.",
    status: "designed",
    computeKind: "design_generate",
    icon: PencilRuler,
  },
  {
    slug: "optimization",
    name: "Optimization",
    description:
      "Finds the best tradeoff. Multi-objective Pareto on (energy density, cost, cycle life, environmental impact, ...).",
    status: "designed",
    computeKind: "optimize_pareto",
    icon: TrendingUp,
  },
  {
    slug: "experiment",
    name: "Experiment Planning",
    description:
      "Converts a candidate material into a lab protocol. Synthesize by solid-state reaction at 950 °C for 12 h. XRD, SEM, cycling.",
    status: "designed",
    computeKind: "experiment_plan",
    icon: FlaskConical,
  },
  {
    slug: "validation",
    name: "Validation",
    description:
      "Compares predictions against reality. Cross-checks against literature. Logs the result so the next iteration starts from a better baseline.",
    status: "designed",
    computeKind: "validation_compare",
    icon: ShieldCheck,
  },
];

// ----- Roadmap phases -----

type Phase = {
  id: string;
  number: number;
  name: string;
  status: "current" | "next" | "later";
  description: string;
  deliverables: string[];
  exit: string;
};

const ROADMAP: Phase[] = [
  {
    id: "p0",
    number: 0,
    name: "Documentation",
    status: "current",
    description: "Architecture evaluation, blog article, this dashboard. No code in production.",
    deliverables: [
      "Architecture compatibility evaluation (4 dimensions, color-coded)",
      "Blog article on the Aigarth Cloud website",
      "Dashboard /material-science page live with the architecture diagram",
      "Risk register + cost model",
    ],
    exit: "Stakeholders aligned. Decision: proceed to Phase 1.",
  },
  {
    id: "p1",
    number: 1,
    name: "Knowledge prototype",
    status: "next",
    description:
      "Paper ingestion + knowledge graph + research-question answering. No simulation, no blockchain. Single Python process acting as Director + Literature.",
    deliverables: [
      "`material_domain` enum on `anns`",
      "`material_knowledge_nodes` + `material_knowledge_edges` tables",
      "Literature ANN (PDF ingestion → structured facts)",
      "Research Director ANN (LLM call returning a research plan)",
      "Research-assistant UI on /dashboard/research",
      "Ingest 1,000 open-access papers, answer a 3-paragraph question in < 5 min",
    ],
    exit: "1,000 papers ingested; research question answered in < 5 min. Decision gate.",
  },
  {
    id: "p2",
    number: 2,
    name: "Simulation integration",
    status: "later",
    description:
      "Wire up DFT, MD, and MLIP workers. End-to-end material discovery workflow. Real cost is paid for the first time.",
    deliverables: [
      "8 new compute kinds (lit_ingest, dft_relax, md_run, mlip_predict, design_generate, optimize_pareto, experiment_plan, validation_compare)",
      "`compute_simulation_results` table + `input_deck_hash` column",
      "`aigarth/worker-dft` (VASP, Q-E) + `aigarth/worker-md` (LAMMPS, GROMACS) + `aigarth/worker-mlip` (MACE, Allegro) container images",
      "Design + Optimization + Experiment + Validation ANNs",
      "Find a battery cathode end to end (~52 QU, ~102 h on 1× CPU)",
    ],
    exit: "A researcher can run a full discovery workflow and get a lab protocol they can hand to a grad student.",
  },
  {
    id: "p3",
    number: 3,
    name: "ANN marketplace",
    status: "later",
    description: "Publish the 8 ANNs as real listings. Per-ANN quality ranking. Reviews and ratings.",
    deliverables: [
      "8 ANNs published as marketplace listings",
      "`material_ann_quality` materialized view + cron (with uncertainty calibration score)",
      "Per-ANN quality ranking in the marketplace",
      "Reviews and ratings flow into `material_feedback_events`",
      "`kind = 'research_pipeline'` listing type for pre-composed workflows",
    ],
    exit: "Researchers buy a pre-composed pipeline (\"High-Entropy Alloy Discovery Pack\") and run it end to end without help.",
  },
  {
    id: "p4",
    number: 4,
    name: "Distributed research network",
    status: "later",
    description:
      "On-chain ANN ownership, worker registry, reputation, rewards, and a new `discovery_attribution` contract. Off-chain rollups + one-way publish.",
    deliverables: [
      "Real K12 signature verification (precondition)",
      "On-chain `ann_registry`, `worker_registry`, `reputation`, `rewards`",
      "On-chain `discovery_attribution` (one-way publish, immediate)",
      "Daily off-chain rollup → on-chain state root commitment",
      "QUBIC reward distribution: 50% worker, 30% ANN author, 10% treasury, 10% discovery pool",
    ],
    exit: "A material discovery is attributable on-chain to specific ANNs, specific workers, and specific researchers.",
  },
];

// ----- Risk register -----

type Risk = {
  rank: number;
  title: string;
  likelihood: "low" | "med" | "high";
  impact: "low" | "med" | "high" | "crit";
  mitigation: string;
};

const RISKS: Risk[] = [
  {
    rank: 1,
    title: "Scientific correctness — a wrong prediction is worse than no prediction",
    likelihood: "high",
    impact: "high",
    mitigation: "Physics Reasoning ANN as a sanity checker; uncertainty quantification on every prediction; conservative defaults; never auto-publish.",
  },
  {
    rank: 2,
    title: "Cost is brutal — DFT is hours-to-days, full workflows are ~52 QU",
    likelihood: "high",
    impact: "high",
    mitigation: "Per-stage pre-flight estimates; surrogate-first routing (MLIP before DFT); input-deck caching; reservations; cancel + partial refund.",
  },
  {
    rank: 3,
    title: "Validation is the long pole — real experiments take weeks",
    likelihood: "high",
    impact: "med",
    mitigation: "Cross-simulation validation as a first pass; literature validation as a second pass; experiment planning so a real lab can run it; long feedback windows in the data model.",
  },
  {
    rank: 4,
    title: "Heterogeneous compute — DFT needs HPC, literature is LLM, MD is GPU",
    likelihood: "med",
    impact: "high",
    mitigation: "Capability-tagged workers; fine-grained scheduler matching; per-engine container images (worker-dft, worker-md, worker-mlip, worker-lit).",
  },
  {
    rank: 5,
    title: "K12 signature verification is still TODO (real crypto, not format-only)",
    likelihood: "high",
    impact: "crit",
    mitigation: "Precondition. Implement using @noble/curves (already a dep). Blocks Phase 4 entirely. Same blocker as the video proposal — solve once, reuse.",
  },
  {
    rank: 6,
    title: "Open data licensing — Materials Project, OQMD are CC-BY; commercial use unclear",
    likelihood: "med",
    impact: "med",
    mitigation: "Provenance tracking on every artifact; per-source license metadata; takedown workflow; partner with a research lab that has clarified licensing.",
  },
  {
    rank: 7,
    title: "No \"ground truth\" — physics correctness vs experiment drift",
    likelihood: "high",
    impact: "high",
    mitigation: "Uncertainty quantification on every prediction; calibration scoring on the rollup; cross-validation against multiple workers; never auto-publish.",
  },
  {
    rank: 8,
    title: "Cold start — material science ANNs need domain expertise to author",
    likelihood: "med",
    impact: "high",
    mitigation: "Seed with 3–5 partner labs that ship the first 8 production-quality ANNs before opening the marketplace.",
  },
];

// ----- Cost model (illustrative) -----

type CostRow = {
  stage: string;
  costQu: string;
  latency: string;
  note: string;
};

const COST_MODEL: CostRow[] = [
  { stage: "Literature (30 papers)", costQu: "0.10", latency: "5 min", note: "LLM call to gateway" },
  { stage: "Research Director (plan)", costQu: "0.05", latency: "1 min", note: "LLM call" },
  { stage: "Material Design (100 candidates)", costQu: "1.00", latency: "30 min", note: "Generative model" },
  { stage: "MLIP screening (MACE, 100 candidates)", costQu: "5.00", latency: "60 min", note: "Cheap DFT surrogate" },
  { stage: "DFT refinement (VASP, top 10)", costQu: "45.00", latency: "~100 h", note: "10× ~10 CPU-h each" },
  { stage: "Physics Reasoning", costQu: "0.20", latency: "5 min", note: "Rule-based sanity check" },
  { stage: "Optimization (Pareto)", costQu: "0.10", latency: "1 min", note: "Local CPU" },
  { stage: "Experiment Plan", costQu: "0.05", latency: "2 min", note: "LLM, lab protocol" },
  { stage: "Validation", costQu: "0.05", latency: "1 min", note: "Knowledge graph query" },
];

// ============================================================================
//  Style helpers
// ============================================================================

const VERDICT_STYLE: Record<Verdict, { color: string; bg: string; border: string; label: string }> = {
  ready: {
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "Ready",
  },
  extend: {
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Extend",
  },
  greenfield: {
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    label: "Greenfield",
  },
  blocked: {
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Blocked",
  },
};

const ROLE_STATUS_STYLE: Record<Role["status"], { color: string; bg: string; border: string; label: string }> = {
  ready: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Ready" },
  designed: { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Designed" },
  future: { color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/30", label: "Future" },
};

const LIKELIHOOD_STYLE: Record<Risk["likelihood"], string> = {
  low: "bg-muted text-muted-foreground",
  med: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const IMPACT_STYLE: Record<Risk["impact"], string> = {
  low: "bg-muted text-muted-foreground",
  med: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high: "bg-red-500/10 text-red-700 dark:text-red-300",
  crit: "bg-red-600 text-white",
};

// ============================================================================
//  Components
// ============================================================================

function Header() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Activity className="mr-1.5 h-3 w-3" /> Phase 0 — Evaluation
        </Badge>
        <Badge variant="outline" className="text-xs">
          <Atom className="mr-1.5 h-3 w-3" /> Use case study
        </Badge>
      </div>
      <h1 className="text-3xl font-medium tracking-tight">
        Material Science Intelligence ANNs
      </h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        A coordinator-based approach to material discovery: a small Research
        Director ANN plans the workflow, then Literature, Simulation, Physics,
        Design, Optimization, Experiment, and Validation ANNs do their part.
        Each is a published, versioned, rateable module in the Aigarth
        marketplace. This page is the live view of the proposal, the
        architecture compatibility verdicts, the development roadmap, the
        cost model, and the risk register.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          href="/docs/use-case-material-science-proposal"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <Inbox className="h-3.5 w-3.5" />
          Original proposal
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </Link>
        <Link
          href="/docs/use-case-material-science"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <FileText className="h-3.5 w-3.5" />
          Architecture evaluation
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </Link>
        <Link
          href="/docs/use-case-material-science-blog"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Blog article
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </Link>
        <Link
          href="/deliveries/phase-17-delivery"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <Briefcase className="h-3.5 w-3.5" />
          Phase 17 delivery report
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

function CompatibilityMatrix() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-garden-500" />
          <CardTitle>Architecture compatibility</CardTitle>
        </div>
        <CardDescription>
          How well the current Aigarth Cloud architecture can support
          each pillar of the proposal, and what we need to add.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {DIMENSIONS.map((d) => {
            const style = VERDICT_STYLE[d.verdict];
            const Icon = d.icon;
            return (
              <div
                key={d.name}
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  style.bg,
                  style.border
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 rounded-md border bg-background/50 p-1.5", style.border)}>
                      <Icon className={cn("h-4 w-4", style.color)} />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {d.service}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        style.bg,
                        style.color,
                        style.border
                      )}
                    >
                      {style.label}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {d.score}/10
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-foreground/80">
                  {d.summary}
                </p>
                <div className="mt-3 rounded-md border bg-background/50 px-3 py-2 text-xs">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Gap
                  </span>
                  <p className="mt-1 text-foreground/80">{d.gap}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ArchitectureDiagram() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Atom className="h-4 w-4 text-garden-500" />
          <CardTitle>Specialized ANN team</CardTitle>
        </div>
        <CardDescription>
          Eight small ANNs collaborate to discover and validate a new
          material. Each is published, versioned, and rateable in the
          Aigarth marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const style = ROLE_STATUS_STYLE[r.status];
            return (
              <div
                key={r.slug}
                className={cn(
                  "rounded-lg border p-3 transition-colors hover:border-garden-500/50",
                  "bg-card/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-md border bg-background/50 p-1.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                      style.bg,
                      style.color,
                      style.border
                    )}
                  >
                    {style.label}
                  </span>
                </div>
                <div className="mt-2.5 text-sm font-medium">{r.name}</div>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                  {r.description}
                </p>
                {r.computeKind && (
                  <code className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {r.computeKind}
                  </code>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Discovery flow
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">question</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Director</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Literature</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Design</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Simulation</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Physics</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Optimize</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Experiment</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Validation</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-emerald-500/20 px-2 py-1 font-mono text-emerald-700 dark:text-emerald-300">
              candidate
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Every stage emits a structured{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
              material_predictions
            </code>{" "}
            row. Every prediction is attributed to a specific ANN + ANN
            version. Every validation (positive or negative) is logged in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
              material_feedback_events
            </code>
            . A failed Physics check can flag a stage for re-run; only
            that stage re-executes, not the whole pipeline.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RoadmapTimeline() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-garden-500" />
          <CardTitle>Roadmap</CardTitle>
        </div>
        <CardDescription>
          Five phases. Re-evaluate at the end of Phase 1 with 1,000
          ingested papers and a research question answered in &lt; 5 min
          before committing to Phase 2.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ROADMAP.map((p) => {
            const isCurrent = p.status === "current";
            const isNext = p.status === "next";
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  isCurrent
                    ? "border-amber-500/40 bg-amber-500/5"
                    : isNext
                    ? "border-garden-500/30 bg-garden-500/5"
                    : "bg-card/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        Phase {p.number}
                      </span>
                      <span className="text-sm font-medium">{p.name}</span>
                      {isCurrent && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          In progress
                        </span>
                      )}
                      {isNext && (
                        <span className="rounded-full border border-garden-500/40 bg-garden-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-garden-700 dark:text-garden-300">
                          Next
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {p.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-garden-500" />
                      <span className="text-foreground/80">{d}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-md border bg-background/50 px-3 py-2 text-xs">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Exit criteria
                  </span>
                  <p className="mt-1 text-foreground/80">{p.exit}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskRegister() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <CardTitle>Risk register</CardTitle>
        </div>
        <CardDescription>
          Top 8 risks, ordered by impact × likelihood. L = likelihood,
          I = impact.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {RISKS.map((r) => (
            <div
              key={r.rank}
              className="rounded-md border bg-card/30 p-3 transition-colors hover:bg-card/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                    #{r.rank}
                  </span>
                  <div>
                    <div className="text-xs font-medium leading-snug">
                      {r.title}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">Mitigation:</span>{" "}
                      {r.mitigation}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase",
                      LIKELIHOOD_STYLE[r.likelihood]
                    )}
                    title="Likelihood"
                  >
                    L:{r.likelihood}
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase",
                      IMPACT_STYLE[r.impact]
                    )}
                    title="Impact"
                  >
                    I:{r.impact}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CostModel() {
  const totalQu = COST_MODEL.reduce((s, r) => s + parseFloat(r.costQu), 0).toFixed(2);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-garden-500" />
          <CardTitle>Cost model (illustrative)</CardTitle>
        </div>
        <CardDescription>
          "Find a new battery cathode" workflow, all stages run once, single
          CPU worker. Numbers are placeholders that will change as we ship
          and measure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Cost (QU)</th>
                <th className="px-3 py-2 text-right font-medium">Wall time</th>
                <th className="px-3 py-2 text-left font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {COST_MODEL.map((r, i) => (
                <tr
                  key={r.stage}
                  className={cn(
                    "border-b last:border-0",
                    i % 2 === 0 ? "bg-background" : "bg-muted/10"
                  )}
                >
                  <td className="px-3 py-2 text-xs">{r.stage}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {r.costQu}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {r.latency}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.note}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 bg-muted/30">
                <td className="px-3 py-2 text-xs font-medium">Total</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums">
                  ~{totalQu}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums text-muted-foreground">
                  ~102 h
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  per-stage cost visible to user before commit
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The cost is dominated by DFT refinement (87% of the total).
          Per-stage pre-flight estimates let the user decide: pay for full
          DFT, or use MLIP surrogates only. A monthly reservation of 1,000
          QU covers ~20 cathode discoveries per month.
        </p>
      </CardContent>
    </Card>
  );
}

function Stats() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Layers}
        label="Specialized roles"
        value="8"
        sub="Director, Literature, Simulation, Physics, Design, Optimize, Experiment, Validation"
        color="text-garden-500"
      />
      <StatCard
        icon={Cpu}
        label="New compute kinds"
        value="8"
        sub="lit_ingest, dft_relax, md_run, mlip_predict, design_generate, optimize_pareto, experiment_plan, validation_compare"
        color="text-sky-500"
      />
      <StatCard
        icon={Database}
        label="New tables"
        value="6"
        sub="material_knowledge_nodes, _edges, material_predictions, material_validation_results, material_feedback_events, compute_simulation_results"
        color="text-amber-500"
      />
      <StatCard
        icon={Clock}
        label="Phase 0 (now)"
        value="~90 min"
        sub="evaluation, blog, dashboard, tracker"
        color="text-emerald-500"
      />
    </div>
  );
}

// ----- Live ANNs (the 8 specialists, mirrored from services/ann) -----

type LiveAnn = {
  slug: string;
  name: string;
  role: string;
  tagline: string;
  accuracy: number;
  pricePerCall: string;
  license: "Open" | "Commercial";
  status: "ready" | "designed" | "future";
  icon: React.ComponentType<{ className?: string }>;
};

const LIVE_ANNS: LiveAnn[] = [
  { slug: "mat-research-director", name: "Research Director", role: "director", tagline: "Plan a material discovery workflow from a research question.", accuracy: 94.5, pricePerCall: "0.00005", license: "Open", status: "ready", icon: Compass },
  { slug: "mat-literature-ingester", name: "Literature Ingester", role: "literature", tagline: "Ingest scientific papers into a structured knowledge graph.", accuracy: 91.2, pricePerCall: "0.0001", license: "Open", status: "ready", icon: BookOpen },
  { slug: "mat-simulation-runner", name: "Simulation Runner", role: "simulation", tagline: "Run DFT, MD, or ML surrogate simulations for material properties.", accuracy: 88.6, pricePerCall: "0.0005", license: "Commercial", status: "ready", icon: Atom },
  { slug: "mat-physics-reasoner", name: "Physics Reasoner", role: "physics", tagline: "Sanity-check a simulation result against first principles.", accuracy: 96.8, pricePerCall: "0.00002", license: "Open", status: "ready", icon: Zap },
  { slug: "mat-material-designer", name: "Material Designer", role: "design", tagline: "Generate candidate materials for a target property profile.", accuracy: 87.4, pricePerCall: "0.0002", license: "Commercial", status: "ready", icon: PencilRuler },
  { slug: "mat-multi-obj-optimizer", name: "Multi-Obj Optimizer", role: "optimization", tagline: "Pareto-sort candidates on (energy density, cost, cycle life).", accuracy: 93.0, pricePerCall: "0.00005", license: "Open", status: "ready", icon: TrendingUp },
  { slug: "mat-experiment-planner", name: "Experiment Planner", role: "experiment", tagline: "Convert a candidate material into a synthesizable lab protocol.", accuracy: 90.5, pricePerCall: "0.00005", license: "Commercial", status: "ready", icon: FlaskConical },
  { slug: "mat-validation-engine", name: "Validation Engine", role: "validation", tagline: "Cross-check a prediction against literature and historical data.", accuracy: 95.2, pricePerCall: "0.00005", license: "Open", status: "ready", icon: ShieldCheck },
];

function LiveAnns() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-garden-500" />
          <CardTitle>8 ANNs live in the marketplace</CardTitle>
        </div>
        <CardDescription>
          Each role is a real, published, versioned, rateable ANN in services/ann.
          Stub backends today; deployable as compute jobs through the existing
          services/compute fabric. License and price per call are set; the
          full pipeline (Director → Validation) is wired and dispatchable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LIVE_ANNS.map((ann) => {
            const Icon = ann.icon;
            return (
              <Link
                key={ann.slug}
                href={`http://localhost:3003/marketplace/${ann.slug}`}
                className="group block rounded-lg border bg-card/50 p-3 transition-colors hover:border-garden-500/50"
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
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {ann.tagline}
                </p>
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
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">License</span>
                  <span
                    className={
                      ann.license === "Open"
                        ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300"
                        : "rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300"
                    }
                  >
                    {ann.license}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  View in marketplace
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="http://localhost:3003/marketplace"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            Browse the 8 in the marketplace
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="http://localhost:3003/use-cases/material-science/funnel"
            className="inline-flex items-center gap-1.5 rounded-md border border-garden-500/30 bg-garden-500/10 px-3 py-1.5 text-xs font-medium text-garden-700 transition-colors hover:bg-garden-500/20 dark:text-garden-300"
          >
            Stake to participate
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <Card className="transition-colors hover:border-garden-500/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className={cn("h-3.5 w-3.5", color)} />
          {label}
        </div>
        <div className="mt-2 text-2xl font-medium tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function CallToAction() {
  return (
    <Card className="border-garden-500/30 bg-gradient-to-br from-garden-500/5 to-emerald-500/5">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Want to follow along?</div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Phase 0 is the documentation you just read. Phase 1 is the
              knowledge prototype — ingest 1,000 papers, answer a research
              question in under 5 minutes. Re-evaluation gate at the end
              of Phase 1.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/docs/use-case-material-science-proposal"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <Inbox className="h-3 w-3" />
              Original proposal
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/docs/use-case-material-science"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              Read the eval
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/docs/use-case-material-science-blog"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              Read the article
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="http://localhost:3003/use-cases/material-science/funnel"
              className="inline-flex items-center gap-1.5 rounded-md border border-garden-500/30 bg-garden-500/10 px-3 py-1.5 text-xs font-medium text-garden-700 transition-colors hover:bg-garden-500/20 dark:text-garden-300"
            >
              Stake to participate
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
//  Main
// ============================================================================

export function MaterialScienceView() {
  return (
    <div className="space-y-6">
      <Header />
      <Stats />
      <LiveAnns />
      <CompatibilityMatrix />
      <ArchitectureDiagram />
      <RoadmapTimeline />
      <CostModel />
      <RiskRegister />
      <CallToAction />
    </div>
  );
}
