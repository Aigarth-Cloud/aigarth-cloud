"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Activity, Cpu, Database, Layers } from "lucide-react";
import { Card, CardContent, Badge } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

// ---------- Shared card chrome ----------

type StatusKey = "active" | "training" | "draft" | "paused" | "deprecated" | "errored" | "unknown";

const STATUSES: Record<StatusKey, { label: string; color: string; bg: string; text: string }> = {
  active:    { label: "Active",      color: "bg-emerald-500", bg: "bg-emerald-500/10",  text: "text-emerald-600 dark:text-emerald-400" },
  training:  { label: "Training",    color: "bg-amber-500",   bg: "bg-amber-500/10",    text: "text-amber-600 dark:text-amber-400" },
  draft:     { label: "Draft",       color: "bg-stone-500",   bg: "bg-stone-500/10",    text: "text-stone-600 dark:text-stone-400" },
  paused:    { label: "Paused",      color: "bg-sky-500",     bg: "bg-sky-500/10",      text: "text-sky-600 dark:text-sky-400" },
  deprecated:{ label: "Deprecated",  color: "bg-zinc-500",    bg: "bg-zinc-500/10",     text: "text-zinc-600 dark:text-zinc-400" },
  errored:   { label: "Errored",     color: "bg-red-500",     bg: "bg-red-500/10",      text: "text-red-600 dark:text-red-400" },
  unknown:   { label: "Unknown",     color: "bg-muted-foreground/40", bg: "bg-muted", text: "text-muted-foreground" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUSES[status as StatusKey] ?? STATUSES.unknown;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider", s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
      {s.label}
    </span>
  );
}

// ---------- ANN card ----------

export interface AnnCardData {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  status: string;
  /**
   * Predicted accuracy as a percentage string, e.g. "94%". This is the
   * lab-benchmarked number — what the model was trained and tested on.
   */
  accuracy?: string | null;
  /**
   * Phase 19D.4 — real-world (actual) success rate, as a percentage string
   * e.g. "89%". Computed from the decision-outcome feedback loop (19D.1).
   * `null` when the ANN has no outcomes yet.
   */
  actualAccuracy?: string | null;
  /**
   * Phase 19D.4 — number of labeled decisions the actual rate is based on.
   * `null` when no outcomes exist. Renders as e.g. "(1,247 calls)".
   */
  actualOutcomes?: number | null;
  /** 30-day revenue in Qubic, e.g. "350 QU". */
  revenue30d?: string | null;
  /** Total decision count over lifetime, e.g. "1,247". */
  totalDecisions?: string | null;
  /** Last-updated human label, e.g. "2 hours ago". */
  lastUpdated?: string;
}

/**
 * Format a number with thousands separators: 1247 → "1,247".
 * Returns the input unchanged if it isn't a finite number.
 */
function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US");
}

