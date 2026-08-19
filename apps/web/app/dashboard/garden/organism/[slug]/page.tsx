/**
 * Garden — Organism detail (Phase 26.D).
 *
 *   The user's view of a single Organism. Server component that:
 *     1. Loads the Organism via /v1/organisms/:slug
 *     2. Loads fitness history via /v1/organisms/:slug/fitness
 *     3. Loads lineage chain via /v1/organisms/:slug/lineage
 *     4. Composes the six child components (Header, ActionBar,
 *        FitnessCurve, LineageBreadcrumb, LiveNeuralField,
 *        ExperienceStream)
 *
 *   Layout: two-column on wide, stacked on narrow. The action
 *   bar lives in the right rail; the live neural field and the
 *   experience stream stack below the lineage breadcrumb.
 *
 *   Auth: middleware redirects unauthenticated users; the
 *   page-level redirect is a defense-in-depth fallback.
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import type { OrganismFitnessPoint } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";
import { OrganismHeader, type OrganismHeaderData } from "@/components/organism/OrganismHeader";
import { OrganismActionBar } from "@/components/organism/OrganismActionBar";
import { FitnessCurve, type FitnessPoint } from "@/components/organism/FitnessCurve";
import {
  LineageBreadcrumb,
  type LineageNode,
} from "@/components/organism/LineageBreadcrumb";
import { LiveNeuralField } from "@/components/organism/LiveNeuralField";
import { ExperienceStream } from "@/components/organism/ExperienceStream";

interface PageProps {
  params: { slug: string };
}

interface RawOrganism {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creator_id: string;
  visibility: string;
  status: string;
  kind: string;
  fitness: number | null;
  parent_slug?: string | null;
  parent_id: string | null;
  root_id: string;
  root_slug?: string | null;
  generation: number;
  created_at: string;
  updated_at: string;
}

interface RawFitness {
  data: Array<{
    id: string;
    organism_id: string;
    generation: number;
    fitness: number;
    components: Record<string, number>;
    recorded_at: string;
  }>;
}

/** Local alias for a single fitness row. */
type FitnessRow = RawFitness["data"][number];

interface RawLineage {
  id: string;
  slug: string;
  name: string;
  generation: number;
  parent_id: string | null;
  children: RawLineage[];
}

/**
 * Flatten a recursive lineage tree (root → self) into a linear
 * chain.  The root is the tree's root; the path from root to the
 * matching slug is the breadcrumb.
 */
function flattenLineage(
  node: RawLineage,
  parentSlug: string | null,
  target: string,
  acc: LineageNode[],
): boolean {
  // Push this node, then recurse into children until we find
  // the target.  parentSlug is the slug of the previous node in
  // the chain (root has parentSlug === null).
  acc.push({
    slug: node.slug,
    name: node.name,
    generation: node.generation,
    parent_slug: parentSlug,
  });
  if (node.slug === target) return true;
  for (const child of node.children ?? []) {
    if (flattenLineage(child, node.slug, target, acc)) return true;
  }
  acc.pop();
  return false;
}

function lineageToChain(tree: RawLineage, target: string): LineageNode[] {
  const acc: LineageNode[] = [];
  flattenLineage(tree, null, target, acc);
  return acc;
}

export default async function OrganismDetailPage({ params }: PageProps) {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;
  const slug = decodeURIComponent(params.slug);

  // 1) Load the organism. 404 if it doesn't exist or is not visible.
  // Use the server-only `organismDetail` helper which returns null
  // on 404 instead of throwing (defined in lib/server/aigarth.ts).
  const organism: RawOrganism | null = await a.organismDetail(slug);
  if (!organism) {
    notFound();
  }

  // 2) Load fitness + lineage in parallel. Tolerate per-endpoint
  // failure so a missing lineage or fitness log doesn't blank
  // the whole page.
  type FitnessRes = { data: OrganismFitnessPoint[]; nextOffset: number | null; limit: number; offset: number };
  const [fitnessRes, lineageRes] = await Promise.all([
    a.organisms
      .fitness(slug, { limit: 50 })
      .catch(
        () =>
          ({
            data: [] as OrganismFitnessPoint[],
            nextOffset: null,
            limit: 0,
            offset: 0,
          }) as FitnessRes,
      ),
    a.organisms
      .lineage(slug)
      .catch(() => null),
  ]);

  const fitnessPoints: FitnessPoint[] = (fitnessRes.data ?? []).map((f) => ({
    generation: f.generation,
    fitness: f.fitness,
    recordedAt: f.recorded_at,
  }));

  const lineageChain: LineageNode[] = lineageRes
    ? lineageToChain(lineageRes as unknown as RawLineage, slug)
    : [];

  const headerData: OrganismHeaderData = {
    slug: organism.slug,
    name: organism.name,
    kind: organism.kind,
    status: organism.status,
    visibility: organism.visibility,
    generation: organism.generation,
    fitness: organism.fitness,
    parentSlug: organism.parent_slug ?? null,
    rootSlug: organism.root_slug ?? organism.root_id,
    creatorId: organism.creator_id,
    description: organism.description,
  };

  const annBaseUrl =
    process.env.AIGARTH_ANN_URL ?? "http://localhost:7006";

  return (
    <div className="space-y-6">
      <PageHeader
        title={organism.name}
        description={`Generation ${organism.generation} · ${organism.kind}`}
        action={
          <Link
            href="/dashboard/garden"
            className="inline-flex items-center gap-1 text-xs text-garden-600 hover:underline dark:text-garden-400"
          >
            <ChevronLeft className="h-3 w-3" /> Back to Garden
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <OrganismHeader organism={headerData} />

          <FitnessCurve entries={fitnessPoints} />

          <LineageBreadcrumb chain={lineageChain} />

          <div className="grid gap-6 md:grid-cols-2">
            <LiveNeuralField
              slug={organism.slug}
              generation={organism.generation}
            />
            <ExperienceStream slug={organism.slug} />
          </div>
        </div>

        <aside className="space-y-4">
          <OrganismActionBar
            slug={organism.slug}
            currentUserId={session.userId ?? ""}
            creatorId={organism.creator_id}
            annBaseUrl={annBaseUrl}
            accessToken={session.accessToken}
          />

          <div className="rounded-md border bg-card/40 p-4 text-xs text-muted-foreground">
            <h3 className="text-sm font-semibold text-foreground">
              Capability Card
            </h3>
            <p className="mt-1.5">
              The Capability Card (PEP v0.2 §24) consolidates the
              organism&apos;s state, compute consumed, and lineage
              into a single snapshot. The fields above are the live
              read; the Card format itself ships in a follow-up.
            </p>
            <ul className="mt-3 space-y-1">
              <li>· Generation {organism.generation}</li>
              <li>· Status {organism.status}</li>
              <li>· Visibility {organism.visibility}</li>
              <li>
                · Created{" "}
                {new Date(organism.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
