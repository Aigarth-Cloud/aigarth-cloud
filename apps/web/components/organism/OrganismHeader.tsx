/**
 * OrganismHeader — the top card of the Garden Organism view (Phase 26.D).
 *
 *   Shows the organism's name, kind, generation, current fitness
 *   (read from /v1/organisms/:slug, denormalized on the row), and
 *   the lineage root slug. Mirrors the four-cell dl layout of
 *   `garden-card.tsx`'s AnnCard (accuracy/decisions/30d) so the
 *   Garden surface stays visually consistent.
 *
 *   Server component (no client interactivity needed for the
 *   header itself). The action bar (Fork / Mutate) is a separate
 *   client component.
 */

import Link from "next/link";
import { Brain, GitBranch, Sparkles, Activity } from "lucide-react";
import { Card, CardContent, Badge } from "@aigarth/ui";
import { formatNumber } from "@aigarth/utils";

export interface OrganismHeaderData {
  slug: string;
  name: string;
  kind: string;
  status: string;
  visibility: string;
  generation: number;
  fitness: number | null;
  parentSlug: string | null;
  rootSlug: string;
  creatorId: string;
  description: string | null;
}

interface OrganismHeaderProps {
  organism: OrganismHeaderData;
}

const STATUSES: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "text-emerald-600 dark:text-emerald-400" },
  draft: { label: "Draft", tone: "text-stone-600 dark:text-stone-400" },
  paused: { label: "Paused", tone: "text-sky-600 dark:text-sky-400" },
  deprecated: { label: "Deprecated", tone: "text-zinc-600 dark:text-zinc-400" },
  extinct: { label: "Extinct", tone: "text-red-600 dark:text-red-400" },
};

function statusPill(status: string) {
  const s = STATUSES[status] ?? { label: status, tone: "text-muted-foreground" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${s.tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {s.label}
    </span>
  );
}

/** Map the five organism kinds to a one-line tagline ("a researcher" etc). */
function kindDescriptor(kind: string): string {
  switch (kind) {
    case "researcher":
      return "a research organism that explores a hypothesis space";
    case "optimizer":
      return "an optimizer that mutates toward a target";
    case "predictor":
      return "a predictor that forecasts an outcome";
    case "synthetist":
      return "a synthesizer that composes new artifacts";
    case "custom":
      return "a custom organism with a user-defined loop";
    default:
      return "an organism with an unknown kind";
  }
}

function formatFitness(f: number | null): string {
  if (f == null) return "—";
  return formatNumber(f, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function OrganismHeader({ organism }: OrganismHeaderProps) {
  return (
    <Card className="border-garden-500/30">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600 dark:text-garden-400">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">
                {organism.name}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  {organism.slug}
                </code>
                <span className="mx-2 text-muted-foreground/50">·</span>
                {kindDescriptor(organism.kind)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusPill(organism.status)}
            <Badge variant="outline" className="text-[10px]">
              {organism.visibility}
            </Badge>
          </div>
        </div>

        {organism.description && (
          <p className="mt-4 text-sm text-muted-foreground">
            {organism.description}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Fitness
            </dt>
            <dd className="mt-1 font-mono">{formatFitness(organism.fitness)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              Generation
            </dt>
            <dd className="mt-1 font-mono">{organism.generation}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              Lineage root
            </dt>
            <dd className="mt-1 font-mono">
              <Link
                href={`/dashboard/garden/organism/${organism.rootSlug}`}
                className="text-garden-600 hover:underline dark:text-garden-400"
              >
                {organism.rootSlug}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Kind</dt>
            <dd className="mt-1 font-mono">{organism.kind}</dd>
          </div>
        </dl>

        {organism.parentSlug && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Forked from{" "}
            <Link
              href={`/dashboard/garden/organism/${organism.parentSlug}`}
              className="text-garden-600 hover:underline dark:text-garden-400"
            >
              {organism.parentSlug}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
