"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@aigarth/ui";
import { CheckCircle2, FileText, Package, Rocket, Calendar } from "lucide-react";
import { cn } from "@aigarth/utils";

type Doc = {
  id: string;
  path: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readTimeMinutes: number;
};

type Phase = {
  id: string;
  number: number;
  name: string;
  status: string;
  progress: number;
};

const STATUS_STYLES: Record<string, string> = {
  complete: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  blocked: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  not_started: "bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  complete: "Complete",
  in_progress: "In progress",
  blocked: "Blocked",
  not_started: "Not started",
};

function extractPhaseFromPath(path: string): { phase: number; slug: string } | null {
  // e.g. "docs/deliveries/phase-0-delivery.md" -> { phase: 0, slug: "phase-0-delivery" }
  const m = path.match(/phase-(\d+)-delivery/);
  if (!m) return null;
  return { phase: Number(m[1]), slug: `phase-${m[1]}-delivery` };
}

export function DeliveriesView({ docs, phases }: { docs: Doc[]; phases: Phase[] }) {
  // Pull docs whose path is in docs/deliveries/ — those are phase reports.
  const deliveryDocs = docs
    .filter((d) => d.path.includes("docs/deliveries/"))
    .sort((a, b) => a.path.localeCompare(b.path));

  // Build a phase -> report map for quick lookup.
  const reportsByPhase = new Map<number, Doc>();
  for (const d of deliveryDocs) {
    const info = extractPhaseFromPath(d.path);
    if (info) reportsByPhase.set(info.phase, d);
  }

  // Show every phase, with a delivery report if one exists.
  const sortedPhases = [...phases].sort((a, b) => a.number - b.number);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Rocket className="h-3.5 w-3.5" />
          Phase delivery reports
        </div>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Deliveries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {deliveryDocs.length} of {phases.length} phases have a delivery report.
          Each report is a signed-off checkpoint: what was built, what passed, what didn't.
        </p>
      </div>

      {deliveryDocs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Latest
          </h2>
          {deliveryDocs
            .slice()
            .sort((a, b) => b.path.localeCompare(a.path))
            .slice(0, 1)
            .map((d) => {
              const info = extractPhaseFromPath(d.path);
              const phase = info ? phases.find((p) => p.number === info.phase) : undefined;
              return (
                <Link
                  key={d.path}
                  href={`/deliveries/${info?.slug ?? ""}`}
                  className="group block"
                >
                  <Card className="h-full transition-all hover:border-garden-500/50">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-garden-500/20 text-garden-700 dark:text-garden-300">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          {phase && (
                            <Badge variant="success">Phase {phase.number}</Badge>
                          )}
                          <Badge variant={d.status === "final" ? "success" : "warning"}>
                            {d.status}
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="mt-4 text-lg">{d.title}</CardTitle>
                      <CardDescription className="line-clamp-3 min-h-[3.75rem]">
                        {d.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          {d.readTimeMinutes} min read
                        </span>
                        {phase && (
                          <span className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            {phase.name}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          All phases
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {sortedPhases.map((p) => {
            const report = reportsByPhase.get(p.number);
            const hasReport = Boolean(report);
            const inner = (
              <Card
                className={cn(
                  "h-full transition-all",
                  hasReport
                    ? "hover:border-garden-500/50"
                    : "border-dashed opacity-70",
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted font-mono text-sm">
                      {p.number.toString().padStart(2, "0")}
                    </div>
                    <Badge
                      className={cn("border", STATUS_STYLES[p.status] ?? STATUS_STYLES.not_started)}
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 text-base">{p.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {hasReport && report
                      ? report.description
                      : p.status === "in_progress"
                        ? "Phase in progress — report will be written at sign-off."
                        : p.status === "not_started"
                          ? "Phase not yet started."
                          : "No delivery report on file."}
                  </CardDescription>
                </CardHeader>
                {hasReport && report && (
                  <CardContent>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {d.format(new Date())}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        {report.readTimeMinutes} min
                      </span>
                    </div>
                  </CardContent>
                )}
              </Card>
            );

            return hasReport && report ? (
              <Link
                key={p.id}
                href={`/deliveries/${extractPhaseFromPath(report.path)?.slug ?? ""}`}
                className="group block"
              >
                {inner}
              </Link>
            ) : (
              <div key={p.id}>{inner}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const d = {
  format: (date: Date) => {
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  },
};
