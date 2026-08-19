/**
 * Build a sitemap graph for the public site (apps/web).
 *
 * Nodes = every page.tsx route under apps/web/app, classified by the
 *   route group it lives in (marketing / dashboard / auth).
 * Edges = every <Link href="..."> we can find by parsing the TSX
 *   source of every page + the two nav components. We parse the
 *   source as a regex (not a full AST) — fast, good enough for a
 *   sitemap, and doesn't require a TypeScript compiler at runtime.
 *
 * The output shape matches what ReactFlow expects:
 *   {
 *     nodes: { id, type, position, data: { label, href, group, subtitle, ... } }[],
 *     edges: { id, source, target, type, data: { weight } }[],
 *   }
 *
 * Layout: a "neural network" feel — pages are clustered by group,
 * group clusters are arranged in a circle, pages within a cluster
 * form a denser sub-cluster. Powered by a deterministic seeded
 * PRNG so the layout is stable across server restarts.
 */

import fs from "node:fs";
import path from "node:path";

// Re-export pure types from the client-safe module. The canvas imports
// these via "@/lib/sitemap-types" so it never pulls node:fs into the bundle.
export type { SitemapGroup, SitemapNode, SitemapEdge, Sitemap } from "./sitemap-types";
// Re-export the client-safe layout helpers so server code that already
// imports from "@/lib/sitemap" doesn't need to change.
export { toReactFlow } from "./sitemap-layout";
import type { Sitemap, SitemapNode, SitemapEdge, SitemapGroup } from "./sitemap-types";

