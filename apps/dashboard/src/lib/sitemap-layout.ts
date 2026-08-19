/**
 * Client-safe sitemap layout helpers.
 *
 * The actual sitemap *build* (reading the apps/web filesystem) lives in
 * `./sitemap.ts` and is server-only because it pulls in node:fs.
 *
 * Anything imported by a "use client" component (e.g. the ReactFlow
 * canvas) must come from here, not from `./sitemap.ts`.
 */

import type { Sitemap, SitemapNode, SitemapGroup } from "./sitemap-types";

// ----- Deterministic PRNG (mulberry32) -----
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Layout: place each group in a cluster around the origin, then
 * scatter pages within the cluster via concentric rings. Looks like
 * a synaptic cluster — dense in the middle, sparser at the edges.
 */
export function layout(nodes: SitemapNode[], seed = 42): { id: string; position: { x: number; y: number } }[] {
  const random = rng(seed);
  const byGroup: Record<string, SitemapNode[]> = {};
  for (const n of nodes) {
    (byGroup[n.group] ??= []).push(n);
  }
  const groups = Object.keys(byGroup);
  const groupCount = groups.length;

  // Place group centroids in a circle around the origin
  const GROUP_RADIUS = 700;
  const groupPos: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < groups.length; i++) {
    const angle = (i / groupCount) * Math.PI * 2;
    groupPos[groups[i]!] = {
      x: Math.cos(angle) * GROUP_RADIUS,
      y: Math.sin(angle) * GROUP_RADIUS,
    };
  }

  const positions: { id: string; position: { x: number; y: number } }[] = [];
  for (const g of groups) {
    const members = byGroup[g]!;
    const center = groupPos[g]!;
    const ringSize = 6;
    for (let i = 0; i < members.length; i++) {
      let x: number, y: number;
      if (members.length === 1) {
        x = center.x;
        y = center.y;
      } else if (members.length <= 6) {
        const a = (i / members.length) * Math.PI * 2;
        x = center.x + Math.cos(a) * 140 + (random() - 0.5) * 30;
        y = center.y + Math.sin(a) * 140 + (random() - 0.5) * 30;
      } else {
        const ring = Math.floor(i / ringSize);
        const idx = i % ringSize;
        const ringR = 140 + ring * 130;
        const a = (idx / ringSize) * Math.PI * 2 + ring * 0.4;
        x = center.x + Math.cos(a) * ringR + (random() - 0.5) * 25;
        y = center.y + Math.sin(a) * ringR + (random() - 0.5) * 25;
      }
      positions.push({ id: members[i]!.id, position: { x, y } });
    }
  }
  return positions;
}

/** ReactFlow node/edge shape returned by `toReactFlow`. */
export interface ReactFlowPageNode {
  id: string;
  type: "pageNode";
  position: { x: number; y: number };
  data: {
    label: string;
    href: string;
    group: SitemapGroup;
    subtitle?: string;
    filePath?: string;
  };
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type: "neuralEdge";
  data: { weight: number };
  animated: boolean;
}

/** Convert a Sitemap into ReactFlow node/edge objects with positions. */
export function toReactFlow(sitemap: Sitemap, seed = 42): { nodes: ReactFlowPageNode[]; edges: ReactFlowEdge[] } {
  const positions = new Map(layout(sitemap.nodes, seed).map((p) => [p.id, p.position] as const));
  return {
    nodes: sitemap.nodes.map((n) => ({
      id: n.id,
      type: "pageNode" as const,
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: {
        label: n.label,
        href: n.href,
        group: n.group,
        subtitle: n.subtitle,
        filePath: n.filePath,
      },
    })),
    edges: sitemap.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "neuralEdge" as const,
      data: { weight: e.weight },
      animated: e.weight >= 2,
    })),
  };
}
