import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  FlaskConical,
  Globe,
  Image as ImageIcon,
  Mic,
  Network,
  PencilRuler,
  Shield,
  ShieldCheck,
  Sparkles,
  TestTube,
  TrendingUp,
  Zap,
  BookOpen,
  Atom,
} from "lucide-react";
import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { Button, Badge } from "@aigarth/ui";
import { FEATURED_ANNS, ANN_CATEGORIES, type ANN } from "@/lib/anns-data";
import { StakeButton, parseStakeString } from "@/components/stake";

// ============================================================================
//  Static icon map: same as the marketplace listing
// ============================================================================

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  scan: Shield,
  scale: Shield,
  trend: TrendingUp,
  code: Cpu,
  feed: Network,
  voice: Mic,
  atom: Sparkles,
  shield: Shield,
  agent: Brain,
  image: ImageIcon,
  book: Database,
  cad: Globe,
  // Material Science ANNs (Phase 17)
  compass: Compass,
  "book-open": BookOpen,
  "flask-conical": FlaskConical,
  zap: Zap,
  "pencil-ruler": PencilRuler,
  "trending-up": TrendingUp,
  "test-tube": TestTube,
  "shield-check": ShieldCheck,
};

// ============================================================================
//  Static helpers: purely Phase 0 placeholders. Real data comes from
//  services/ann at the live API in Phase 1.
// ============================================================================

const PRICING_TIERS = [
  {
    name: "Starter",
    desc: "Try the ANN with a 1,000-call reservation. No commitment.",
    price: "Free for 1,000 calls",
  },
  {
    name: "Reservation",
    desc: "Pre-purchased capacity. 10% discount on per-call pricing.",
    price: "1,000 QU / month",
  },
  {
    name: "Custom",
    desc: "Private deployment, dedicated worker, custom SLAs.",
    price: "Talk to us",
  },
];

const VERSION_HISTORY = [
  { version: "1.0.0", date: "Aug 2, 2026", status: "current", notes: "Initial release (Phase 0 stub backend)." },
  { version: "0.9.0", date: "Jul 24, 2026", status: "beta", notes: "Internal preview. Used for 1,000-paper ingestion benchmark." },
  { version: "0.5.0", date: "Jul 12, 2026", status: "deprecated", notes: "First preview. Performance baseline." },
];

// ============================================================================
//  Page
// ============================================================================

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return FEATURED_ANNS.map((a) => ({ slug: a.id }));
}

export function generateMetadata({ params }: PageProps) {
  const ann = FEATURED_ANNS.find((a) => a.id === params.slug);
  if (!ann) return { title: "ANN not found: Aigarth" };
  return {
    title: `${ann.name}: Aigarth ANN marketplace`,
    description: ann.tagline,
  };
}

export default function ANNDetailPage({ params }: PageProps) {
  const ann = FEATURED_ANNS.find((a) => a.id === params.slug);
  if (!ann) notFound();

  const Icon = ICONS[ann.icon] || Brain;
  const isMaterialScience = ann.tags.some((t) => t === "material-science");
  const minStake = parseStakeString(ann.stakeRequired) ?? undefined;
  const related = FEATURED_ANNS.filter(
    (a) => a.id !== ann.id && a.tags.some((t) => ann.tags.includes(t)),
  ).slice(0, 3);
  const fallbackRelated = FEATURED_ANNS.filter(
    (a) => a.id !== ann.id && a.category === ann.category,
  ).slice(0, 3);
  const finalRelated = related.length > 0 ? related : fallbackRelated;

  return (
    <>
      <Breadcrumbs name={ann.name} category={ann.category} />
      <Hero ann={ann} Icon={Icon} minStake={minStake} />
      <Capability ann={ann} />
      <Stats ann={ann} />
      <DemoInput ann={ann} Icon={Icon} />
      <Pricing ann={ann} minStake={minStake} />
      <RelatedAnns related={finalRelated} />
      <VersionHistory />
      <FinalCta ann={ann} minStake={minStake} isMaterialScience={isMaterialScience} />
    </>
  );
}

// ============================================================================
//  Components
// ============================================================================

function Breadcrumbs({ name, category }: { name: string; category: string }) {
  return (
    <div className="container-wide pt-8">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/marketplace" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Marketplace
        </Link>
        <span>/</span>
        <span className="text-foreground/60">{category}</span>
        <span>/</span>
        <span className="text-foreground">{name}</span>
      </nav>
    </div>
  );
}

