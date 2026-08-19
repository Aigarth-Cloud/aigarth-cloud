import { redirect } from "next/navigation";
import { Server, Users } from "lucide-react";
import { Badge } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

interface RawRegion {
  id: string;
  name: string;
  slug: string;
  computor_count: number;
  is_active: boolean;
}

interface RawCluster {
  id: string;
  region_id: string;
  name: string;
  slug: string;
  purpose: string | null;
  min_computors: number;
  is_active: boolean;
}

interface RawMember {
  id: string;
  computor_index: number;
  status: string;
  joined_at: string;
  last_heartbeat_at: string;
}

export default async function ClustersPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;
  const [regionsRes, clustersRes] = await Promise.all([
    a.compute.regions.list().catch(() => ({ data: [] as RawRegion[] })),
    a.compute.clusters.list().catch(() => ({ data: [] as RawCluster[] })),
  ]);

  const regions = (regionsRes.data as unknown as RawRegion[]) ?? [];
  const clusters = (clustersRes.data as unknown as RawCluster[]) ?? [];

  // Fetch members for each cluster in parallel
  const memberLists = await Promise.all(
    clusters.map((c) => a.compute.clusters.listMembers(c.id).catch(() => ({ cluster_id: c.id, data: [] as RawMember[] }))),
  );
  const membersByCluster = new Map(memberLists.map((m) => [m.cluster_id, (m.data as unknown as RawMember[]) ?? []]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clusters"
        description="Compute clusters grouped by region."
      />

      {clusters.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Server className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No clusters yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Clusters are created from regions by compute operators.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map((c) => {
            const region = regions.find((r) => r.id === c.region_id);
            const members = membersByCluster.get(c.id) ?? [];
            return (
              <div key={c.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <div className="font-mono text-xs text-muted-foreground">{c.slug}</div>
                    {c.purpose && (
                      <div className="mt-1 text-sm text-muted-foreground">{c.purpose}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{region?.name ?? c.region_id}</Badge>
                    {c.is_active ? (
                      <Badge variant="success">active</Badge>
                    ) : (
                      <Badge variant="secondary">inactive</Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>min {c.min_computors} computors</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {members.length} member{members.length === 1 ? "" : "s"}
                  </span>
                </div>
                {members.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {members.map((m) => (
                      <div key={m.id} className="rounded-md border bg-muted/30 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono">#{m.computor_index}</span>
                          <Badge
                            variant={
                              m.status === "active"
                                ? "success"
                                : m.status === "draining"
                                  ? "warning"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {m.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          last heartbeat: {new Date(m.last_heartbeat_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
