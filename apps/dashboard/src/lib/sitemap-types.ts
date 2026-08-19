/**
 * Pure-type module — safe to import from client components.
 *
 * The sitemap builder uses `node:fs` and `node:path`; that code lives in
 * `sitemap.ts` and is server-only. Anything that ends up in a "use client"
 * component (e.g. the ReactFlow canvas) must import types from here only.
 */

export type SitemapGroup = "marketing" | "dashboard" | "auth" | "api" | "root";

export interface SitemapNode {
  id: string;
  href: string;
  label: string;
  subtitle?: string;
  group: SitemapGroup;
  filePath: string;
}

export interface SitemapEdge {
  id: string;
  source: string;
  target: string;
  weight: number; // how many times the link is referenced
}

export interface Sitemap {
  generatedAt: string;
  sourceRoot: string;
  nodes: SitemapNode[];
  edges: SitemapEdge[];
}
