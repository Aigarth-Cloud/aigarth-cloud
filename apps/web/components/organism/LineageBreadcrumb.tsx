/**
 * LineageBreadcrumb — ancestor chain of the current Organism
 * (Phase 26.D, Garden Organism view).
 *
 *   Renders the path from the lineage root → ... → parent → self.
 *   The chain is read from `/v1/organisms/:slug/lineage` (a
 *   recursive CTE in services/ann that walks parent_id until the
 *   root). The first 5 ancestors are shown; if the chain is longer,
 *   a "+N more" badge indicates truncation.
 *
 *   Self is rendered last and is non-clickable (it IS the current
 *   page). Every other entry links to its own Garden view.
 *
 *   ADR 005 §5 says "cycles are impossible by construction" — the
 *   chain is guaranteed acyclic. The component does not need to
 *   defend against a loop.
 */

import Link from "next/link";
import { ChevronRight, GitBranch } from "lucide-react";
import { Card, CardContent } from "@aigarth/ui";

export interface LineageNode {
  slug: string;
  name: string;
  generation: number;
  parent_slug: string | null;
}

interface LineageBreadcrumbProps {
  /** Path from root → self, in order. The last entry is the current organism. */
  chain: LineageNode[];
  /** Maximum number of ancestor links to render before the "+N more" badge. */
  maxVisible?: number;
}

export function LineageBreadcrumb({
  chain,
  maxVisible = 5,
}: LineageBreadcrumbProps) {
  if (chain.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Lineage</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No lineage data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  // The chain is root → ... → self. The last entry is the current organism.
  const self = chain[chain.length - 1]!;
  const ancestors = chain.slice(0, -1);
  const overflow = Math.max(0, ancestors.length - maxVisible);
  const visibleAncestors =
    overflow > 0 ? ancestors.slice(ancestors.length - maxVisible) : ancestors;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <GitBranch className="h-4 w-4 text-garden-500" />
            Lineage
          </h2>
          <p className="text-[11px] text-muted-foreground">
            generation {self.generation} · {ancestors.length} ancestor
            {ancestors.length === 1 ? "" : "s"}
          </p>
        </div>

        <ol
          className="mt-4 flex flex-wrap items-center gap-1.5 text-sm"
          data-testid="lineage-breadcrumb"
          aria-label="Lineage breadcrumb"
        >
          {overflow > 0 && (
            <>
              <li className="rounded-md border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                +{overflow} more
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </li>
            </>
          )}
          {visibleAncestors.map((node, i) => (
            <li key={node.slug} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
              <Link
                href={`/dashboard/garden/organism/${node.slug}`}
                className="rounded-md border bg-background px-2 py-1 text-xs hover:border-garden-500/50"
                title={`${node.name} (gen ${node.generation})`}
              >
                <span className="font-mono">{node.slug}</span>
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  gen {node.generation}
                </span>
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span
              className="rounded-md border border-garden-500/40 bg-garden-500/10 px-2 py-1 text-xs"
              aria-current="page"
              data-testid="lineage-self"
            >
              <span className="font-mono font-medium">{self.slug}</span>
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                gen {self.generation} (you are here)
              </span>
            </span>
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
