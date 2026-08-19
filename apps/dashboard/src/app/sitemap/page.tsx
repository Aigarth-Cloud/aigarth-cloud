import { buildSitemap } from "@/lib/sitemap";
import { SitemapCanvas } from "@/components/pages/sitemap-canvas";

export const dynamic = "force-dynamic";

/**
 * /sitemap — visual sitemap graph for the public site.
 *
 * Server component walks apps/web and produces a {nodes, edges}
 * graph. The client canvas renders it with ReactFlow as a
 * pan/zoom canvas styled like a living neural network.
 */
export default function Page() {
  const sitemap = buildSitemap();
  return <SitemapCanvas sitemap={sitemap} />;
}
