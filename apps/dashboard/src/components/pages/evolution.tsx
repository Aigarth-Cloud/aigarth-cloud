/**
 * Dashboard — Evolution view (Phase AIGARTH-EVO-01).
 *
 *   Surfaces the closed-loop evolution engine to operators. The page
 *   shows the AIGARTH-EVO-01 battery — every environment in the
 *   substrate — and its convergence result. Each row has:
 *
 *     - the converged/not badge
 *     - best fitness + the generation it was found at
 *     - the genome summary (schema + node counts)
 *     - a fitness curve drawn from the per-generation trace
 *
 *   The "Run" button triggers a fresh battery via the API route.
 *   Read-mostly otherwise.
 */

"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aigarth/ui";
import { Sparkles, RefreshCw, Loader2, GitBranch, Dna } from "lucide-react";
import type { DashboardEvolutionRow } from "@/lib/evolution";
import { PoolWidget } from "@/components/pages/pool-widget";

interface BatteryResponse {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  config: {
    seed: number;
    population_size: number;
    offspring_size: number;
    generations: number;
  };
  rows: DashboardEvolutionRow[];
}

interface Props {
  initial: BatteryResponse;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function FitnessCurve({ trace }: { trace: ReadonlyArray<{ best_fitness: number; mean_fitness: number; generation: number }> }) {
  if (trace.length === 0) {
    return <div className="text-xs text-muted-foreground">No generations recorded.</div>;
  }
  const width = 240;
  const height = 60;
  const padX = 4;
  const padY = 6;
  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;
  const xs = trace.map((_, i) => padX + (i * innerW) / Math.max(trace.length - 1, 1));
  const bestPath = trace
    .map((g, i) => {
      const x = xs[i]!;
      const y = padY + innerH * (1 - g.best_fitness);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const meanPath = trace
    .map((g, i) => {
      const x = xs[i]!;
      const y = padY + innerH * (1 - g.mean_fitness);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const final = trace[trace.length - 1]!;
  const convergedAt = trace.findIndex((g) => g.best_fitness >= 1);
  const dotX = convergedAt >= 0 ? xs[convergedAt]! : xs[xs.length - 1]!;
  const dotY = padY + innerH * (1 - final.best_fitness);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="Fitness curve"
    >
      <line x1={padX} y1={padY + innerH} x2={width - padX} y2={padY + innerH} stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
      <path d={meanPath} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 2" />
      <path d={bestPath} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={dotX} cy={dotY} r={2.5} fill="currentColor" />
    </svg>
  );
}

function EnvironmentRow({ row }: { row: DashboardEvolutionRow }) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card/40 p-4 md:grid-cols-[1fr_auto]">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-sm font-semibold">{row.env}</h3>
          {row.converged ? (
            <Badge variant="success" className="gap-1">
              <Sparkles className="h-3 w-3" />
              converged @ gen {row.converged_at}
            </Badge>
          ) : (
            <Badge variant="secondary">did not converge</Badge>
          )}
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.genome_summary.schema}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
          <div>
            <div className="text-muted-foreground">best fitness</div>
            <div className="font-mono">{fmtPct(row.best_fitness)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">generations</div>
            <div className="font-mono">{row.generations}</div>
          </div>
          <div>
            <div className="text-muted-foreground">evaluations</div>
            <div className="font-mono">{row.evaluations.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">nodes</div>
            <div className="font-mono">
              {row.genome_summary.node_count}
              <span className="ml-1 text-muted-foreground">
                ({row.genome_summary.input_count} in / {row.genome_summary.output_count} out)
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            v{row.best_version}
          </span>
          <span className="inline-flex items-center gap-1">
            <Dna className="h-3 w-3" />
            <span className="font-mono">{row.best_genome_hash}</span>
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end justify-center text-muted-foreground">
        <FitnessCurve trace={row.trace} />
        <div className="mt-1 flex items-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-foreground/80" />
            best
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-px w-3 border-t border-dashed border-current opacity-50" />
            mean
          </span>
        </div>
      </div>
    </div>
  );
}

export function EvolutionView({ initial }: Props) {
  const [data, setData] = React.useState<BatteryResponse>(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runAgain = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/evolution/battery", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as BatteryResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const converged = data.rows.filter((r) => r.converged).length;
  const totalEvals = data.rows.reduce((s, r) => s + r.evaluations, 0);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evolution</h1>
          <p className="text-sm text-muted-foreground">
            AIGARTH-EVO-01 — the ternary rule-table substrate. {converged} / {data.rows.length} environments converged ·{" "}
            {totalEvals.toLocaleString()} total evaluations · last run {fmtDuration(data.duration_ms)}.
          </p>
        </div>
        <Button
          onClick={runAgain}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Run battery
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
          Evolution failed: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AIGARTH-EVO-01 battery</CardTitle>
          <CardDescription>
            Ten environments from the substrate — boolean logic (AND, OR, NAND, XOR, MAJ3, PARITY3),
            sequence prediction (COPY_K, NOT_K, XOR_K), and BTC direction. Each is a swappable
            fitness function over the same ternary rule-table engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {data.rows.map((r) => (
              <EnvironmentRow key={r.env} row={r} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <PoolWidget />
        <Card>
          <CardHeader>
            <CardTitle>What you're looking at</CardTitle>
            <CardDescription>
              AIGARTH-EVO-02 — global contribution pool.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              The substrate is now executable in your browser via WebAssembly. Toggling
              <strong> Contribute CPU </strong> spawns a Web Worker that runs the same deterministic
              evaluation function as the server, on this tab. The pool widget aggregates the
              live state of every worker kind.
            </p>
            <p>
              <strong>Light workers</strong> = browser tabs. <strong>Dedicated workers</strong> = local and remote
              server-class. The bar is the live ratio; the rows below break it down by kind.
            </p>
            <p>
              Your share of the pool is computed live as
              <code className="rounded bg-muted px-1 py-0.5 font-mono">your_evals / global_evals_last_hour</code>.
              Browser workers start at reputation 0.3 (vs 0.5 for local); the Work Runtime
              verifier spot-checks every browser submission against a server re-run.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">
        Wire: the <code className="rounded bg-muted px-1 py-0.5">evo_step</code> algorithm is
        registered in <code className="rounded bg-muted px-1 py-0.5">services/work</code> (port 7012) alongside
        <code className="rounded bg-muted px-1 py-0.5">awork_1</code>. This dashboard consumes{" "}
        <code className="rounded bg-muted px-1 py-0.5">@aigarth/evo</code> directly; the worker container
        is the next-step delivery.
      </div>
    </div>
  );
}
