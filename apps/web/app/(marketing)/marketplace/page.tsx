"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Brain,
  Compass,
  Cpu,
  Database,
  FlaskConical,
  Globe,
  Image as ImageIcon,
  Mic,
  Network,
  PencilRuler,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  TestTube,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { Input } from "@aigarth/ui";
import { ANN_CATEGORIES, FEATURED_ANNS, type ANN } from "@/lib/anns-data";
import { StakeButton } from "@/components/stake";
import { parseStakeString } from "@/components/stake";
import { cn } from "@aigarth/utils";

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
  "book-open": Database,
  "flask-conical": FlaskConical,
  zap: Zap,
  "pencil-ruler": PencilRuler,
  "trending-up": TrendingUp,
  "test-tube": TestTube,
  "shield-check": ShieldCheck,
};

export default function MarketplacePage() {
  const [category, setCategory] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"trending" | "calls" | "accuracy" | "stake">("trending");

  const filtered = React.useMemo(() => {
    return FEATURED_ANNS.filter((a) => {
      if (category !== "All" && a.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.creator.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => {
      switch (sort) {
        case "trending":
          return b.trend - a.trend;
        case "calls":
          return parseFloat(b.monthlyCalls) - parseFloat(a.monthlyCalls);
        case "accuracy":
          return b.accuracy - a.accuracy;
        case "stake":
          return parseFloat(b.stakeRequired) - parseFloat(a.stakeRequired);
        default:
          return 0;
      }
    });
  }, [category, search, sort]);

  return (
    <>
      <Hero />
      <Filters
        category={category}
        setCategory={setCategory}
        search={search}
        setSearch={setSearch}
        sort={sort}
        setSort={setSort}
      />
      <Grid items={filtered} />
      <TopCharts />
      <PublishTeaser />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-garden-mesh" />
      <div className="container-wide relative py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="glow" className="mb-6">
            <Sparkles className="h-3 w-3" />
            ANN Marketplace
          </Badge>
          <h1 className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            Discover, deploy, and earn.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Browse hundreds of community-built ANNs. Stake behind the best.
            License what you need. Earn on what you build.
          </p>
        </div>
      </div>
    </section>
  );
}

function Filters({
  category,
  setCategory,
  search,
  setSearch,
  sort,
  setSort,
}: {
  category: string;
  setCategory: (c: string) => void;
  search: string;
  setSearch: (s: string) => void;
  sort: "trending" | "calls" | "accuracy" | "stake";
  setSort: (s: "trending" | "calls" | "accuracy" | "stake") => void;
}) {
  return (
    <section className="border-b py-6">
      <div className="container-wide">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search ANNs, creators, tags..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Sort
            </span>
            {[
              { id: "trending", label: "Trending" },
              { id: "calls", label: "Most called" },
              { id: "accuracy", label: "Highest accuracy" },
              { id: "stake", label: "Most staked" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id as typeof sort)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  sort === s.id
                    ? "border-garden-500 bg-garden-500/10 text-garden-600 dark:text-garden-400"
                    : "border-border hover:bg-accent"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {ANN_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                category === c
                  ? "border-garden-500 bg-garden-500/10 text-garden-600 dark:text-garden-400"
                  : "border-border hover:bg-accent"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Grid({ items }: { items: ANN[] }) {
  return (
    <section className="border-b py-12 md:py-16">
      <div className="container-wide">
        <div className="mb-6 text-sm text-muted-foreground">
          {items.length} ANN{items.length === 1 ? "" : "s"} found
        </div>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((ann, i) => (
              <ANNCard key={ann.id} ann={ann} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ANNCard({ ann, index }: { ann: ANN; index: number }) {
  const Icon = ICONS[ann.icon] || Brain;
  const isMaterialScience = ann.tags.some((t) => t === "material-science");
  const detailsHref = `/marketplace/${ann.id}`;
  const minStake = parseStakeString(ann.stakeRequired) ?? undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
      className="group relative flex flex-col rounded-2xl border bg-card p-5 card-hover"
    >
      {/* Top row: icon (left) + License + Hot stacked (right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <Badge variant="outline" className="text-[10px]">
            {ann.licenseType}
          </Badge>
          {ann.trend >= 15 && (
            <Badge variant="glow" className="text-[10px]">
              <TrendingUp className="h-2.5 w-2.5" />
              Hot
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-semibold tracking-tight">{ann.name}</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          by {ann.creator}
        </p>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {ann.description}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-xs">
        <div>
          <div className="text-muted-foreground">Accuracy</div>
          <div className="mt-0.5 font-mono text-garden-600 dark:text-garden-400">
            {ann.accuracy.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Latency</div>
          <div className="mt-0.5 font-mono">
            {ann.latencyMs < 1000 ? `${ann.latencyMs}ms` : `${(ann.latencyMs / 1000).toFixed(1)}s`}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Calls / mo</div>
          <div className="mt-0.5 font-mono">{ann.monthlyCalls}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Stake required</span>
          <span className="font-mono">{ann.stakeRequired}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Price per call</span>
          <span className="font-mono">{ann.pricePerCall} QUBIC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Monthly revenue</span>
          <span className="font-mono text-garden-600 dark:text-garden-400">
            {ann.revenue}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {ann.tags.slice(0, 3).map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px]">
            {t}
          </Badge>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Button asChild size="sm" className="flex-1 gap-1">
          <Link href={detailsHref}>
            View details
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Button>
        <StakeButton
          size="sm"
          variant="outline"
          className="flex-1 gap-1"
          context={{
            label: ann.name,
            purpose: isMaterialScience
              ? "Unlock this material science ANN in the Aigarth marketplace."
              : "Unlock this ANN in the Aigarth marketplace.",
            minStakeQubic: minStake,
            successHref: "/dashboard",
          }}
          defaultAmount={ann.stakeRequired.replace(" QUBIC", "")}
        />
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No ANNs match your filters</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try a different category or clear the search.
      </p>
    </div>
  );
}

function TopCharts() {
  const charts = [
    { title: "Top by calls this week", items: FEATURED_ANNS.slice(0, 5) },
    { title: "Top by revenue this month", items: [...FEATURED_ANNS].sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue)).slice(0, 5) },
    { title: "New and rising", items: [...FEATURED_ANNS].sort((a, b) => b.trend - a.trend).slice(0, 5) },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Top charts
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            What's working.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {charts.map((chart) => (
            <div key={chart.title} className="rounded-2xl border bg-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {chart.title}
              </h3>
              <div className="mt-5 space-y-3">
                {chart.items.map((ann, i) => (
                  <div key={ann.id} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-mono">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{ann.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ann.category} · {ann.creator}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs">{ann.monthlyCalls}</div>
                      <div className="text-[10px] text-muted-foreground">calls</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PublishTeaser() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
              Build & publish
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
              Ship your ANN to the network.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              Train, version, license, and publish. The studio handles signing,
              benchmarks, marketplace listing, and revenue splits.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button className="gap-1.5">
                  Open the studio
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="outline">Read the docs</Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "Train", body: "Distributed training on your data" },
              { title: "Version", body: "Bake in license, benchmarks, price" },
              { title: "Sign", body: "Cryptographic manifest published on-chain" },
              { title: "Earn", body: "Revenue auto-distributed to creators" },
            ].map((step) => (
              <div key={step.title} className="rounded-xl border bg-card p-5">
                <h3 className="font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
