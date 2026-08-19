"use client";

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  BaseEdge,
  getSmoothStepPath,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ExternalLink,
  FileText,
  Globe,
  Key,
  Layers,
  Network,
  Search,
  Server,
  X,
  Zap,
} from "lucide-react";
import { toReactFlow } from "@/lib/sitemap-layout";
import type { Sitemap, SitemapGroup, SitemapNode, SitemapEdge } from "@/lib/sitemap-types";
import { cn } from "@aigarth/utils";

// ============================================================================
//  Custom node: glowing circle with label
// ============================================================================

type PageNodeData = {
  label: string;
  href: string;
  group: SitemapGroup;
  subtitle?: string;
  filePath?: string;
  highlighted?: boolean;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
};

function PageNode({ data, selected }: NodeProps<Node<PageNodeData>>) {
  const { label, href, group, highlighted, onHover, onSelect } = data;
  const groupStyle = GROUP_STYLE[group] ?? GROUP_STYLE.root;

  return (
    <div
      onMouseEnter={() => onHover?.(href)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onSelect?.(href)}
      className={cn(
        "group relative cursor-pointer select-none",
        "transition-transform duration-300",
        highlighted ? "scale-110" : "hover:scale-105",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />

      {/* Glow */}
      <div
        className={cn(
          "absolute inset-0 -z-10 rounded-full blur-2xl transition-opacity duration-500",
          groupStyle.glow,
          highlighted ? "opacity-90" : "opacity-40 group-hover:opacity-70",
        )}
        style={{ width: 80, height: 80, left: -10, top: -10 }}
      />

      {/* Core */}
      <div
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full border bg-card/90 backdrop-blur",
          "transition-all duration-300",
          groupStyle.border,
          selected && "ring-2 ring-primary/70",
          highlighted && "shadow-2xl",
        )}
      >
        <div className={cn("flex h-6 w-6 items-center justify-center", groupStyle.icon)}>
          {group === "marketing" ? (
            <Globe className="h-3.5 w-3.5" />
          ) : group === "dashboard" ? (
            <Layers className="h-3.5 w-3.5" />
          ) : group === "auth" ? (
            <Key className="h-3.5 w-3.5" />
          ) : group === "api" ? (
            <Server className="h-3.5 w-3.5" />
          ) : (
            <Network className="h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {/* Label */}
      <div
        className={cn(
          "absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-card/90 px-2 py-1 text-[10px] backdrop-blur",
          "transition-opacity duration-200",
          highlighted || selected ? "opacity-100" : "opacity-60 group-hover:opacity-100",
          groupStyle.border,
        )}
      >
        <div className="font-medium leading-tight">{label}</div>
        <div className="font-mono text-[9px] leading-tight text-muted-foreground">{href}</div>
      </div>
    </div>
  );
}

const GROUP_STYLE: Record<SitemapGroup, { border: string; icon: string; glow: string; chip: string }> = {
  root: {
    border: "border-violet-500/60",
    icon: "text-violet-500",
    glow: "bg-violet-500/30",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  marketing: {
    border: "border-garden-500/60",
    icon: "text-garden-500",
    glow: "bg-garden-500/30",
    chip: "bg-garden-500/15 text-garden-700 dark:text-garden-300",
  },
  dashboard: {
    border: "border-sky-500/60",
    icon: "text-sky-500",
    glow: "bg-sky-500/30",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  auth: {
    border: "border-amber-500/60",
    icon: "text-amber-500",
    glow: "bg-amber-500/30",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  api: {
    border: "border-pink-500/60",
    icon: "text-pink-500",
    glow: "bg-pink-500/30",
    chip: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  },
};

const nodeTypes = { pageNode: PageNode };

// ============================================================================
//  Custom edge: smooth step with animated particles
// ============================================================================

function NeuralEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<Edge<{ weight: number }>>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 24,
  });

  const weight = data?.weight ?? 1;
  const width = Math.min(1 + Math.log2(weight + 1) * 1.5, 5);
  const opacity = Math.min(0.35 + weight * 0.1, 0.85);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{
          stroke: selected ? "rgb(74, 222, 128)" : "rgb(148, 163, 184)",
          strokeWidth: width,
          strokeOpacity: selected ? 0.9 : opacity,
        }}
      />
      {weight >= 2 && (
        <g>
          <circle r="2.5" fill="rgb(74, 222, 128)">
            <animateMotion dur={`${2.5 + (weight % 3) * 0.7}s`} repeatCount="indefinite" path={edgePath} />
            <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </>
  );
}

const edgeTypes = { neuralEdge: NeuralEdge };

// ============================================================================
//  Group hubs (the "neurons" at the center of each cluster)
// ============================================================================

function GroupHubs({ counts }: { counts: Record<SitemapGroup, number> }) {
  // Compute hub positions (same as layout's group positions)
  const groups: SitemapGroup[] = ["root", "marketing", "dashboard", "auth", "api"];
  const visible = groups.filter((g) => counts[g] > 0);
  const GROUP_RADIUS = 700;
  const hubData: Record<SitemapGroup, { x: number; y: number; label: string; icon: React.ComponentType<{ className?: string }> }> = {
    root: { x: 0, y: 0, label: "Root", icon: Network },
    marketing: { x: 0, y: 0, label: "Marketing", icon: Globe },
    dashboard: { x: 0, y: 0, label: "Dashboard", icon: Layers },
    auth: { x: 0, y: 0, label: "Auth", icon: Key },
    api: { x: 0, y: 0, label: "API", icon: Server },
  };
  const angle = (i: number) => (i / visible.length) * Math.PI * 2;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    >
      <defs>
        <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {visible.map((g, i) => {
        const a = angle(i);
        const x = Math.cos(a) * GROUP_RADIUS;
        const y = Math.sin(a) * GROUP_RADIUS;
        hubData[g].x = x;
        hubData[g].y = y;
        return (
          <g key={g} transform={`translate(${x} ${y})`} className={cn("pointer-events-none", GROUP_STYLE[g].icon)}>
            <circle r="180" fill="url(#hub-glow)" />
            <circle
              r="40"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.4"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="60s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================================
//  Main canvas
// ============================================================================

export function SitemapCanvas({ sitemap }: { sitemap: Sitemap }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const rf = toReactFlow(sitemap);
  const [highlighted, setHighlighted] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<SitemapGroup | "all">("all");
  const [search, setSearch] = React.useState("");

  const groupCounts = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const n of sitemap.nodes) out[n.group] = (out[n.group] ?? 0) + 1;
    return out as Record<SitemapGroup, number>;
  }, [sitemap]);

  const matchingIds = React.useMemo(() => {
    const ids = new Set<string>();
    const q = search.trim().toLowerCase();
    for (const n of sitemap.nodes) {
      if (filter !== "all" && n.group !== filter) continue;
      if (q && !n.label.toLowerCase().includes(q) && !n.href.toLowerCase().includes(q)) continue;
      ids.add(n.href);
    }
    return ids;
  }, [sitemap, filter, search]);

  const onHover = React.useCallback((id: string | null) => {
    if (!id) {
      setHighlighted(new Set());
      return;
    }
    // Highlight the node and its 1-hop neighborhood
    const out = new Set<string>([id]);
    for (const e of sitemap.edges) {
      if (e.source === id) out.add(e.target);
      if (e.target === id) out.add(e.source);
    }
    setHighlighted(out);
  }, [sitemap]);

  const onSelect = React.useCallback((id: string) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

  const nodes = React.useMemo<Node[]>(() => {
    return rf.nodes.map((n) => {
      const inMatch = matchingIds.has(n.id);
      const inHighlight = highlighted.has(n.id);
      return {
        ...n,
        data: {
          ...n.data,
          highlighted: inMatch && (inHighlight || highlighted.size === 0),
        },
        hidden: !inMatch,
        style: inMatch ? undefined : { opacity: 0.08 },
      };
    });
  }, [rf.nodes, matchingIds, highlighted]);

  const edges = React.useMemo<Edge[]>(() => {
    return rf.edges.map((e) => {
      const srcVisible = matchingIds.has(e.source);
      const dstVisible = matchingIds.has(e.target);
      const visible = srcVisible && dstVisible;
      return {
        ...e,
        hidden: !visible,
        style: visible ? undefined : { opacity: 0.05 },
      };
    });
  }, [rf.edges, matchingIds]);

  const selectedNode = selected ? sitemap.nodes.find((n) => n.href === selected) ?? null : null;
  const selectedEdges = selected
    ? sitemap.edges.filter((e) => e.source === selected || e.target === selected)
    : [];

  if (!mounted) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center rounded-xl border bg-card">
        <div className="text-sm text-muted-foreground">Initializing neural canvas…</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Sitemap</h1>
          <p className="text-sm text-muted-foreground">
            {sitemap.nodes.length} pages · {sitemap.edges.length} links · generated{" "}
            {new Date(sitemap.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by name or path…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 rounded-md border bg-card pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* Group filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={sitemap.nodes.length} color="bg-muted text-foreground" />
        {(Object.keys(GROUP_STYLE) as SitemapGroup[]).map((g) =>
          groupCounts[g] > 0 ? (
            <Chip
              key={g}
              active={filter === g}
              onClick={() => setFilter(g)}
              label={g}
              count={groupCounts[g]}
              color={GROUP_STYLE[g].chip}
            />
          ) : null,
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        {/* Canvas */}
        <div
          className="relative h-[calc(100vh-16rem)] overflow-hidden rounded-xl border bg-gradient-to-br from-background via-background to-violet-950/10"
          style={{ minHeight: 600 }}
        >
          {/* Decorative bg grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              minZoom={0.05}
              maxZoom={2.5}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 0.9 }}
              proOptions={{ hideAttribution: true }}
              panOnScroll
              selectionOnDrag
              panOnDrag={[1, 2]} // left+right mouse pan, middle zooms
              onNodeClick={(_, n) => onSelect(n.id)}
            >
              <Background gap={32} size={1} color="rgba(148,163,184,0.18)" />
              <Controls className="!bottom-3 !left-3 !top-auto" position="bottom-left" />
              <MiniMap
                className="!bottom-3 !right-3 !top-auto"
                pannable
                zoomable
                nodeColor={(n) => {
                  const g = (n.data as { group?: SitemapGroup })?.group ?? "root";
                  return GROUP_COLOR_HEX[g] ?? "#94a3b8";
                }}
                maskColor="rgba(15,23,42,0.6)"
                style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(148,163,184,0.2)" }}
              />
            </ReactFlow>
            <GroupHubOverlay sitemap={sitemap} />
          </ReactFlowProvider>
        </div>

        {/* Side panel */}
        <div className="rounded-xl border bg-card p-4">
          {selectedNode ? (
            <SelectedPanel
              node={selectedNode}
              edges={selectedEdges}
              allNodes={sitemap.nodes}
              onClose={() => setSelected(null)}
              onJump={(href) => {
                // jump to the node by setting the search
                setSearch(href.replace(/^\//, ""));
              }}
            />
          ) : (
            <DefaultPanel
              sitemap={sitemap}
              groupCounts={groupCounts}
              onJump={(href) => setSearch(href.replace(/^\//, ""))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
//  Inline group-hub overlay (small concentric circles around group centers)
// ============================================================================

function GroupHubOverlay({ sitemap }: { sitemap: Sitemap }) {
  // Compute group positions matching the layout.
  const groups: SitemapGroup[] = ["root", "marketing", "dashboard", "auth", "api"];
  const counts: Partial<Record<SitemapGroup, number>> = {};
  for (const n of sitemap.nodes) counts[n.group] = (counts[n.group] ?? 0) + 1;
  const visible = groups.filter((g) => (counts[g] ?? 0) > 0);
  const n = visible.length || 1;
  const R = 700;
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {visible.map((g, i) => {
        const a = (i / n) * Math.PI * 2;
        const x = 50 + (Math.cos(a) * R) / 16; // % of canvas (16 = approx scale)
        const y = 50 + (Math.sin(a) * R) / 12;
        const c = GROUP_COLOR_HEX[g];
        return (
          <g key={g} transform={`translate(${x}% ${y}%)`}>
            <circle r="60" fill={c} fillOpacity="0.04" />
            <circle
              r="36"
              fill="none"
              stroke={c}
              strokeOpacity="0.25"
              strokeWidth="1"
              strokeDasharray="3 4"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur={20 + i * 5 + "s"}
                repeatCount="indefinite"
              />
            </circle>
            <text
              textAnchor="middle"
              y="4"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill={c}
              fillOpacity="0.8"
              style={{ letterSpacing: "0.05em" }}
            >
              {g.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const GROUP_COLOR_HEX: Record<SitemapGroup, string> = {
  root: "#a78bfa",
  marketing: "#4ade80",
  dashboard: "#38bdf8",
  auth: "#fbbf24",
  api: "#f472b6",
};

// ============================================================================
//  Small bits
// ============================================================================

function Chip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
        active ? "border-foreground/40 bg-foreground/5 ring-1 ring-foreground/15" : "border-border/40 hover:bg-accent/40",
        color,
      )}
    >
      <span className="capitalize">{label}</span>
      <span className="font-mono text-[10px] opacity-70">{count}</span>
    </button>
  );
}

function DefaultPanel({
  sitemap,
  groupCounts,
  onJump,
}: {
  sitemap: Sitemap;
  groupCounts: Record<SitemapGroup, number>;
  onJump: (href: string) => void;
}) {
  const top = React.useMemo(() => {
    const out = [...sitemap.nodes].sort((a, b) => {
      const inEdges = sitemap.edges.filter((e) => e.target === a.href).length;
      const inB = sitemap.edges.filter((e) => e.target === b.href).length;
      return inB - inEdges;
    });
    return out.slice(0, 8);
  }, [sitemap]);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Network className="h-3 w-3" />
          Neural Sitemap
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Every page of the public site (<code className="rounded bg-muted px-1 text-[10px]">apps/web</code>) is a node.
          Edges are <code className="rounded bg-muted px-1 text-[10px]">&lt;Link href&gt;</code> references found
          in the page source. Hover to highlight a node's neighborhood. Click to inspect.
        </p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Groups</div>
        <div className="mt-2 space-y-1">
          {(Object.keys(GROUP_STYLE) as SitemapGroup[]).map((g) =>
            groupCounts[g] > 0 ? (
              <div
                key={g}
                className="flex items-center justify-between rounded-md border bg-background/50 px-2 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", GROUP_BG[g])} />
                  <span className="capitalize">{g}</span>
                </div>
                <span className="font-mono text-muted-foreground">{groupCounts[g]}</span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Most-linked pages</div>
        <div className="mt-2 space-y-1">
          {top.map((n) => {
            const inCount = sitemap.edges.filter((e) => e.target === n.href).length;
            return (
              <button
                key={n.href}
                onClick={() => onJump(n.href)}
                className="flex w-full items-center justify-between rounded-md border bg-background/50 px-2 py-1.5 text-left text-xs hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{n.label}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">{n.href}</div>
                </div>
                <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  ↓{inCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Tip: <kbd className="rounded border bg-muted px-1.5">scroll</kbd> to pan,{" "}
        <kbd className="rounded border bg-muted px-1.5">pinch / cmd-scroll</kbd> to zoom, drag a node to reposition.
      </p>
    </div>
  );
}

function SelectedPanel({
  node,
  edges,
  allNodes,
  onClose,
  onJump,
}: {
  node: SitemapNode;
  edges: SitemapEdge[];
  allNodes: SitemapNode[];
  onClose: () => void;
  onJump: (href: string) => void;
}) {
  const incoming = edges.filter((e) => e.target === node.href);
  const outgoing = edges.filter((e) => e.source === node.href);
  const link = (href: string) => allNodes.find((n) => n.href === href);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {node.group}
          </div>
          <div className="truncate text-base font-semibold">{node.label}</div>
          <code className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
            {node.href}
          </code>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded-md border bg-background/50 p-2 text-[11px] text-muted-foreground">
        {node.filePath && (
          <div className="flex items-center gap-1.5 font-mono">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{node.filePath}</span>
          </div>
        )}
        {node.subtitle && (
          <div className="mt-1 flex items-center gap-1.5">
            <Activity className="h-3 w-3 shrink-0" />
            <span>{node.subtitle}</span>
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Incoming ({incoming.length})
        </div>
        <div className="mt-1.5 space-y-0.5">
          {incoming.length === 0 && (
            <div className="text-xs text-muted-foreground/60">Nothing links here</div>
          )}
          {incoming.map((e) => {
            const from = link(e.source);
            if (!from) return null;
            return (
              <button
                key={e.id}
                onClick={() => onJump(from.href)}
                className="flex w-full items-center justify-between rounded-md border bg-background/50 px-2 py-1.5 text-left text-xs hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{from.label}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">{from.href}</div>
                </div>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">→</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Outgoing ({outgoing.length})
        </div>
        <div className="mt-1.5 space-y-0.5">
          {outgoing.length === 0 && (
            <div className="text-xs text-muted-foreground/60">No outgoing links</div>
          )}
          {outgoing.map((e) => {
            const to = link(e.target);
            if (!to) return null;
            return (
              <button
                key={e.id}
                onClick={() => onJump(to.href)}
                className="flex w-full items-center justify-between rounded-md border bg-background/50 px-2 py-1.5 text-left text-xs hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{to.label}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">{to.href}</div>
                </div>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">→</span>
              </button>
            );
          })}
        </div>
      </div>

      <a
        href={`http://localhost:3003${node.href}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border bg-primary/5 px-2 py-1.5 text-xs text-primary hover:bg-primary/10"
      >
        <ExternalLink className="h-3 w-3" />
        Open in apps/web
      </a>
    </div>
  );
}

const GROUP_BG: Record<SitemapGroup, string> = {
  root: "bg-violet-500",
  marketing: "bg-garden-500",
  dashboard: "bg-sky-500",
  auth: "bg-amber-500",
  api: "bg-pink-500",
};

// Mark the unused lucide icons as referenced so they tree-shake properly.
void Zap;
