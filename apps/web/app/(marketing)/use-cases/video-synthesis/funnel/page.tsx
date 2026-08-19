import {
  Eye,
  Camera,
  Move,
  Layers,
  Sparkles,
  Music,
  ShieldCheck,
  Link as LinkIcon,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Code2,
  Coins,
  Lightbulb,
  Server,
  Sprout,
  Users,
} from "lucide-react";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Button, Badge } from "@aigarth/ui";
import { StakeButton } from "@/components/stake";
import Link from "next/link";

export const metadata = {
  title: "Stake to produce the next viral short: Aigarth video synthesis ANNs",
  description:
    "8 specialized video production ANNs are live. Stake QUBIC to back the next short-form video pipeline. A prompt in, a finished MP4 out, every stage on chain.",
};

// =============================================================================
//  Static manifest: mirrors services/ann/src/db/seed-anns.ts (Phase 18 stub)
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
    slug: "vid-director",
    name: "Director",
    role: "director",
    tagline: "Reads the prompt, plans the shot list. Returns structured JSON for scenes, durations, camera, audio, and style.",
    accuracy: 93.4,
    latencyMs: 3000,
    pricePerCall: "0.00003",
    stakeRequired: "2M QUBIC",
    license: "Open",
    icon: Eye,
  },
  {
    slug: "vid-camera",
    name: "Camera",
    role: "camera",
    tagline: "Picks the cinematic move. Slow push in? Dolly left? Whip pan? Knows 50 moves and when to use each.",
    accuracy: 91.7,
    latencyMs: 1500,
    pricePerCall: "0.00002",
    stakeRequired: "1.5M QUBIC",
    license: "Open",
    icon: Camera,
  },
  {
    slug: "vid-motion",
    name: "Motion",
    role: "motion",
    tagline: "Generates in-between frames from a keyframe and a camera move. Pure interpolation, deterministic, fast on CPU.",
    accuracy: 89.2,
    latencyMs: 12000,
    pricePerCall: "0.0002",
    stakeRequired: "6M QUBIC",
    license: "Commercial",
    icon: Move,
  },
  {
    slug: "vid-depth",
    name: "Depth",
    role: "depth",
    tagline: "Foreground / background separation for parallax and depth-of-field. Uses MiDaS on CPU.",
    accuracy: 94.1,
    latencyMs: 4000,
    pricePerCall: "0.00005",
    stakeRequired: "2M QUBIC",
    license: "Open",
    icon: Layers,
  },
  {
    slug: "vid-fx",
    name: "FX",
    role: "fx",
    tagline: "Particles, steam, light glows, atmosphere. Domain-specific. A Steam FX ANN and a Rain FX ANN can coexist.",
    accuracy: 87.6,
    latencyMs: 8000,
    pricePerCall: "0.0001",
    stakeRequired: "4M QUBIC",
    license: "Commercial",
    icon: Sparkles,
  },
  {
    slug: "vid-audio",
    name: "Audio",
    role: "audio",
    tagline: "Aligns narration, music, and sound effects to the timeline. Knows when to dip the music under a voice.",
    accuracy: 92.3,
    latencyMs: 6000,
    pricePerCall: "0.00008",
    stakeRequired: "3M QUBIC",
    license: "Open",
    icon: Music,
  },
  {
    slug: "vid-quality",
    name: "Quality",
    role: "quality",
    tagline: "Watches the result. Spots artifacts, weird motion, dropped frames. Decides whether to ship or to re-run a stage.",
    accuracy: 96.5,
    latencyMs: 5000,
    pricePerCall: "0.00006",
    stakeRequired: "2.5M QUBIC",
    license: "Open",
    icon: ShieldCheck,
  },
  {
    slug: "vid-continuity",
    name: "Continuity",
    role: "continuity",
    tagline: "Maintains visual consistency across cuts: same character, same outfit, same lighting. Catches continuity drift before the Quality pass.",
    accuracy: 90.8,
    latencyMs: 3500,
    pricePerCall: "0.00004",
    stakeRequired: "2M QUBIC",
    license: "Commercial",
    icon: LinkIcon,
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
    desc: "Developer / studio. Earn allocation, deploy video ANNs, get marketplace priority.",
    highlight: "For people who will build and run on the network.",
    cta: "Become a Builder",
    featured: true,
  },
  {
    name: "Infrastructure Partner",
    icon: Server,
    desc: "GPU operator. Register a motion or render worker, earn per call.",
    highlight: "For render farms with idle GPU.",
    cta: "Become a Partner",
  },
  {
    name: "Enterprise Partner",
    icon: Building2,
    desc: "Organization. Private cluster, dedicated support, custom SLAs.",
    highlight: "For studios, agencies, and post-production houses.",
    cta: "Talk to us",
  },
];

