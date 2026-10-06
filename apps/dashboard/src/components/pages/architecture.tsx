"use client";

/**
 * /architecture — visual topology of every Aigarth service.
 *
 * Built on @xyflow/react (already in apps/dashboard/package.json). Each
 * node has tier-coded colour, a status dot from /api/services/health,
 * and opens a dialog on click with the service's purpose, phase,
 * metrics, and outbound links.
 *
 * Edges reflect real call paths from the production compose and the
 * service source code (AIGARTH_*_URL envs, gateway forwarders,
 * training→compute bridge, NATS subscribers). Curved smooth-step paths
 * to keep the layout readable at high density.
 *
 * Auto-fit to viewport on mount; pan/zoom and a minimap so the user
 * can navigate the whole stack.
 */

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  Panel,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Badge,
  Card,
} from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import {
  EDGES,
  EDGE_STYLE,
  KIND_STYLE,
  NODES,
  nodesById,
  layoutNodes,
  type HealthSnapshot,
  type NodeDef,
} from "@/lib/topology";

/* ─────────────────────────────────────────────────────────────────────────
 *  Custom node — pill with icon, name, port, status dot
 * ───────────────────────────────────────────────────────────────────────── */

type NodeData = {
  def: NodeDef;
  health: HealthSnapshot | undefined;
  onSelect: (id: string) => void;
};

function ServiceNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const { def, health, onSelect } = data;
  const style = KIND_STYLE[def.kind];
  const Icon = def.icon;
  const ok = health?.ok;
  const isSelf = def.id === "apps/dashboard";

  return (
    <button
      type="button"
      onClick={() => onSelect(def.id)}
      className={cn(
        "group relative flex w-[180px] flex-col items-stretch rounded-xl border bg-card/90 backdrop-blur",
        "px-3 py-2 text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg",
        style.ring,
        selected && "ring-2 ring-primary/70 shadow-xl",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-0 !bg-muted-foreground/40"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-0 !bg-muted-foreground/40"
      />

      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            style.bg,
            style.text,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {ok === true ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-mint-500" aria-label="up" />
        ) : ok === false ? (
          <XCircle className="h-3.5 w-3.5 text-red-500" aria-label="down" />
        ) : (
          <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" aria-label="probing" />
        )}
      </div>

      <div className="mt-2 truncate text-[13px] font-semibold leading-tight">
        {def.name}
      </div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
        :{def.port} · {def.tier}
      </div>
      {isSelf && (
        <span className="absolute -right-2 -top-2 rounded-full border border-primary/40 bg-primary px-1.5 py-0.5 text-[8px] uppercase text-primary-foreground">
          self
        </span>
      )}
    </button>
  );
}

const NODE_TYPES = { service: ServiceNode };

/* ─────────────────────────────────────────────────────────────────────────
 *  Health status hook — talks to the same endpoint /services uses.
 * ───────────────────────────────────────────────────────────────────────── */

type HealthResponse = {
  checked_at: string;
  up: number;
  down: number;
  services: HealthSnapshot[];
};

function useHealth() {
  const [data, setData] = React.useState<HealthResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastCheckedAt, setLastCheckedAt] = React.useState<string | null>(null);

  const fetch_ = React.useCallback(async (manual: boolean) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/services/health", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as HealthResponse;
        setData(json);
        setLastCheckedAt(json.checked_at);
      }
    } catch (err) {
      console.error("health fetch failed", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetch_(false);
    const t = setInterval(() => fetch_(false), 10_000);
    return () => clearInterval(t);
  }, [fetch_]);

  const byName: Record<string, HealthSnapshot> = {};
  for (const r of data?.services ?? []) byName[r.name] = r;

  return {
    data,
    loading,
    refresh: () => fetch_(true),
    refreshing,
    byName,
    lastCheckedAt,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Legend
 * ───────────────────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <Card className="!p-3 text-xs">
      <div className="mb-2 font-semibold uppercase tracking-wider text-muted-foreground">
        Tier
      </div>
      <ul className="space-y-1.5">
        {(Object.keys(KIND_STYLE) as Array<keyof typeof KIND_STYLE>).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span
              className={cn("h-3 w-3 rounded-sm border", KIND_STYLE[k].pill)}
            />
            {KIND_STYLE[k].label}
          </li>
        ))}
      </ul>
      <div className="mt-3 mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
        Edge
      </div>
      <ul className="space-y-1">
        {(Object.keys(EDGE_STYLE) as Array<keyof typeof EDGE_STYLE>).map((rel) => (
          <li key={rel} className="flex items-center gap-2">
            <span
              className="h-0.5 w-5 rounded-full"
              style={{ background: EDGE_STYLE[rel].stroke }}
            />
            {EDGE_STYLE[rel].label ?? rel}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Flow canvas (must be inside ReactFlowProvider)
 * ───────────────────────────────────────────────────────────────────────── */

function FlowCanvas({ byName, onSelect }: {
  byName: Record<string, HealthSnapshot>;
  onSelect: (id: string) => void;
}) {
  const { fitView } = useReactFlow();

  React.useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 80);
    return () => clearTimeout(t);
  }, [fitView]);

  const rfNodes = React.useMemo<Node<NodeData>[]>(
    () =>
      layoutNodes().map((n) => ({
        id: n.id,
        type: "service",
        position: n.position!,
        data: { def: n, health: byName[n.id], onSelect },
      })),
    [byName, onSelect],
  );

  const rfEdges = React.useMemo<Edge[]>(
    () =>
      EDGES.map((e) => {
        const style = EDGE_STYLE[e.rel];
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep",
          animated: e.rel === "event" || e.rel === "https",
          label: e.label ?? style.label,
          labelStyle: { fontSize: 9, fill: "currentColor", fontWeight: 500 },
          labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.85 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            stroke: style.stroke,
            strokeWidth: 1.4,
            strokeOpacity: 0.7,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: style.stroke,
            width: 12,
            height: 12,
          },
        };
      }),
    [],
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.3}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnScroll
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.2}
        color="currentColor"
        className="text-muted-foreground/20"
      />
      <Controls
        showInteractive={false}
        className="!rounded-lg !border !bg-card/80 [&>button]:!bg-card/80 [&>button]:!text-foreground"
      />
      <MiniMap
        pannable
        zoomable
        className="!rounded-lg !border !bg-card/80"
        nodeColor={(n) => KIND_STYLE[(n.data as NodeData).def.kind].edge}
        maskColor="rgba(0,0,0,0.08)"
      />
      <Panel position="bottom-left" className="!m-2">
        <Legend />
      </Panel>
    </ReactFlow>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Service detail dialog
 * ───────────────────────────────────────────────────────────────────────── */