function Hero({
  ann,
  Icon,
  minStake,
}: {
  ann: ANN;
  Icon: React.ComponentType<{ className?: string }>;
  minStake: number | undefined;
}) {
  return (
    <section className="container-wide border-b py-12 md:py-16">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {ann.category}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {ann.licenseType}
            </Badge>
            {ann.trend >= 15 && (
              <Badge variant="glow" className="text-[10px]">
                <TrendingUp className="h-2.5 w-2.5" />
                Hot · +{ann.trend}% this week
              </Badge>
            )}
          </div>
          <h1 className="mt-4 text-balance font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
            {ann.name}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {ann.tagline}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            by <span className="font-medium text-foreground">{ann.creator}</span>
          </p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-foreground/80">
            {ann.description}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" className="gap-1.5">
              Deploy this ANN
              <ArrowRight className="h-4 w-4" />
            </Button>
            <StakeButton
              size="lg"
              variant="outline"
              className="gap-1.5"
              context={{
                label: ann.name,
                purpose: "Unlock this ANN in the Aigarth marketplace.",
                minStakeQubic: minStake,
                successHref: "/dashboard",
              }}
              defaultAmount={ann.stakeRequired.replace(" QUBIC", "")}
            >
              Stake to deploy
            </StakeButton>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Deploy is a Phase 0 stub. Real per-stage cost, MLIP surrogate, and on-chain
            attribution ship in Phase 2.
          </p>
        </div>

        <div className="flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-garden-500/10 via-transparent to-emerald-500/5 blur-3xl" />
            <div className="relative flex h-48 w-48 items-center justify-center rounded-3xl border bg-card md:h-64 md:w-64">
              <Icon className="h-24 w-24 text-primary md:h-32 md:w-32" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Capability({ ann }: { ann: ANN }) {
  return (
    <Section
      title="What it does"
      description="One sentence. The capability the ANN exposes, and the one thing it does really well."
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-garden-500/30 bg-garden-500/5 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-garden-500/30 bg-background/50 p-2">
            <CheckCircle2 className="h-5 w-5 text-garden-600 dark:text-garden-400" />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-garden-600 dark:text-garden-400">
              Capability
            </div>
            <p className="mt-2 text-balance text-lg leading-relaxed text-foreground/90">
              {ann.capability}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Stats({ ann }: { ann: ANN }) {
  const stats = [
    { label: "Accuracy", value: `${ann.accuracy.toFixed(1)}%`, note: "Phase 0 stub benchmark" },
    { label: "Latency (p50)", value: ann.latencyMs < 1000 ? `${ann.latencyMs} ms` : `${(ann.latencyMs / 1000).toFixed(1)} s`, note: "On a single CPU worker" },
    { label: "Price / call", value: ann.pricePerCall === "Free" ? "Free" : `${ann.pricePerCall} QU`, note: "Billed via the platform credit balance" },
    { label: "Stake required", value: ann.stakeRequired, note: "Locked in Qearn to unlock access" },
    { label: "Calls / month", value: ann.monthlyCalls, note: "Live metrics appear once deployed" },
    { label: "Monthly revenue", value: ann.revenue, note: "Creator share + staker share + protocol fee" },
  ];
  return (
    <Section
      title="At a glance"
      description="The numbers the marketplace uses to rank this ANN. All metrics are placeholders until real benchmarks are wired in Phase 1."
    >
      <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div className="mt-2 font-mono text-2xl tabular-nums">{s.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DemoInput({
  ann,
  Icon,
}: {
  ann: ANN;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Section
      title="Try it"
      description="A realistic example input. The output you see on this page is from a Phase 0 stub backend. The format, latency, and cost are real, the data is illustrative."
    >
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs">
            <Icon className="h-3.5 w-3.5" />
            <span className="font-mono text-foreground/70">POST /v1/anns/{ann.id}/call</span>
          </div>
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b bg-background p-4 md:border-b-0 md:border-r">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Input
              </div>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">
                <code>{JSON.stringify({ prompt: ann.demoInputExample }, null, 2)}</code>
              </pre>
            </div>
            <div className="bg-background p-4">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Output (Phase 0 stub)
              </div>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">
                <code>{JSON.stringify(stubOutput(ann), null, 2)}</code>
              </pre>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Real engine integration ships in Phase 2. The wire format here is what the real
          response will look like.
        </p>
      </div>
    </Section>
  );
}

function stubOutput(ann: ANN): Record<string, unknown> {
  // Deterministic Phase 0 stub output. Real response in Phase 2.
  if (ann.id.startsWith("mat-")) {
    if (ann.id === "mat-simulation-runner") {
      return {
        formation_energy_eV_per_atom: -2.4,
        band_gap_eV: 3.1,
        bulk_modulus_GPa: 184.0,
        uncertainty: { formation_energy: 0.3, band_gap: 0.2, bulk_modulus: 12.0 },
        engine: "vasp-stub",
        wall_clock_seconds: 3600,
        converged: true,
      };
    }
    if (ann.id === "mat-physics-reasoner") {
      return {
        score: 0.85,
        verdict: "plausible",
        flags: [],
        notes: "Formation energy in expected range for layered oxide.",
      };
    }
    if (ann.id === "mat-validation-engine") {
      return {
        confidence: 0.72,
        literature_match: true,
        prior_measurements: 14,
        citations: ["J. Electrochem. Soc. 2024", "Nat. Mater. 2023"],
      };
    }
    return { capability: ann.capability, status: "ok" };
  }
  return {
    result: "ok",
    confidence: 0.9,
    note: "Phase 0 stub output: real inference ships in Phase 1.",
  };
}

function Pricing({ ann, minStake }: { ann: ANN; minStake: number | undefined }) {
  return (
    <Section
      title="Pricing"
      description="Three ways to use this ANN. Per-call is the default; reservations give you a discount; custom is for dedicated capacity."
    >
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <div key={tier.name} className="rounded-xl border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {tier.name}
            </div>
            <div className="mt-2 text-lg font-semibold">{tier.price}</div>
            <p className="mt-2 text-sm text-muted-foreground">{tier.desc}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-6 max-w-3xl rounded-xl border bg-card/50 p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              License
            </div>
            <div className="mt-1 font-semibold">{ann.licenseType}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ann.licenseType === "Open"
                ? "Anyone can use, modify, and redistribute. Free of charge."
                : "Pay-per-call licensing. Commercial use allowed. No modification or redistribution."}
            </p>
          </div>
          <Button asChild>
            <StakeButton
              context={{
                label: ann.name,
                purpose: "Unlock this ANN in the Aigarth marketplace.",
                minStakeQubic: minStake,
                successHref: "/dashboard",
              }}
              defaultAmount={ann.stakeRequired.replace(" QUBIC", "")}
            >
              Stake {ann.stakeRequired} to unlock
            </StakeButton>
          </Button>
        </div>
      </div>
    </Section>
  );
}

function RelatedAnns({ related }: { related: ANN[] }) {
  if (related.length === 0) return null;
  return (
    <Section
      title="Related ANNs"
      description="Other ANNs in the marketplace that share tags with this one."
    >
      <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((ann) => {
          const Icon = ICONS[ann.icon] || Brain;
          return (
            <Link
              key={ann.id}
              href={`/marketplace/${ann.id}`}
              className="group rounded-xl border bg-card p-4 card-hover"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{ann.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    by {ann.creator}
                  </div>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                {ann.tagline}
              </p>
              <div className="mt-3 flex items-center justify-between text-[10px]">
                <span className="font-mono text-muted-foreground">
                  {ann.accuracy.toFixed(1)}% acc
                </span>
                <span className="inline-flex items-center gap-1 text-primary">
                  View
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

function VersionHistory() {
  return (
    <Section
      title="Version history"
      description="Every revision is a separate ANN with its own benchmarks. The current version is what's served by default."
    >
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Version</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {VERSION_HISTORY.map((v) => (
                <tr key={v.version} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">v{v.version}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{v.date}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        v.status === "current"
                          ? "glow"
                          : v.status === "beta"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{v.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Real version history wired in Phase 1. For now, this is a
          static manifest.
        </p>
      </div>
    </Section>
  );
}

function FinalCta({
  ann,
  minStake,
  isMaterialScience,
}: {
  ann: ANN;
  minStake: number | undefined;
  isMaterialScience: boolean;
}) {
  return (
    <Section
      title={`Try ${ann.name}`}
      description={
        isMaterialScience
          ? "This is one of the 8 material science ANNs in the Aigarth marketplace. Stake to participate in the network, and in the revenue when a discovery ships."
          : "Deploy this ANN on the Aigarth platform, or stake to participate in the network."
      }
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
        <Button size="lg" className="gap-1.5">
          Deploy this ANN
          <ArrowRight className="h-4 w-4" />
        </Button>
        <StakeButton
          size="lg"
          variant="outline"
          className="gap-1.5"
          context={{
            label: ann.name,
            purpose: isMaterialScience
              ? "Unlock this material science ANN in the marketplace."
              : "Unlock this ANN in the Aigarth marketplace.",
            minStakeQubic: minStake,
            successHref: "/dashboard",
          }}
          defaultAmount={ann.stakeRequired.replace(" QUBIC", "")}
        >
          <Clock className="mr-1.5 h-4 w-4" />
          Stake to deploy
        </StakeButton>
        <Button asChild size="lg" variant="ghost" className="gap-1.5">
          <Link href="/marketplace">
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
        </Button>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
        Deploy is a Phase 0 stub. Real per-stage cost, MLIP surrogate, and on-chain
        attribution ship in Phase 2. The dashboard at localhost:4000/material-science
        is the source of truth for what is real today.
      </p>
    </Section>
  );
}
