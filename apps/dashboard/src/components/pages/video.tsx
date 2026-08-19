"use client";

/**
 * /video — Video Synthesis ANN use case dashboard.
 *
 * A static manifest of the proposed architecture, compatibility
 * verdicts, roadmap, risk register, and cost model. All data is
 * illustrative and tracks the contents of:
 *   - docs/use-cases/video-synthesis-eval.md
 *   - docs/use-cases/video-synthesis.md
 *
 * No live data is fetched. The two docs above are the source of
 * truth and are linked from each section.
 */

import * as React from "react";
import Link from "next/link";
import {
  Video,
  Eye,
  Camera,
  Move,
  Layers,
  Sparkles,
  Music,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ArrowRight,
  Cpu,
  Database,
  Globe,
  Zap,
  BookOpen,
  FileText,
  Briefcase,
  Activity,
  TrendingUp,
  Clock,
  HardDrive,
  Users,
  Coins,
} from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

// ============================================================================
//  Static manifest — mirrors docs/use-cases/video-synthesis-eval.md
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
      "ANN registry, versioning, reviews, marketplace listings, deploy hook — all ready in services/ann. We need a `role` enum, a `pipeline` table, and a `pipeline_runs` table to model Director/Camera/Motion as first-class roles.",
    gap: "Add `ann_role` enum, `ann_pipelines`, `ann_pipeline_runs`, `ann_feedback_events`. ~3 new tables, 6 new endpoints. No existing flow changes.",
    service: "services/ann",
    icon: Layers,
  },
  {
    name: "Compute architecture",
    verdict: "extend",
    score: 7,
    summary:
      "services/compute already does typed jobs, clusters, regions, reservations, and idempotency. The worker-side story is greenfield — we need a worker protocol, capability advertisement, and sandboxed execution.",
    gap: "Add `compute_workers` table, extend `jobs.kind` enum with 6 new kinds (render, motion, depth, fx, audio, quality), add `/v1/workers/*` namespace + long-poll `/v1/jobs/next`.",
    service: "services/compute",
    icon: Cpu,
  },
  {
    name: "Continuous learning",
    verdict: "greenfield",
    score: 5,
    summary:
      "Nothing in the current system stores per-ANN quality signals, user feedback attribution, or version-over-version improvement. This is the largest single gap and the part that turns the use case from a demo into an evolutionary system.",
    gap: "Add `ann_feedback_events` table (kind, value, attributed to ann_version + pipeline_run) and a `ann_version_metrics` materialized view. Cron job to refresh. ~1 new table per service, 1 rollup job.",
    service: "services/ann + services/compute",
    icon: TrendingUp,
  },
  {
    name: "Qubic integration",
    verdict: "blocked",
    score: 9,
    summary:
      "The shape is right — services/qubic already has wallets, stakes, treasury, validators, network. On-chain ANN ownership, worker registry, and reputation map cleanly to Qubic smart contracts. But K12 signature verification is format-only today, so on-chain writes are not yet safe.",
    gap: "Ship real K12 signature verification (precondition). Then deploy on-chain `ann_registry`, `worker_registry`, `reputation`, `rewards` contracts. Off-chain rollup commits to chain once per day.",
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
    name: "Director",
    description:
      "Reads the prompt, plans the shot list. Returns a structured JSON describing scenes, durations, camera, audio, and style.",
    status: "designed",
    computeKind: "(LLM call, not a compute job)",
    icon: Eye,
  },
  {
    slug: "camera",
    name: "Camera",
    description:
      "Turns each shot into a 3D camera path through space, with lens parameters. Knows 50 cinematic moves and when to use each.",
    status: "designed",
    computeKind: "(rule-based, no GPU)",
    icon: Camera,
  },
  {
    slug: "motion",
    name: "Motion",
    description:
      "Generates in-between frames from a keyframe and a camera path. Pure interpolation, deterministic, fast on CPU.",
    status: "designed",
    computeKind: "motion.frame_interpolate",
    icon: Move,
  },
  {
    slug: "depth",
    name: "Depth",
    description:
      "Produces per-frame depth maps. Foreground / background separation for parallax and depth-of-field. Uses MiDaS on CPU.",
    status: "designed",
    computeKind: "depth.midas_small",
    icon: Layers,
  },
  {
    slug: "fx",
    name: "FX",
    description:
      "Composites particles, steam, light glows, atmosphere. Domain-specific — a Steam FX ANN and a Rain FX ANN can coexist.",
    status: "designed",
    computeKind: "fx.composite",
    icon: Sparkles,
  },
  {
    slug: "audio",
    name: "Audio",
    description:
      "Aligns narration, music, and sound effects to the timeline. Knows when to dip the music under a voice.",
    status: "designed",
    computeKind: "audio.align",
    icon: Music,
  },
  {
    slug: "quality",
    name: "Quality",
    description:
      "Watches the result. Spots artifacts, weird motion, dropped frames. Decides whether to ship or to flag a stage for re-run.",
    status: "designed",
    computeKind: "quality.evaluate",
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
      "Dashboard /video page live with the architecture diagram",
      "Risk register + cost model",
    ],
    exit: "Stakeholders aligned. Decision: proceed to Phase 1.",
  },
  {
    id: "p1",
    number: 1,
    name: "Centralized prototype",
    status: "next",
    description:
      "Single Python process acting as Director + Camera + Motion + Render. A prompt in, an MP4 out, every stage recorded.",
    deliverables: [
      "`role` enum + `ann_pipelines` + `ann_pipeline_runs` tables",
      "Director ANN (LLM call)",
      "Camera ANN (rule-based)",
      "Motion ANN (OpenCV affine transforms)",
      "Render ANN (FFmpeg)",
      "Mock pipeline-run endpoint",
      "30-second sample render: 'city at sunset'",
    ],
    exit: "30s MP4 from a 1-paragraph prompt in under 10 minutes. Decision gate.",
  },
  {
    id: "p2",
    number: 2,
    name: "ANN marketplace integration",
    status: "later",
    description: "Publish ANNs as real listings. Sell pre-composed pipelines. Wire up per-version metrics and reviews.",
    deliverables: [
      "Director / Camera / Motion / Render ANNs published as listings",
      "`kind = 'pipeline'` listing type",
      "`ann_version_metrics` materialized view + cron",
      "Per-ANN quality ranking in the marketplace",
    ],
    exit: "Users buy and run a 5-ANN pipeline end to end without help.",
  },
  {
    id: "p3",
    number: 3,
    name: "Distributed compute",
    status: "later",
    description: "Worker registry, worker protocol, `aigarth/worker-video` image. Real per-stage cost.",
    deliverables: [
      "`compute_workers` table + `/v1/workers/*` namespace",
      "`POST /v1/jobs/next` long-poll + `POST /v1/jobs/:id/progress`",
      "`aigarth/worker-video` Docker image (Python + OpenCV + FFmpeg + PyTorch CPU)",
      "Per-worker reputation scoring from feedback events",
      "3-worker local cluster for E2E testing",
    ],
    exit: "Workers earn reputation; misbehavior is slashed; per-stage cost is real money.",
  },
  {
    id: "p4",
    number: 4,
    name: "Qubic ecosystem",
    status: "later",
    description: "On-chain ANN ownership, worker registry, reputation, rewards. Off-chain rollups committed to chain.",
    deliverables: [
      "Real K12 signature verification (precondition)",
      "On-chain `ann_registry`, `worker_registry`, `reputation`, `rewards` contracts",
      "Daily off-chain rollup → on-chain state root commitment",
      "QUBIC reward distribution: 70% worker, 20% ANN author, 10% treasury",
    ],
    exit: "An ANN's ownership and a worker's reputation are verifiable on-chain.",
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
    title: "Video is expensive — 5–10 min on CPU, 30–60s on a single GPU",
    likelihood: "high",
    impact: "high",
    mitigation: "Per-stage pre-flight estimate, per-stage credit deduction, pre-purchased capacity via reservations.",
  },
  {
    rank: 2,
    title: "Multi-ANN coordination compounds errors — bad Director cascades",
    likelihood: "high",
    impact: "high",
    mitigation: "Quality ANN at the end of every pipeline; per-stage retry; A/B two Director ANNs in shadow.",
  },
  {
    rank: 3,
    title: "Worker trust — untrusted code on shared infrastructure",
    likelihood: "med",
    impact: "crit",
    mitigation: "Docker sandbox; no network egress except Aigarth APIs; resource caps; reputation + slashing.",
  },
  {
    rank: 4,
    title: "Feedback attribution — when a pipeline fails, which ANN is responsible?",
    likelihood: "high",
    impact: "med",
    mitigation: "Per-stage `attribution` field on each feedback event; Quality ANN emits a 'weakest stage' verdict.",
  },
  {
    rank: 5,
    title: "Latency — 30s render in 5 min is bad UX",
    likelihood: "med",
    impact: "high",
    mitigation: "Streaming low-res preview during render; final-render handoff; 'cancel + partial refund'.",
  },
  {
    rank: 6,
    title: "K12 signature verification is still TODO (real crypto, not format-only)",
    likelihood: "high",
    impact: "crit",
    mitigation: "Precondition. Implement using @noble/curves (already a dep). Blocks Phase 4 entirely.",
  },
  {
    rank: 7,
    title: "Cold start — zero ANNs at launch means zero value",
    likelihood: "med",
    impact: "high",
    mitigation: "Seed with 5–8 production-quality ANNs before opening the marketplace.",
  },
  {
    rank: 8,
    title: "Legal — output resembles a copyrighted style",
    likelihood: "low",
    impact: "high",
    mitigation: "Generation provenance attached to every artifact; takedown workflow via audit log.",
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
  { stage: "Director (LLM call)", costQu: "0.05", latency: "2 s", note: "One round-trip to gateway" },
  { stage: "Camera (rule-based)", costQu: "0.01", latency: "< 1 s", note: "Pure function" },
  { stage: "Motion (OpenCV, CPU)", costQu: "0.50", latency: "60 s", note: "900 frames × 65 ms/frame" },
  { stage: "Depth (MiDaS, CPU)", costQu: "0.30", latency: "45 s", note: "900 frames × 50 ms/frame" },
  { stage: "FX (compositing)", costQu: "0.10", latency: "10 s", note: "900 frames × 11 ms/frame" },
  { stage: "Audio (alignment)", costQu: "0.05", latency: "5 s", note: "One short clip" },
  { stage: "Quality (model)", costQu: "0.10", latency: "15 s", note: "One full pass" },
  { stage: "Render (FFmpeg)", costQu: "0.05", latency: "30 s", note: "Encode h264" },
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
          <BookOpen className="mr-1.5 h-3 w-3" /> Use case study
        </Badge>
      </div>
      <h1 className="text-3xl font-medium tracking-tight">
        Video Synthesis ANNs
      </h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        A coordinator-based approach to AI video: a small Director ANN
        plans the shot list, then Camera, Motion, Depth, FX, Audio, and
        Quality ANNs do their part. Each is a published, versioned,
        rateable module in the Aigarth marketplace. This page is the
        live view of the proposal, the architecture compatibility
        verdicts, the development roadmap, the cost model, and the risk
        register.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          href="/docs/use-case-video-synthesis"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <FileText className="h-3.5 w-3.5" />
          Architecture evaluation
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </Link>
        <Link
          href="/docs/use-case-video-synthesis-blog"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Blog article
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </Link>
        <Link
          href="/deliveries/phase-16-delivery"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <Briefcase className="h-3.5 w-3.5" />
          Phase 16 delivery report
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
          <Video className="h-4 w-4 text-garden-500" />
          <CardTitle>Specialized ANN team</CardTitle>
        </div>
        <CardDescription>
          Seven small ANNs collaborate to produce a video. Each is
          published, versioned, and rateable in the Aigarth marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
            Render flow
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">prompt</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Director</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Camera</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Motion</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Depth</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">FX</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Audio</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Quality</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-background/50 px-2 py-1 font-mono">Render</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded border bg-emerald-500/20 px-2 py-1 font-mono text-emerald-700 dark:text-emerald-300">
              MP4
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Every stage emits a structured event into{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
              ann_feedback_events
            </code>
            . The Quality ANN at the end can flag any stage for re-run;
            only that stage re-executes, not the whole pipeline.
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
          Five phases. Re-evaluate at the end of Phase 1 with a real
          30-second render before committing to Phase 2.
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
          30-second 1080p render, all stages run once, single CPU worker.
          Numbers are placeholders that will change as we ship and
          measure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Cost (QU)</th>
                <th className="px-3 py-2 text-right font-medium">Latency</th>
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
                  ~3 min
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  per-stage cost visible to user before commit
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The cost is dominated by Motion and Depth (every frame).
          Per-stage pre-flight estimates let the user decide: pay for a
          faster worker, swap in a cheaper ANN, or skip the stage.
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
        value="7"
        sub="Director, Camera, Motion, Depth, FX, Audio, Quality"
        color="text-garden-500"
      />
      <StatCard
        icon={Cpu}
        label="New compute kinds"
        value="6"
        sub="render, motion, depth, fx, audio, quality"
        color="text-sky-500"
      />
      <StatCard
        icon={Database}
        label="New tables"
        value="5"
        sub="ann_pipelines, ann_pipeline_runs, ann_feedback_events, compute_workers, ann_version_metrics"
        color="text-amber-500"
      />
      <StatCard
        icon={Clock}
        label="Phase 0 (now)"
        value="~75 min"
        sub="evaluation, blog, dashboard, tracker"
        color="text-emerald-500"
      />
    </div>
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
              centralized prototype — a 30-second MP4 from a one-paragraph
              prompt, generated end to end by the Aigarth platform.
              Re-evaluation gate at the end of Phase 1.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/docs/use-case-video-synthesis"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              Read the eval
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/docs/use-case-video-synthesis-blog"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              Read the article
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

export function VideoView() {
  return (
    <div className="space-y-6">
      <Header />
      <Stats />
      <CompatibilityMatrix />
      <ArchitectureDiagram />
      <RoadmapTimeline />
      <CostModel />
      <RiskRegister />
      <CallToAction />
    </div>
  );
}