export default function VideoSynthesisStakeFunnelPage() {
  return (
    <>
      <MarketingPageHero
        badge="Video synthesis · 8 ANNs live · Phase 0"
        title="Stake to produce the next viral short."
        highlight="Prompt in. 8-role video crew out."
        description="Eight specialized video ANNs collaborate on every short. A prompt becomes a structured shot list, a sequence of in-between frames, a depth pass, an FX pass, an audio mix, and a final quality review. Stake QUBIC to participate in the network, and in the revenue when a finished short ships."
      />

      <div className="container-wide border-b py-10">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <StakeButton
              size="lg"
              context={{
                label: "Aigarth video production",
                purpose:
                  "Fund the next viral short. ~600 QUBIC / month covers ~50 short-form productions.",
                minStakeQubic: 600_000_000,
                successHref: "/dashboard",
              }}
              defaultAmount="600M"
            >
              <Coins className="mr-2 h-4 w-4" />
              Stake QUBIC on Qubic
            </StakeButton>
          </Button>
          <Button asChild variant="outline">
            <Link href="http://localhost:4000/video" target="_blank" rel="noreferrer">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Open the live dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* ============ The 8 ANNs ============ */}
      <Section
        title="The crew"
        description="Eight small, specialized ANNs collaborate to produce a finished short. Each is published, versioned, rateable, and live in the Aigarth marketplace today."
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
          ship once the Qubic verification milestone lands.
        </p>
      </Section>

      {/* ============ The math ============ */}
      <Section
        title="The math"
        description="Real numbers from the Phase 18 architecture evaluation. Every cost and every revenue share is visible before you commit."
      >
        <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
          {[
            {
              stat: "~12 QU",
              label: "Cost of a single 60-second short",
              sub: "Motion and FX stages dominate at ~70% of the total.",
            },
            {
              stat: "~600 QU / mo",
              label: "Stake to fund ~50 productions per month",
              sub: "A monthly reservation, billed per finished short.",
            },
            {
              stat: "30% / 50% / 10% / 10%",
              label: "Revenue share: stakers / workers / creators / treasury",
              sub: "Stakers get 30%. A 600 QU/month stake earns 0.3 × network revenue.",
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
          and measure. The cost structure matters more than the number. A creator can
          always see the per-stage breakdown before committing.
        </p>
      </Section>

      {/* ============ How a production flows ============ */}
      <Section
        title="How a production flows"
        description="A prompt becomes a plan. Each stage consumes the plan and produces an artifact. The Quality ANN at the end decides whether to ship or to flag a stage for re-run."
      >
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
              {["prompt", "Director", "Camera", "Motion", "Depth", "FX", "Audio", "Quality", "Continuity", "MP4"].map((s, i) => (
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
                  {i < 9 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Every stage emits a structured artifact with confidence. A bad stage can
              be re-run alone. The rest of the pipeline is preserved.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-6 grid max-w-4xl gap-3 md:grid-cols-3">
          {[
            {
              title: "Pre-flight estimate",
              body: "The Director's plan includes a per-stage cost + duration. The user must confirm before the pipeline starts. No $100 surprise at the end.",
            },
            {
              title: "MLIP surrogate first",
              body: "The Motion ANN routes through a fast surrogate before paying for full inference. Cuts wall time by ~6× and cost by ~5×.",
            },
            {
              title: "Input-deck caching",
              body: "The same shot is never paid for twice. The orchestrator hashes the input deck and serves from cache.",
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
        description="When a finished short is published, the on-chain attribution is fixed immediately. That's what makes it useful as a real credit in a real portfolio."
      >
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-md border border-amber-500/30 bg-background/50 p-2">
                <Lightbulb className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <div className="text-sm font-medium">production_attribution contract</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  A new Qubic primitive that ships in Phase 4. The publish action is{" "}
                  <strong>one-way and immediate</strong>: not via daily rollup. Once a
                  short is published, the ANN authors, the workers who ran the renders,
                  the creators who funded the production, and the stakers who backed
                  the network are all recorded. Immutable. Creditable.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  The same primitive is reusable for other high-stakes creative use
                  cases: branded content, music videos, advertising. The architecture
                  stands to benefit more than just short-form video.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ============ Why this fits the existing stack ============ */}
      <Section
        title="Why this fits the existing Aigarth stack"
        description="Same registry, same compute, same marketplace. The 8 video ANNs run on the same infrastructure that powers the rest of the platform. No new architecture."
      >
        <FeatureGrid
          features={[
            {
              icon: Server,
              title: "services/ann: registry, versioning, reviews, deploy",
              body: "All 8 ANNs are published, versioned, rateable, and deployable as compute jobs. Same as the other ANNs in the marketplace today.",
            },
            {
              icon: Users,
              title: "services/marketplace: listings, offers, auctions",
              body: "License the whole 8-ANN pipeline as a single pre-composed '60s Short Production Pack' listing. Pay per call, or per finished video.",
            },
            {
              icon: Sparkles,
              title: "services/gateway: LLM call routing",
              body: "Director, Camera, Continuity route through the OpenAI-compatible gateway. Real LLM today, stub during Phase 0.",
            },
            {
              icon: Coins,
              title: "services/qubic: Qearn staking, on-chain registry",
              body: "Stake QUBIC on Qubic → Aigarth credit balance → per-production deduction. Revenue share flows back to stakers via Qearn.",
            },
          ]}
        />
      </Section>

      {/* ============ Stake to participate ============ */}
      <Section
        title="Stake to participate"
        description="Four ways to join. Most creators and studios start with the Builder tier. GPU operators with idle cycles go straight to Infrastructure Partner."
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
                        ? "Earn allocation, deploy video ANNs, get marketplace priority."
                        : tier.name === "Infrastructure Partner"
                        ? "Register a GPU worker, earn per render."
                        : tier.name === "Enterprise Partner"
                        ? "Private cluster, dedicated support, custom SLAs."
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
          . Video synthesis participants get marketplace priority placement and
          0% commission on the first 500 productions (Phase 0 promo).
        </p>
      </Section>

      {/* ============ Roadmap ============ */}
      <Section
        title="What ships next"
        description="5 phases, ~95 story points estimated total. Phase 0 is done: 8 ANNs live as stubs. Re-evaluation gate at the end of Phase 1."
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
              desc: "Worker registry, worker protocol, aigarth/worker-video image. Real per-stage cost.",
            },
            {
              phase: 4,
              name: "Qubic ecosystem",
              status: "later",
              desc: "On-chain ANN ownership, worker registry, reputation, rewards. Off-chain rollups committed to chain.",
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
        title="Stake. Train. Render."
        description="The 8 ANNs are live today on stubs. The Phase 1 centralized prototype is the first real gate. Stake to be part of the founding moment, and to participate in the revenue when the first finished short ships."
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <StakeButton
              size="lg"
              context={{
                label: "Aigarth video production",
                purpose:
                  "Fund the next viral short. ~600 QUBIC / month covers ~50 short-form productions.",
                minStakeQubic: 600_000_000,
                successHref: "/dashboard",
              }}
              defaultAmount="600M"
            >
              <Coins className="mr-2 h-4 w-4" />
              Stake QUBIC on Qubic
            </StakeButton>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="http://localhost:3003/use-cases/video-synthesis" target="_blank" rel="noreferrer">
              Read the full use case
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="http://localhost:4000/video" target="_blank" rel="noreferrer">
              Open the build-in-public tracker
            </Link>
          </Button>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
          This page is part of the Aigarth Cloud Genesis Offering. Numbers are
          illustrative Phase 0 placeholders that will change as we ship and measure.
          The dashboard at localhost:4000/video is the source of truth for what
          is real today.
        </p>
      </Section>
    </>
  );
}