export function AnnCard({ ann }: { ann: AnnCardData }) {
  // Phase 19D.4 — show actual side-by-side with predicted when we have
  // outcome data. Empty state keeps the predicted row alone (matches
  // the pre-19D.4 surface so old ANNs don't suddenly look bare).
  const hasActual =
    ann.actualAccuracy != null && ann.actualOutcomes != null && ann.actualOutcomes > 0;

  return (
    <Link href={`/dashboard/models/${ann.slug}`} className="group block">
      <Card className="h-full transition-all hover:border-garden-500/50 hover:shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600 dark:text-garden-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <StatusPill status={ann.status} />
          </div>
          <h3 className="mt-4 font-semibold leading-snug">{ann.name}</h3>
          {ann.tagline && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ann.tagline}</p>
          )}

          {/* Phase 19D.4 — accuracy cell: predicted + actual side-by-side.
              When we have outcomes, the "Actual" line shows the real-world
              success rate + the call count in parentheses, so the operator
              can see at a glance how the lab benchmark compares to what
              callers actually experience. */}
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="col-span-1">
              <dt className="text-muted-foreground">Accuracy</dt>
              <dd className="mt-0.5 font-mono">
                {ann.accuracy ?? "—"}
                {hasActual && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground" title={`${fmtCount(ann.actualOutcomes)} labeled decisions`}>
                    actual {ann.actualAccuracy}{" "}
                    <span className="text-muted-foreground/70">({fmtCount(ann.actualOutcomes)} calls)</span>
                  </div>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Decisions</dt>
              <dd className="mt-0.5 font-mono">{ann.totalDecisions ?? "0"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">30d rev</dt>
              <dd className="mt-0.5 font-mono">{ann.revenue30d ?? "0 QU"}</dd>
            </div>
          </dl>

          {ann.lastUpdated && (
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Updated {ann.lastUpdated}</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------- Tissue card ----------

export interface TissueCardData {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  status: string;
  policyKind: string;
  totalDecisions: string;
  memberCount: number;
  lastUpdated?: string;
}

export function TissueCard({ tissue }: { tissue: TissueCardData }) {
  return (
    <Link href={`/dashboard/tissues/${tissue.slug}`} className="group block">
      <Card className="h-full transition-all hover:border-garden-500/50 hover:shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Layers className="h-4 w-4" />
            </div>
            <StatusPill status={tissue.status} />
          </div>
          <h3 className="mt-4 font-semibold leading-snug">{tissue.name}</h3>
          {tissue.tagline && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tissue.tagline}</p>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Members</dt>
              <dd className="mt-0.5 font-mono">{tissue.memberCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Decisions</dt>
              <dd className="mt-0.5 font-mono">{tissue.totalDecisions}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Policy</dt>
              <dd className="mt-0.5 font-mono">{tissue.policyKind}</dd>
            </div>
          </dl>
          {tissue.lastUpdated && (
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Updated {tissue.lastUpdated}</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------- Training-job card ----------

export interface TrainingJobCardData {
  id: string;
  annName: string;
  datasetName: string;
  status: string;
  progress: number; // 0-100
  eta?: string;
  startedAt: string;
}

export function TrainingJobCard({ job }: { job: TrainingJobCardData }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Activity className="h-4 w-4" />
          </div>
          <StatusPill status={job.status} />
        </div>
        <h3 className="mt-4 font-semibold leading-snug">{job.annName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">on {job.datasetName}</p>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono">{job.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Started {job.startedAt}</span>
            {job.eta && <span>ETA {job.eta}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Revenue card ----------

export interface RevenueCardData {
  /** Lifetime revenue, e.g. "12,480 QU". */
  lifetime: string;
  /** Last 30 days, e.g. "1,247 QU". */
  last30d: string;
  /** Top-earning listing name, e.g. "Caribbean Crop Doctor". */
  topListing: string;
  /** Top listing share, e.g. "62% of revenue". */
  topShare: string;
}

export function RevenueCard({ revenue }: { revenue: RevenueCardData }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600 dark:text-garden-400">
            <Database className="h-4 w-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">Marketplace</Badge>
        </div>
        <h3 className="mt-4 font-semibold leading-snug">Marketplace revenue</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Last 30 days</dt>
            <dd className="font-mono">{revenue.last30d}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Lifetime</dt>
            <dd className="font-mono">{revenue.lifetime}</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-md border bg-muted/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Top listing</div>
          <div className="mt-1 font-medium leading-snug">{revenue.topListing}</div>
          <div className="text-[11px] text-muted-foreground">{revenue.topShare}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Empty state ----------

export function GardenEmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-garden-500/10 text-garden-600 dark:text-garden-400">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Plant your first intelligence</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Create an ANN from a template, upload a dataset, or compose a tissue from existing models.
        Your ANNs, your tissues, your revenue — owned by you.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard/models/new"
          className="inline-flex items-center gap-2 rounded-md bg-garden-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-garden-700"
        >
          <Sparkles className="h-4 w-4" />
          Create an ANN
        </Link>
        <Link
          href="/dashboard/tissues"
          className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Layers className="h-4 w-4" />
          Compose a tissue
        </Link>
        <Link
          href="/dashboard/marketplace"
          className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Database className="h-4 w-4" />
          Browse the marketplace
        </Link>
      </div>
    </div>
  );
}
