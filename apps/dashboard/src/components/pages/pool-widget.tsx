/**
 * Global Pool widget — Phase AIGARTH-EVO-02.
 *
 *   Shows the live state of the Work Runtime's compute pool:
 *     - Workers grouped by kind (light = browser, dedicated = local/remote)
 *     - Total evaluations in the last hour + 24h
 *     - Currently-running + queued work items
 *     - Per-environment evaluation totals
 *     - Top contributing workers
 *
 *   Auto-refreshes every 10s. Falls back to synthetic stats when
 *   services/work is unreachable (e.g. dashboard-only mode).
 *
 *   Includes the "Contribute" toggle that spawns a Web Worker on
 *   this tab's CPU and feeds local evaluations into the pool.
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@aigarth/ui";
import {
  Cpu,
  Globe,
  Activity,
  Users,
  Sparkles,
  Power,
  PowerOff,
  Zap,
} from "lucide-react";
import {
  fetchPoolStats,
  syntheticPoolStats,
  classifyWorkers,
  shareOfPool,
  type PoolStats,
  type PoolWorkerCount,
  type PoolEnvironmentCount,
} from "@/lib/pool";
import {
  spawnEvoWorker,
  type Controller as EvoController,
  type WorkerMessage,
} from "@/lib/evo-worker-client";

interface Props {
  /** Refresh interval in ms. */
  refreshMs?: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function KindDot({ kind }: { kind: PoolWorkerCount["kind"] }) {
  const map: Record<PoolWorkerCount["kind"], string> = {
    local: "bg-blue-500",
    remote: "bg-emerald-500",
    browser: "bg-amber-500",
    "oc-processor": "bg-violet-500",
    neuraxon: "bg-rose-500",
    "human-via-oracle": "bg-pink-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[kind]}`} />;
}

function WorkerBreakdown({ counts }: { counts: ReadonlyArray<PoolWorkerCount> }) {
  const { light, dedicated } = classifyWorkers(counts);
  const total = light + dedicated;
  const lightPct = total === 0 ? 0 : (light / total) * 100;
  const dedPct = total === 0 ? 0 : (dedicated / total) * 100;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${lightPct}%` }}
          aria-label={`${light} light workers`}
        />
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${dedPct}%` }}
          aria-label={`${dedicated} dedicated workers`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-amber-500" />
          <div>
            <div className="font-mono font-semibold">{light}</div>
            <div className="text-muted-foreground">light (browser)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-blue-500" />
          <div>
            <div className="font-mono font-semibold">{dedicated}</div>
            <div className="text-muted-foreground">dedicated</div>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 pt-2 text-[11px]">
        {counts.map((c) => (
          <div key={c.kind} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KindDot kind={c.kind} />
              <span className="font-mono">{c.kind}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-muted-foreground">
              <span>{c.active} active</span>
              <span className="opacity-50">/ {c.total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnvironmentBars({ envs, totalEvals }: { envs: ReadonlyArray<PoolEnvironmentCount>; totalEvals: number }) {
  if (envs.length === 0) {
    return <div className="text-xs text-muted-foreground">No evaluations in window.</div>;
  }
  const max = Math.max(...envs.map((e) => e.evaluations));
  return (
    <div className="space-y-2">
      {envs.slice(0, 5).map((e) => {
        const pct = max === 0 ? 0 : (e.evaluations / max) * 100;
        const share = totalEvals === 0 ? 0 : (e.evaluations / totalEvals) * 100;
        return (
          <div key={e.environment} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono">{e.environment}</span>
              <span className="font-mono text-muted-foreground">
                {fmt(e.evaluations)} <span className="opacity-50">({share.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary/60" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PoolWidget({ refreshMs = 10_000 }: Props) {
  const [stats, setStats] = React.useState<PoolStats>(() => syntheticPoolStats());
  const [statsError, setStatsError] = React.useState<string | null>(null);
  const [statsSynthetic, setStatsSynthetic] = React.useState(true);
  const [contributing, setContributing] = React.useState(false);
  const [workerMsg, setWorkerMsg] = React.useState<WorkerMessage | null>(null);
  const controllerRef = React.useRef<EvoController | null>(null);

  // Pool stats polling
  React.useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const fresh = await fetchPoolStats();
        if (cancelled) return;
        setStats(fresh);
        setStatsError(null);
        setStatsSynthetic(false);
      } catch (err) {
        if (cancelled) return;
        setStatsError((err as Error).message);
        setStatsSynthetic(true);
      }
    };
    refresh();
    const interval = setInterval(refresh, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshMs]);

  // Auto-pause when tab is hidden.
  React.useEffect(() => {
    if (!contributing) return;
    const onVis = () => {
      if (document.hidden && controllerRef.current) {
        controllerRef.current.stop();
        controllerRef.current = null;
      } else if (!document.hidden && !controllerRef.current) {
        startWorker();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributing]);

  const startWorker = () => {
    const ctrl = spawnEvoWorker();
    ctrl.subscribe(setWorkerMsg);
    ctrl.start();
    controllerRef.current = ctrl;
  };

  const handleToggleContribute = () => {
    if (contributing) {
      controllerRef.current?.stop();
      controllerRef.current = null;
      setWorkerMsg(null);
      setContributing(false);
    } else {
      startWorker();
      setContributing(true);
    }
  };

  const myEvals = workerMsg?.evals ?? 0;
  const myShare = shareOfPool(myEvals, stats.evals_last_hour);
  const mySharePct = (myShare * 100).toFixed(4);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Global Contribution Pool
            </CardTitle>
            <CardDescription>
              {statsSynthetic ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Synthetic (Work Runtime unreachable)
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live · refreshed {Math.round(refreshMs / 1000)}s ago
                </span>
              )}
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleToggleContribute}
                  variant={contributing ? "destructive" : "default"}
                  size="sm"
                  className="gap-1.5"
                >
                  {contributing ? (
                    <>
                      <PowerOff className="h-3 w-3" />
                      Stop contributing
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3" />
                      Contribute CPU
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {contributing
                  ? "Stops the local Web Worker. The substrate halts immediately."
                  : "Runs the AIGARTH-EVO substrate in a Web Worker on this tab. Pauses when the tab is hidden."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* This-tab contribution */}
        {contributing && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 animate-pulse text-emerald-500" />
                <div>
                  <div className="text-xs font-semibold">This tab · contributing</div>
                  <div className="text-[10px] text-muted-foreground">
                    {workerMsg ? `env: ${workerMsg.env} · gen ${workerMsg.generation}` : "starting…"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold">{myEvals.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">
                  eval · {mySharePct}% of pool
                </div>
              </div>
            </div>
            {workerMsg && workerMsg.best_fitness > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[10px]">
                <Sparkles className="h-3 w-3 text-amber-500" />
                best fitness this tab: <span className="font-mono">{(workerMsg.best_fitness * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Headline metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-md border bg-card/50 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground">last hour</div>
            <div className="font-mono text-lg font-semibold">{fmt(stats.evals_last_hour)}</div>
            <div className="text-[10px] text-muted-foreground">evaluations</div>
          </div>
          <div className="rounded-md border bg-card/50 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground">last day</div>
            <div className="font-mono text-lg font-semibold">{fmt(stats.evals_last_day)}</div>
            <div className="text-[10px] text-muted-foreground">evaluations</div>
          </div>
          <div className="rounded-md border bg-card/50 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground">running</div>
            <div className="font-mono text-lg font-semibold">{stats.running_items}</div>
            <div className="text-[10px] text-muted-foreground">work items</div>
          </div>
          <div className="rounded-md border bg-card/50 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground">queued</div>
            <div className="font-mono text-lg font-semibold">{stats.queued_items}</div>
            <div className="text-[10px] text-muted-foreground">work items</div>
          </div>
        </div>

        {/* Worker breakdown */}
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold">
            <Zap className="h-3 w-3" />
            Workers
          </div>
          <WorkerBreakdown counts={stats.workers_by_kind} />
        </div>

        {/* Per-environment evals */}
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold">
            <Activity className="h-3 w-3" />
            Evaluations by environment (last 24h)
          </div>
          <EnvironmentBars envs={stats.per_environment} totalEvals={stats.evals_last_day} />
        </div>

        {statsError && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-700">
            Work Runtime unreachable: <span className="font-mono">{statsError}</span>. Showing synthetic stats.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
