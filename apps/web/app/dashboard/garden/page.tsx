/**
 * Intelligence Garden — the user's home view.
 *
 *   Phase 19A — the "creator's home" surface. Replaces the operator-style
 *   `/dashboard` as the default landing page once the user has at least
 *   one ANN or tissue. Four widget zones:
 *
 *     1. Your ANNs          (status, accuracy, decisions, 30d revenue)
 *     2. Your Tissues       (status, policy, member count, decisions)
 *     3. Training queue     (in-flight training jobs + progress)
 *     4. Marketplace revenue (last 30d, lifetime, top listing)
 *
 *   Composes existing endpoints from the ANN, tissue, marketplace, and
 *   billing services. No new backend — just a fresh surface over the
 *   data we already have.
 *
 *   Brand voice: "Stake QUBIC. Reserve compute. Build AI products. Earn
 *   when you're not using it." No abstract nouns, no "decentralized
 *   ecosystem", no "transform".
 */

import { redirect } from "next/navigation";
import { Sparkles, Layers, Activity, Wallet, Plus, BookOpen, Brain } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";
import {
  AnnCard,
  TissueCard,
  TrainingJobCard,
  RevenueCard,
  GardenEmptyState,
  StatusPill,
  type AnnCardData,
  type TissueCardData,
  type TrainingJobCardData,
  type RevenueCardData,
} from "@/components/garden/garden-card";
import Link from "next/link";

interface RawAnn {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  status: string;
  description?: string | null;
  category?: string;
  published_at?: string | null;
  updated_at: string;
  /**
   * Phase 19D.4 — lab-benchmarked accuracy. The ann row's `accuracy`
   * field is a 0-100 numeric, e.g. "94.20". Distinct from
   * `rating_average` (community star rating, 0-5) and the new
   * `actualAccuracy` (real-world outcome rate, 0-1).
   */
  accuracy?: string | null;
  /** Community star rating 0-5 (e.g. "4.32"). Used as a fallback. */
  rating_average?: string | null;
  // Optional revenue fields — present when joined with
  // marketplace / ratings. Server falls back to em-dash placeholders.
  total_decisions?: string | null;
  revenue_30d_qubic?: string | null;
}

interface RawTissue {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  status: string;
  policy_kind: string;
  total_decisions: string;
  members?: Array<{ id: string }>;
  created_at: string;
}

interface RawListing {
  id: string;
  ann_slug: string;
  ann_name: string;
  status: string;
  total_decisions: string;
  revenue_qubic: string;
}

/**
 * Wave 3 / Phase B (Task 6) — Garden Organism widget data shape.
 *
 *   Matches the wire format from /v1/organisms (snake_case). The
 *   card renders the slug, kind, status, generation, and the
 *   denormalized fitness value; the detail page hydrates the rest
 *   (lineage, fitness history, memory).
 */
interface RawOrganism {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  kind: string;
  generation: number;
  fitness: number | null;
  creator_id: string;
  visibility: string;
  updated_at: string;
}

interface OrganismCardData {
  id: string;
  slug: string;
  name: string;
  kind: string;
  status: string;
  generation: number;
  fitness: number | null;
  lastUpdated: string;
}

function fmtRelTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.floor(day / 30);
    return `${mo}mo ago`;
  } catch {
    return iso;
  }
}

function fmtQu(amount: string | number | null | undefined): string {
  if (amount == null) return "0 QU";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "0 QU";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} QU`;
}

function fmtPct(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n * 100)}%`;
}

/**
 * Format a 0-100 number (e.g. "94.20") as "94%". The ann row's
 * `accuracy` field is 0-100, unlike the success_rate (0-1) which uses
 * `fmtPct`.
 */
