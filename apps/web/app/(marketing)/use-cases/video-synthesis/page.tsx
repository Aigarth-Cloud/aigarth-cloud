import {
  Video,
  Eye,
  Camera,
  Move,
  Layers,
  Sparkles,
  Music,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  TrendingUp,
  ExternalLink,
  Lightbulb,
  GitBranch,
  Server,
} from "lucide-react";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Button, Badge } from "@aigarth/ui";
import Link from "next/link";

export const metadata = {
  title: "Use case: Aigarth Cloud as a coordinator for AI video production",
  description:
    "A swarm of small, specialized AIs, including Director, Camera, Motion, Depth, FX, Audio, Quality, all collaborating to produce useful video. Build-in-public, with a re-evaluation gate at the end of Phase 1.",
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
    name: "Director",
    description: "Reads the prompt, plans the shot list. Returns structured JSON describing scenes, durations, camera, audio, and style.",
    icon: Eye,
  },
  {
    slug: "camera",
    name: "Camera",
    description: "Picks the cinematic move. Slow push in? Dolly left? Whip pan? Knows 50 ways to move a camera and when to use each.",
    icon: Camera,
  },
  {
    slug: "motion",
    name: "Motion",
    description: "Generates in-between frames from a keyframe and a camera move. Pure interpolation, deterministic, fast on CPU.",
    icon: Move,
  },
  {
    slug: "depth",
    name: "Depth",
    description: "Foreground / background separation for parallax and depth-of-field. Uses MiDaS on CPU.",
    icon: Layers,
  },
  {
    slug: "fx",
    name: "FX",
    description: "Particles, steam, light glows, atmosphere. Domain-specific. A Steam FX ANN and a Rain FX ANN can coexist.",
    icon: Sparkles,
  },
  {
    slug: "audio",
    name: "Audio",
    description: "Aligns narration, music, and sound effects to the timeline. Knows when to dip the music under a voice.",
    icon: Music,
  },
  {
    slug: "quality",
    name: "Quality",
    description: "Watches the result. Spots artifacts, weird motion, dropped frames. Decides whether to ship or to re-run a stage.",
    icon: ShieldCheck,
  },
];

const COMPATIBILITY = [
  {
    label: "ANN compatibility",
    score: "8/10",
    verdict: "Extend",
    summary: "ANN registry, versioning, reviews, marketplace listings, deploy hook: all ready. Add `role` enum, `ann_pipelines`, `ann_pipeline_runs`.",
  },
  {
    label: "Compute architecture",
    score: "7/10",
    verdict: "Extend",
    summary: "Typed jobs, clusters, regions, reservations: all ready. Add `compute_workers` table, worker protocol, and `/v1/workers/*` namespace.",
  },
  {
    label: "Continuous learning",
    score: "5/10",
    verdict: "Greenfield",
    summary: "No per-ANN quality signals today. Add `ann_feedback_events` table and a `ann_version_metrics` materialized view + cron.",
  },
  {
    label: "Qubic integration",
    score: "9/10",
    verdict: "Blocked",
    summary: "On-chain ANN ownership, worker registry, and reputation map cleanly. Blocked on real K12 signature verification.",
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
    name: "Centralized prototype",
    status: "next",
    desc: "Single Python process. A prompt in, an MP4 out, every stage recorded. Re-evaluation gate at the end.",
  },
  {
    phase: 2,
    name: "ANN marketplace",
    status: "later",
    desc: "Publish ANNs as real listings. Sell pre-composed pipelines. Wire up per-version metrics and reviews.",
  },
  {
    phase: 3,
    name: "Distributed compute",
    status: "later",
    desc: "Worker registry, worker protocol, `aigarth/worker-video` image. Real per-stage cost.",
  },
  {
    phase: 4,
    name: "Qubic ecosystem",
    status: "later",
    desc: "On-chain ANN ownership, worker registry, reputation, rewards. Off-chain rollups committed to chain.",
  },
];

export default function UseCaseVideoSynthesisPage() {
  return (
    <>
      <MarketingPageHero
        badge="Use case · Phase 0 in progress"
        title="AI video, but with a coordinator."
        highlight="And a team of specialists."
        description="A small Director ANN plans the shot list. Then Camera, Motion, Depth, FX, Audio, and Quality ANNs do their part. Each is published, versioned, and rateable in the Aigarth marketplace. This page is the build-in-public view of the proposal."
      />

      <div className="container-wide border-b py-10">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="http://localhost:4000/video" target="_blank" rel="noreferrer">
              View live dashboard
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/docs/use-case-video-synthesis" target="_blank" rel="noreferrer">
              Read the architecture evaluation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Section
        title="The team"
        description="Seven small, specialized ANNs collaborate to produce a video. Each one excellent at exactly one part of the job."
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
        title="How a render flows"
        description="A user prompt becomes a shot list. Each stage consumes it and produces an artifact. The Quality ANN at the end decides whether to ship or to re-run a stage."
      >
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
              {["prompt", "Director", "Camera", "Motion", "Depth", "FX", "Audio", "Quality", "Render", "MP4"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-3 py-1.5 font-mono ${
                      s === "MP4" || s === "prompt"
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
              Every stage emits a structured event. A bad stage can be re-run
              alone. The rest of the pipeline is preserved.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Will it fit the Aigarth architecture?"
        description="We evaluated four dimensions. Most of the platform is ready. The continuous-learning pillar is greenfield, and the most important one."
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
        description="Five phases. Re-evaluate at the end of Phase 1 with a real 30-second render before committing to Phase 2."
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
        description="30-second 1080p render on a single CPU worker. Numbers are placeholders that will change as we ship and measure."
      >
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Stage</th>
                <th className="px-4 py-3 text-right font-medium">Cost (QU)</th>
                <th className="px-4 py-3 text-right font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {[
                { stage: "Director (LLM call)", cost: "0.05", lat: "2 s" },
                { stage: "Camera (rule-based)", cost: "0.01", lat: "< 1 s" },
                { stage: "Motion (OpenCV, CPU)", cost: "0.50", lat: "60 s" },
                { stage: "Depth (MiDaS, CPU)", cost: "0.30", lat: "45 s" },
                { stage: "FX (compositing)", cost: "0.10", lat: "10 s" },
                { stage: "Audio (alignment)", cost: "0.05", lat: "5 s" },
                { stage: "Quality (model)", cost: "0.10", lat: "15 s" },
                { stage: "Render (FFmpeg)", cost: "0.05", lat: "30 s" },
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
                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">~1.16</td>
                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                  ~3 min
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-muted-foreground">
          Per-stage pre-flight estimates let the user decide: pay for a faster
          worker, swap in a cheaper ANN, or skip the stage entirely.
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
                This blocks every on-chain write in the proposal. The fix is
                to use{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">@noble/curves</code>{" "}
                (already a dep) for real K12 verification. ~3 story points
                of focused work, no new architecture.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Follow along"
        description="This is a build-in-public project. The dashboard at localhost:4000/video is the source of truth for what is real today."
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="http://localhost:4000/video" target="_blank" rel="noreferrer">
              <TrendingUp className="mr-2 h-4 w-4" />
              Live dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/docs/use-case-video-synthesis" target="_blank" rel="noreferrer">
              <Lightbulb className="mr-2 h-4 w-4" />
              Architecture evaluation
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/deliveries/phase-16-delivery" target="_blank" rel="noreferrer">
              <GitBranch className="mr-2 h-4 w-4" />
              Phase 16 delivery
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
