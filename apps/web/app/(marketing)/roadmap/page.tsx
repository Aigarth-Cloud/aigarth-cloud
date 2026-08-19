import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { Check, Circle, Sparkles, Cpu, Brain, Network, Globe, Shield } from "lucide-react";
import { Badge, Button } from "@aigarth/ui";
import Link from "next/link";

export const metadata = {
  title: "Roadmap",
  description: "The platform, the hardware, the quarters. Updated as we ship.",
};

// ---------------------------------------------------------------------------
// Status legend
// ---------------------------------------------------------------------------

const STATUS = {
  shipped: { label: "Shipped", dot: "bg-garden-500", text: "text-garden-700 dark:text-garden-300" },
  current: { label: "In progress", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  planned: { label: "Planned", dot: "bg-sky-500", text: "text-sky-700 dark:text-sky-300" },
  research: { label: "Research", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
} as const;
type Status = keyof typeof STATUS;

function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Platform phases (the underlying technology)
// ---------------------------------------------------------------------------

type Phase = {
  n: string;
  title: string;
  status: Status;
  what: string;
  quarter?: string;
};

const PLATFORM: Phase[] = [
  // Foundations
  { n: "P0-P9", title: "Foundations", status: "shipped", what: "Identity, Qubic, Compute, Gateway, Billing, ANN, Marketplace, Tissue, Dataset, Economy. The platform runs.", quarter: "Pre-2026" },
  // Intelligence
  { n: "P10-P14", title: "Intelligence expansion", status: "shipped", what: "Training orchestrator, dataset connectors, retraining, A/B shadow deployment.", quarter: "Q1 2026" },
  { n: "P15-P17", title: "Trinary + Material science", status: "shipped", what: "Trinary protocol v1. 8-ANN coordinator for material discovery. Phase 1 re-evaluation gate.", quarter: "Q2 2026" },
  { n: "P18-P19", title: "Trinary Intelligence Layer", status: "shipped", what: "5 consensus policies. Signed IntentEnvelopes. 5 training recipes. Auto-publish to ANN.", quarter: "Q2 2026" },
  // Economy
  { n: "P20-P24", title: "Economy + hardware", status: "shipped", what: "AigarthPool (30/60/10), multi-sig treasury, pre-mainnet gates, hardware presale.", quarter: "Q2-Q3 2026" },
  // Evolution
  { n: "P25", title: "Evolution PEP", status: "shipped", what: "The Aigarth evolution proposal. Approved August 12.", quarter: "Q3 2026" },
  { n: "P26", title: "Organism primitive", status: "shipped", what: "Mutable genome, lineage, memory, fitness. Garden view + marketplace listing.", quarter: "Q3 2026" },
  { n: "P27", title: "Work Runtime", status: "shipped", what: "5 new tables, 13 routes, 4-tier compute, replication + challenge + reputation verification.", quarter: "Q3 2026" },
  // Federation
  { n: "P28", title: "Federated workers", status: "planned", what: "Workers that live in your data center, your laptop, or a partner's network. Cross-deployment reputation.", quarter: "Q4 2026" },
  { n: "P29", title: "OC processor", status: "planned", what: "The Qubic on-chain processor reads Organism work items and commits 451-of-676 computor signatures.", quarter: "Q1 2027" },
  // Future
  { n: "P30", title: "Multi-workload scheduler", status: "research", what: "The scheduler becomes an economic allocator, balancing cost, latency, and reputation.", quarter: "Q2 2027" },
  { n: "P31", title: "Neuraxon integration", status: "research", what: "The Neuraxon runtime as a backend for the Trinary envelope. Contingent on Neuraxon shipping.", quarter: "Beyond" },
];

// ---------------------------------------------------------------------------
// Hardware timeline (the product form factor)
// ---------------------------------------------------------------------------

type Hardware = { name: string; tagline: string; status: Status; quarter: string };
const HARDWARE: Hardware[] = [
  { name: "Aigarth Seed", tagline: "Edge developer device. Pre-orders open.", status: "shipped", quarter: "Q3 2026" },
  { name: "Aigarth Grove", tagline: "Workstation node for studios.", status: "planned", quarter: "Q4 2026" },
  { name: "Aigarth Forest", tagline: "Rack-scale inference appliance.", status: "planned", quarter: "Q1 2027" },
  { name: "Aigarth Atlas", tagline: "Portable inference device.", status: "planned", quarter: "Q1 2027" },
  { name: "Aigarth Canopy", tagline: "Enterprise AI cluster.", status: "planned", quarter: "Q2 2027" },
  { name: "Federated inference", tagline: "Cross-region model parallelism.", status: "research", quarter: "Q2 2027" },
];

// ---------------------------------------------------------------------------
// Swimlanes: group phases by purpose
// ---------------------------------------------------------------------------

const SWIMLANES = [
  {
    icon: Shield,
    label: "Foundations",
    color: "from-slate-500 to-slate-600",
    phases: ["P0-P9", "P10-P14"],
  },
  {
    icon: Brain,
    label: "Intelligence",
    color: "from-violet-500 to-violet-600",
    phases: ["P15-P17", "P18-P19"],
  },
  {
    icon: Globe,
    label: "Economy",
    color: "from-amber-500 to-amber-600",
    phases: ["P20-P24"],
  },
  {
    icon: Sparkles,
    label: "Evolution",
    color: "from-garden-500 to-emerald-500",
    phases: ["P25", "P26", "P27"],
  },
  {
    icon: Network,
    label: "Federation",
    color: "from-sky-500 to-sky-600",
    phases: ["P28", "P29"],
  },
  {
    icon: Cpu,
    label: "Future",
    color: "from-rose-500 to-rose-600",
    phases: ["P30", "P31"],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RoadmapPage() {
  const shipped = PLATFORM.filter((p) => p.status === "shipped").length;
  const total = PLATFORM.length;
  const pct = Math.round((shipped / total) * 100);

  return (
    <>
      <MarketingPageHero
        badge="Roadmap"
        title="What we're building."
        description="A public view of the platform, the hardware, and the quarters. Updated as we ship."
        primaryCta={{ label: "Read the blog", href: "/blog" }}
        secondaryCta={{ label: "Talk to us", href: "/contact" }}
      />

      {/* Progress band */}
      <section className="border-b bg-muted/30 py-12">
        <div className="container-wide">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Platform phases shipped
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">{shipped}</span>
                <span className="text-sm text-muted-foreground">of {total}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-garden-500 to-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Current quarter
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">Q3 2026</span>
                <span className="text-sm text-muted-foreground">NOW</span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Organism primitive + Work Runtime, just shipped.
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Services running
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">12</span>
                <span className="text-sm text-muted-foreground">in production</span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Identity, Qubic, Compute, Gateway, Billing, ANN, Marketplace, Tissue, Dataset, Economy, Training, Work.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual phase grid (swimlanes) */}
      <Section
        title="Platform phases"
        description="The underlying technology, grouped by purpose. A swimlane is a product surface, not an internal team."
      >
        <div className="space-y-8">
          {SWIMLANES.map((lane) => {
            const Icon = lane.icon;
            return (
              <div key={lane.label} className="rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white ${lane.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Swimlane
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">{lane.label}</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lane.phases.map((phaseId) => {
                    const phase = PLATFORM.find((p) => p.n === phaseId);
                    if (!phase) return null;
                    return (
                      <div
                        key={phase.n}
                        className="rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              {phase.n}
                            </div>
                            <div className="mt-1 text-sm font-semibold tracking-tight">
                              {phase.title}
                            </div>
                          </div>
                          <StatusPill status={phase.status} />
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {phase.what}
                        </p>
                        {phase.quarter && (
                          <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                            {phase.quarter}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Hardware timeline */}
      <Section
        title="Hardware timeline"
        description="The product form factor, from edge to cluster."
      >
        <div className="relative">
          {/* horizontal axis */}
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-border lg:block" />
          <div className="grid gap-6 lg:grid-cols-4">
            {HARDWARE.map((hw, i) => (
              <div key={hw.name} className="relative">
                {/* node on the axis */}
                <div className="hidden lg:block">
                  <div
                    className={`absolute left-1/2 top-5 h-5 w-5 -translate-x-1/2 rounded-full border-4 border-background ${
                      hw.status === "shipped"
                        ? "bg-garden-500"
                        : hw.status === "research"
                        ? "bg-muted-foreground/40"
                        : "bg-amber-500"
                    }`}
                  />
                </div>
                <div className="rounded-2xl border bg-card p-6 lg:mt-12">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {hw.quarter}
                    </span>
                    <StatusPill status={hw.status} />
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">{hw.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{hw.tagline}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* What's shipping now */}
      <Section
        title="Shipping now"
        description="What landed in Q3 2026, and what is on deck."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border-2 border-garden-500/30 bg-garden-500/5 p-7">
            <Badge variant="glow" className="mb-3">Q3 2026 · Shipped</Badge>
            <h3 className="text-xl font-semibold tracking-tight">
              The Aigarth evolution
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The Organism primitive and the Work Runtime. Three ADRs
              (Organism, Work Runtime, OC processor) plus 60+ new test
              cases. Twelve services in production.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-garden-500" />
                <span>5 new tables (work_items, workers, work_results, worker_challenges, work_audit)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-garden-500" />
                <span>13 new routes, 4-tier compute model, replication + challenge + reputation verification</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-garden-500" />
                <span>Organism marketplace listing, Garden Organism view, billing hook</span>
              </li>
            </ul>
            <div className="mt-5">
              <Link href="/blog/the-aigarth-evolution">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Read the announcement
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-7">
            <Badge variant="outline" className="mb-3">Q4 2026 · Planned</Badge>
            <h3 className="text-xl font-semibold tracking-tight">
              Federated workers
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Workers that run in your own environment, on a partner's
              network, or on a peer device. Cross-deployment reputation
              is the open question: how does a worker's standing in one
              network translate to another?
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <span>gRPC + HTTP federated worker protocol</span>
              </li>
              <li className="flex items-start gap-2">
                <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <span>Worker manifest signed by the local deployment</span>
              </li>
              <li className="flex items-start gap-2">
                <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <span>Per-deployment reputation with cross-deployment decay</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Open questions */}
      <Section
        title="Open questions"
        description="Hard things we are not pretending to have answered."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Verification upgrade trigger
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              When do we move from replication + challenge + reputation
              to TEE or ZK? By volume, by value, by adversarial rate, or
              by a manual decision? The trigger changes the guarantee
              behind the "verified" label, so it matters.
            </p>
            <Badge variant="outline" className="mt-3 text-[10px]">ADR 006 §12 OQ 1</Badge>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Dispute resolution
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              When all three replicas disagree, who decides who is right?
              A deterministic re-run on a high-reputation worker, manual
              admin review, or a refund to the payer? Without a default,
              disputed work items never settle.
            </p>
            <Badge variant="outline" className="mt-3 text-[10px]">ADR 006 §12 OQ 2</Badge>
          </div>
        </div>
      </Section>
    </>
  );
}