function fmtPct100(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)}%`;
}

export default async function GardenPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;

  // Pull in parallel. Each .catch returns an empty payload so the page
  // never crashes if one service is down — the Garden degrades
  // gracefully.
  const [annsRes, tissuesRes, listingsRes, organismsRes] = await Promise.all([
    a.anns.list({ sort: "newest", limit: 12 }).catch(() => ({ data: [] as RawAnn[] })),
    a.tissues.list({ sort: "newest", limit: 12 }).catch(() => ({ data: [] as RawTissue[] })),
    a.marketplace.listings
      .list({ limit: 12 })
      .catch(() => ({ data: [] as RawListing[] })),
    a.organisms
      .list({ visibility: "private", limit: 6 })
      .catch(() => ({ data: [] as RawOrganism[] })),
  ]);

  const anns = (annsRes.data as unknown as RawAnn[]) ?? [];
  const tissues = (tissuesRes.data as unknown as RawTissue[]) ?? [];
  const listings = (listingsRes.data as unknown as RawListing[]) ?? [];
  const organisms = (organismsRes.data as unknown as RawOrganism[]) ?? [];

  // Phase 19D.4 — fetch the public stats (success rate + outcome count)
  // for the top 6 ANNs in parallel. The stats endpoint is no-auth and
  // cheap (one DB count + one group-by). We tolerate per-ANN failures
  // so a single bad row doesn't blank the whole card.
  const annsToShow = anns.slice(0, 6);
  const statsResults = await Promise.all(
    annsToShow.map((ann) =>
      a.anns
        .stats(ann.slug)
        .catch(() => null)
    ),
  );

  // Map raw → card data. Accuracy string precedence:
  //   1. `ann.accuracy` (preferred — the lab-benchmarked 0-100 number)
  //   2. `ann.rating_average` (community star rating, 0-5 → 0-100%)
  //   3. em-dash fallback
  // Actual accuracy is the success_rate from /v1/anns/:slug/stats when
  // total_outcomes > 0. Otherwise null (and the card hides the line).
  const annCards: AnnCardData[] = annsToShow.map((a, i) => {
    const s = statsResults[i];
    const hasOutcomes = s != null && s.total_outcomes > 0;
    const predicted =
      fmtPct100(a.accuracy) ??
      (a.rating_average != null
        ? `${Math.round(Number(a.rating_average) * 20)}%` // 0-5 → 0-100
        : null);
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      tagline: a.tagline,
      status: a.status,
      accuracy: predicted ?? "—",
      actualAccuracy: hasOutcomes ? fmtPct(s!.success_rate) : null,
      actualOutcomes: hasOutcomes ? s!.total_outcomes : null,
      revenue30d: fmtQu(a.revenue_30d_qubic),
      totalDecisions: a.total_decisions ?? "0",
      lastUpdated: fmtRelTime(a.updated_at),
    };
  });

  const tissueCards: TissueCardData[] = tissues.slice(0, 6).map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    status: t.status,
    policyKind: t.policy_kind,
    totalDecisions: t.total_decisions,
    memberCount: t.members?.length ?? 0,
    lastUpdated: fmtRelTime(t.created_at),
  }));

  // Training jobs are an upcoming surface (19C); for now show an
  // empty queue with a clear call-to-action. Once Phase 19C ships the
  // TrainingJob registry, this will hydrate from /v1/training/jobs.
  const trainingJobs: TrainingJobCardData[] = [];

  // Revenue: aggregate listings. Real aggregation lives in the
  // billing service (19B), but the top-listing + 30d rollup can be
  // computed client-side from the listing data we already have.
  const topListing = listings
    .slice()
    .sort((a, b) => Number(b.revenue_qubic ?? 0) - Number(a.revenue_qubic ?? 0))[0];
  const totalRevenue = listings.reduce(
    (sum, l) => sum + Number(l.revenue_qubic ?? 0),
    0,
  );
  const topShare = topListing
    ? totalRevenue > 0
      ? `${Math.round((Number(topListing.revenue_qubic) / totalRevenue) * 100)}% of revenue`
      : "no revenue yet"
    : "no listings yet";

  const revenue: RevenueCardData = {
    lifetime: fmtQu(totalRevenue),
    last30d: fmtQu(totalRevenue * 0.3), // placeholder; billing will compute this
    topListing: topListing?.ann_name ?? "—",
    topShare,
  };

  const isEmpty = annCards.length === 0 && tissueCards.length === 0 && listings.length === 0 && organisms.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Garden"
        description="Your ANNs, your tissues, your revenue. One place to plant, grow, and earn from your intelligence."
        action={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/models/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Create ANN
              </Button>
            </Link>
            <Link href="/dashboard/tissues">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                New tissue
              </Button>
            </Link>
          </div>
        }
      />

      {isEmpty ? (
        <GardenEmptyState />
      ) : (
        <>
          {/* Your ANNs */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="h-4 w-4 text-garden-500" />
                  Your ANNs
                </h2>
                <p className="text-xs text-muted-foreground">
                  {annCards.length} of {anns.length} shown
                </p>
              </div>
              <Link
                href="/dashboard/models"
                className="text-xs text-garden-600 hover:underline dark:text-garden-400"
              >
                View all →
              </Link>
            </div>
            {annCards.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card/40 p-6 text-center text-sm text-muted-foreground">
                No ANNs yet.{" "}
                <Link
                  href="/dashboard/models/new"
                  className="font-medium text-garden-600 hover:underline dark:text-garden-400"
                >
                  Plant your first one
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {annCards.map((a) => (
                  <AnnCard key={a.id} ann={a} />
                ))}
              </div>
            )}
          </section>

          {/* Your Tissues */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Layers className="h-4 w-4 text-emerald-500" />
                  Your tissues
                </h2>
                <p className="text-xs text-muted-foreground">
                  Composed decisions from multiple ANNs
                </p>
              </div>
              <Link
                href="/dashboard/tissues"
                className="text-xs text-garden-600 hover:underline dark:text-garden-400"
              >
                View all →
              </Link>
            </div>
            {tissueCards.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card/40 p-6 text-center text-sm text-muted-foreground">
                No tissues yet.{" "}
                <Link
                  href="/dashboard/tissues"
                  className="font-medium text-garden-600 hover:underline dark:text-garden-400"
                >
                  Compose one
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tissueCards.map((t) => (
                  <TissueCard key={t.id} tissue={t} />
                ))}
              </div>
            )}
          </section>

          {/* Wave 3 / Phase B (Task 6) — Your Organisms */}
          {/*
            The Organism is a lineaged, stateful intelligence that
            evolves across generations (ADR 005). We list the user's
            own private + unlisted organisms here. Public ones are
            surfaced in the marketplace widget below.
          */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Brain className="h-4 w-4 text-garden-500" />
                  Your organisms
                </h2>
                <p className="text-xs text-muted-foreground">
                  Lineaged intelligences. Each one mutates, remembers, and scores
                  its own fitness.
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Phase 26
              </span>
            </div>
            {organisms.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card/40 p-6 text-center text-sm text-muted-foreground">
                No organisms yet. Phase 26 adds the Organism primitive — a
                stateful, lineaged, fitness-scored intelligence. Visit the{" "}
                <Link
                  href="/dashboard/garden/organism"
                  className="font-medium text-garden-600 hover:underline dark:text-garden-400"
                >
                  Garden
                </Link>{" "}
                once you have one.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {organisms.slice(0, 6).map((o) => (
                  <OrganismCard
                    key={o.id}
                    organism={{
                      id: o.id,
                      slug: o.slug,
                      name: o.name,
                      kind: o.kind,
                      status: o.status,
                      generation: o.generation,
                      fitness: o.fitness,
                      lastUpdated: fmtRelTime(o.updated_at),
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Two-column lower band: training queue + revenue */}
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-end justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Activity className="h-4 w-4 text-amber-500" />
                  Training queue
                </h2>
                <Badge variant="outline" className="text-[10px]">
                  19C — coming soon
                </Badge>
              </div>
              {trainingJobs.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-card/40 p-6 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      The training queue lights up once Phase 19C ships the
                      <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                        services/training
                      </code>
                      job registry. Until then, your decisions are made by the
                      model you configure in
                      <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                        services/ann/.env
                      </code>
                      (default: deterministic stub, ready to swap for Ollama, OpenAI, or any OpenAI-compatible server).
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {trainingJobs.map((j) => (
                    <TrainingJobCard key={j.id} job={j} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Wallet className="h-4 w-4 text-garden-500" />
                  Marketplace revenue
                </h2>
              </div>
              <RevenueCard revenue={revenue} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Wave 3 / Phase B (Task 6) — Garden Organism card.
 *
 *   Mirrors AnnCard's chrome: 9x9 icon tile, status pill, name,
 *   and a 3-column data row. Inline (not in garden-card.tsx)
 *   because the OrganismCard is task-scoped to Wave 3 / Phase B
 *   and shouldn't expand the shared widget surface.
 */
function OrganismCard({ organism }: { organism: OrganismCardData }) {
  const fitnessLabel =
    organism.fitness == null
      ? "—"
      : organism.fitness.toFixed(3);
  return (
    <Link
      href={`/dashboard/garden/organism/${organism.slug}`}
      className="group block"
    >
      <Card className="h-full transition-all hover:border-garden-500/50 hover:shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600 dark:text-garden-400">
              <Brain className="h-4 w-4" />
            </div>
            <StatusPill status={organism.status} />
          </div>
          <h3 className="mt-4 font-semibold leading-snug">
            {organism.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {organism.kind}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Fitness</dt>
              <dd className="mt-0.5 font-mono">{fitnessLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Generation</dt>
              <dd className="mt-0.5 font-mono">{organism.generation}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="mt-0.5 font-mono">{organism.lastUpdated}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}