function toTitleCase(slug: string): string {
  return slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function groupForRoute(absoluteFile: string, appRoot: string): SitemapGroup {
  const rel = path.relative(appRoot, absoluteFile).replace(/\\/g, "/");
  const parts = rel.split("/");
  // path.relative drops the appRoot prefix, so for an app route file the
  // first segment is the route group: "(marketing)", "(auth)", "dashboard",
  // or "api". The bare home page is just "page.tsx" → parts[0] === "page".
  const head = parts[0] ?? "";
  if (head === "(marketing)") return "marketing";
  if (head === "(auth)") return "auth";
  if (head === "dashboard") return "dashboard";
  if (head === "api") return "api";
  // Bare app/page.tsx (when no route group owns the home) → head is
  // "page.tsx" or empty. The home belongs on the public site either
  // way, so we route it into the marketing cluster.
  if (head === "page.tsx" || head === "page" || head === "") return "marketing";
  return "marketing";
}

function hrefForRoute(absoluteFile: string, appRoot: string): string {
  const rel = path.relative(appRoot, absoluteFile).replace(/\\/g, "/");
  // strip "app/" prefix and "/page.tsx" suffix
  const noPrefix = rel.replace(/^app\//, "").replace(/\/page\.tsx$/, "");
  if (noPrefix === "" || noPrefix === "page") return "/";
  // route group (marketing) etc. — strip the (parens)
  const cleaned = noPrefix.replace(/\(([^)]+)\)\/?/g, "");
  if (cleaned === "") return "/";
  return "/" + cleaned.replace(/^([^/])/, "$1").replace(/\/$/, "");
}

function labelForRoute(href: string, relPath: string): { label: string; subtitle?: string } {
  if (href === "/") return { label: "Home", subtitle: "Marketing · home" };
  if (relPath.startsWith("app/(auth)/")) {
    if (href === "/login") return { label: "Sign in", subtitle: "Auth" };
    if (href === "/signup") return { label: "Get started", subtitle: "Auth" };
  }
  if (relPath.startsWith("app/api/")) {
    const routeName = relPath
      .replace(/^app\/api\//, "")
      .replace(/\/route\.ts$/, "");
    return { label: `API: ${routeName}`, subtitle: "Route handler" };
  }
  if (relPath.startsWith("app/dashboard/")) {
    const routeName = relPath
      .replace(/^app\/dashboard\//, "")
      .replace(/\/page\.tsx$/, "");
    return { label: toTitleCase(routeName || "overview"), subtitle: "Customer dashboard" };
  }
  if (relPath.startsWith("app/(marketing)/")) {
    const routeName = relPath
      .replace(/^app\/\(marketing\)\//, "")
      .replace(/\/page\.tsx$/, "");
    return { label: toTitleCase(routeName), subtitle: "Marketing" };
  }
  return { label: toTitleCase(href.replace(/^\//, "")), subtitle: "Page" };
}

// Extract <Link href="..."> and <a href="..."> from a TSX/TS source.
// Also pick up nav components (they have href: "/foo" in arrays).
const HREF_RE = /href:\s*["'`](\/[^"'`]+)["'`]/g;
const JSX_HREF_RE = /(?:href|to)=["'`](\/[^"'`]+)["'`]/g;
const NEXT_LINK_HREF_RE = /<Link[^>]+href=["'`](\/[^"'`]+)["'`]/g;

function extractHrefsFromFile(file: string): string[] {
  let src: string;
  try {
    src = fs.readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const out = new Set<string>();
  // nav-object form: { title: "...", href: "/foo" }
  let m: RegExpExecArray | null;
  HREF_RE.lastIndex = 0;
  while ((m = HREF_RE.exec(src))) {
    if (m[1] && m[1].startsWith("/") && !m[1].startsWith("//")) out.add(m[1]);
  }
  // JSX form: <Link href="/foo">, <a href="/foo">
  JSX_HREF_RE.lastIndex = 0;
  while ((m = JSX_HREF_RE.exec(src))) {
    if (m[1] && m[1].startsWith("/") && !m[1].startsWith("//")) out.add(m[1]);
  }
  // safer Next Link form (no false positives on tailwind classes)
  NEXT_LINK_HREF_RE.lastIndex = 0;
  while ((m = NEXT_LINK_HREF_RE.exec(src))) {
    if (m[1] && m[1].startsWith("/") && !m[1].startsWith("//")) out.add(m[1]);
  }
  return Array.from(out);
}

/** Walk a directory and yield all page.tsx/route.ts/page.tsx files (one level deep). */
function walkAppRoutes(appDir: string): { file: string; relPath: string }[] {
  const out: { file: string; relPath: string }[] = [];
  if (!fs.existsSync(appDir)) return out;

  const recurse = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        recurse(full);
      } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
        const relPath = path.relative(appDir, full).replace(/\\/g, "/");
        out.push({ file: full, relPath });
      }
    }
  };
  recurse(appDir);
  return out;
}

/**
 * Build the sitemap. Reads apps/web/app + components/{marketing,dashboard}-nav.
 *
 * @param dashboardCwd  the cwd of the dashboard process (used to locate
 *                       the repo root and apps/web). Defaults to cwd.
 */
export function buildSitemap(dashboardCwd?: string): Sitemap {
  const cwd = dashboardCwd ?? process.cwd();
  const repoRoot = path.resolve(cwd, "..", "..");
  const webAppDir = path.join(repoRoot, "apps", "web", "app");
  const webComponentsDir = path.join(repoRoot, "apps", "web", "components");

  // -------- Nodes --------
  const routeFiles = walkAppRoutes(webAppDir);

  const nodeByHref = new Map<string, SitemapNode>();
  for (const { file, relPath } of routeFiles) {
    const href = hrefForRoute(file, webAppDir);
    const { label, subtitle } = labelForRoute(href, relPath);
    const group = groupForRoute(file, webAppDir);
    if (nodeByHref.has(href)) continue;
    nodeByHref.set(href, {
      id: href,
      href,
      label,
      subtitle,
      group,
      filePath: path.relative(repoRoot, file).replace(/\\/g, "/"),
    });
  }

  // The home page is implicit (apps/web/app/page.tsx). If the Next.js
  // app router doesn't place it at the root (e.g. it lives in a route
  // group like (marketing)), the loop above already picked it up —
  // otherwise seed it here.
  if (!nodeByHref.has("/")) {
    nodeByHref.set("/", {
      id: "/",
      href: "/",
      label: "Home",
      subtitle: "Marketing",
      group: "marketing",
      filePath: "apps/web/app/page.tsx",
    });
  }

  const nodes = Array.from(nodeByHref.values()).sort((a, b) => a.href.localeCompare(b.href));

  // -------- Edges --------
  // 1) Auto: every page links to "/" (footer, logo, etc.)
  // 2) Parsed: every <Link href="/foo"> in every page or nav file
  const edgeMap = new Map<string, SitemapEdge>();
  const addEdge = (src: string, dst: string) => {
    if (src === dst) return;
    if (!nodeByHref.has(src) || !nodeByHref.has(dst)) return;
    const id = `${src}->${dst}`;
    const existing = edgeMap.get(id);
    if (existing) {
      existing.weight += 1;
    } else {
      edgeMap.set(id, { id, source: src, target: dst, weight: 1 });
    }
  };

  // Implicit: every page links back to "/"
  for (const n of nodes) {
    if (n.href !== "/") addEdge(n.href, "/");
  }

  // Parsed: every <Link href> we can find
  for (const { file } of routeFiles) {
    const hrefs = extractHrefsFromFile(file);
    const currentHref = hrefForRoute(file, webAppDir);
    for (const target of hrefs) {
      addEdge(currentHref, target);
    }
  }
  // Also parse the nav components
  for (const navFile of [
    path.join(webComponentsDir, "marketing", "marketing-nav.tsx"),
    path.join(webComponentsDir, "marketing", "marketing-footer.tsx"),
    path.join(webComponentsDir, "dashboard", "dashboard-nav.tsx"),
  ]) {
    if (!fs.existsSync(navFile)) continue;
    // For navs, treat "home" as the source
    const hrefs = extractHrefsFromFile(navFile);
    for (const target of hrefs) {
      addEdge("/", target);
    }
  }

  const edges = Array.from(edgeMap.values()).sort((a, b) => a.id.localeCompare(b.id));

  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(repoRoot, webAppDir).replace(/\\/g, "/"),
    nodes,
    edges,
  };
}

/** Convert a Sitemap into ReactFlow node/edge objects with positions. */
// Re-exported above for backward compat. The implementation lives in
// `./sitemap-layout` so client components can import it without dragging
// `node:fs` into the browser bundle.