function ServiceDialog({ id, open, onOpenChange, health, lastCheckedAt }: {
  id: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  health: HealthSnapshot | undefined;
  lastCheckedAt: string | null;
}) {
  const def = id ? nodesById()[id] : null;
  if (!def) return null;
  const style = KIND_STYLE[def.kind];
  const Icon = def.icon;
  const ok = health?.ok;
  const latency = health?.latencyMs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  style.bg,
                  style.text,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base">{def.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {def.short}
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  style.pill,
                )}
              >
                {style.label}
              </span>
              {ok === true ? (
                <Badge variant="success" className="gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> up
                </Badge>
              ) : ok === false ? (
                <Badge variant="destructive" className="gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> down
                </Badge>
              ) : (
                <Badge variant="secondary">probing…</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground/90">
            {def.long}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {def.metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </div>
                <div className="mt-0.5 truncate font-mono text-foreground">
                  {m.get(health)}
                </div>
              </div>
            ))}
            {ok === true && latency !== undefined && (
              <div className="rounded-md border bg-mint-500/[0.06] px-3 py-2 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-mint-700 dark:text-mint-300">
                  Ping
                </div>
                <div className="mt-0.5 font-mono text-mint-700 dark:text-mint-300">
                  {latency}ms
                </div>
              </div>
            )}
            {ok === false && (
              <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs sm:col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400">
                  Detail
                </div>
                <div className="mt-0.5 font-mono text-red-600 dark:text-red-400">
                  {health?.detail ?? "unreachable"}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              {lastCheckedAt
                ? `checked ${new Date(lastCheckedAt).toLocaleTimeString()}`
                : "checking…"}
            </span>
            <span>
              Phase <span className="font-mono text-foreground">{def.phase}</span>
              {def.publicHost && (
                <>
                  {" · "}
                  <span className="font-mono text-foreground">{def.publicHost}</span>
                </>
              )}
            </span>
          </div>

          {def.links.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {def.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target={l.external ? "_blank" : undefined}
                  rel={l.external ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
                >
                  {l.label}
                  {l.external && <ExternalLink className="h-3 w-3" />}
                </a>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Top-level exported view
 * ───────────────────────────────────────────────────────────────────────── */

export function ArchitectureView() {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const { data, loading, refresh: handleRefresh, refreshing, byName, lastCheckedAt } = useHealth();

  const onSelect = React.useCallback(
    (id: string) => {
      setOpenId(id);
      setOpen(true);
    },
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Architecture</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How every Aigarth service connects. Click any node for purpose,
            phase, and live metrics. Edges reflect real call paths from the
            production compose and the service source.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <div className="flex items-center gap-3 rounded-md border bg-card/50 px-3 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 text-mint-600 dark:text-mint-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {data.up} up
              </span>
              {data.down > 0 && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <XCircle className="h-3.5 w-3.5" />
                  {data.down} down
                </span>
              )}
              <span className="text-muted-foreground">
                · {lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString() : "—"}
              </span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>
      </div>

      <div className="relative h-[calc(100vh-15rem)] min-h-[560px] overflow-hidden rounded-xl border bg-card/30">
        {loading && !data ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Probing {NODES.length} endpoints…
          </div>
        ) : (
          <ReactFlowProvider>
            <FlowCanvas byName={byName} onSelect={onSelect} />
          </ReactFlowProvider>
        )}
      </div>

      <ServiceDialog
        id={openId}
        open={open}
        onOpenChange={setOpen}
        health={openId ? byName[openId] : undefined}
        lastCheckedAt={lastCheckedAt}
      />
    </div>
  );
}