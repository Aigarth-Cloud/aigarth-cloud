import { redirect } from "next/navigation";
import { Cpu, Server, Activity, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

interface RawRegion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  computor_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RawCluster {
  id: string;
  region_id: string;
  name: string;
  slug: string;
  purpose: string | null;
  min_computors: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RawJob {
  id: string;
  type: string;
  status: string;
  priority: number;
  region_id: string | null;
  cluster_id: string | null;
  tx_hash: string | null;
  credit_used_qubic: string | null;
  submitted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
}

export default async function ComputePage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;

  const [regionsRes, clustersRes, jobsRes, stats, credit] = await Promise.all([
    a.compute.regions.list().catch(() => ({ data: [] as RawRegion[] })),
    a.compute.clusters.list().catch(() => ({ data: [] as RawCluster[] })),
    a.compute.jobs.list({ limit: 20 }).catch(() => ({ data: [] as RawJob[] })),
    a.compute.stats().catch(() => null),
    a.compute.credit().catch(() => null),
  ]);

  const regions = (regionsRes.data as unknown as RawRegion[]) ?? [];
  const clusters = (clustersRes.data as unknown as RawCluster[]) ?? [];
  const jobs = (jobsRes.data as unknown as RawJob[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compute"
        description="Regions, clusters, jobs, and capacity across the Aigarth network."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total jobs"
          value={(stats?.total_jobs ?? 0).toLocaleString()}
          icon={Activity}
        />
        <Stat
          label="Active jobs"
          value={(stats?.active_jobs ?? 0).toLocaleString()}
          icon={Cpu}
        />
        <Stat
          label="Completed"
          value={(stats?.completed_jobs ?? 0).toLocaleString()}
          icon={CheckCircle2}
        />
        <Stat
          label="Failed"
          value={(stats?.failed_jobs ?? 0).toLocaleString()}
          icon={XCircle}
        />
      </div>

      {credit && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Compute credit</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-xl font-medium">
                {(Number(credit.total_credit_qubic) / 1_000_000).toFixed(2)} Qu
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Used</div>
              <div className="text-xl font-medium">
                {(Number(credit.used_qubic) / 1_000_000).toFixed(2)} Qu
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="text-xl font-medium text-primary">
                {(Number(credit.remaining_qubic) / 1_000_000).toFixed(2)} Qu
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="border-b p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <Server className="h-4 w-4" /> Regions ({regions.length})
            </h3>
          </div>
          <div className="divide-y">
            {regions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No regions.
              </div>
            ) : (
              regions.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.slug}</div>
                    {r.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{r.computor_count}</div>
                    <div className="text-xs text-muted-foreground">computors</div>
                    {r.is_active ? (
                      <Badge variant="success" className="mt-1">active</Badge>
                    ) : (
                      <Badge variant="secondary" className="mt-1">inactive</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <Server className="h-4 w-4" /> Clusters ({clusters.length})
            </h3>
          </div>
          <div className="divide-y">
            {clusters.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No clusters.
              </div>
            ) : (
              clusters.map((c) => {
                const region = regions.find((r) => r.id === c.region_id);
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.slug}</div>
                        {c.purpose && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{c.purpose}</div>
                        )}
                      </div>
                      {c.is_active ? (
                        <Badge variant="success">active</Badge>
                      ) : (
                        <Badge variant="secondary">inactive</Badge>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Region: {region?.name ?? c.region_id} · min {c.min_computors} computors
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <Cpu className="h-4 w-4" /> Recent jobs
          </h3>
          <p className="text-sm text-muted-foreground">
            Last {jobs.length} job{jobs.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left">ID</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Priority</th>
                <th className="px-6 py-3 text-right">Cost</th>
                <th className="px-6 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No jobs yet.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 font-mono text-xs">{j.id.slice(0, 8)}</td>
                    <td className="px-6 py-3">{j.type}</td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          j.status === "completed"
                            ? "success"
                            : j.status === "failed" || j.status === "cancelled"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {j.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 font-mono">{j.priority}</td>
                    <td className="px-6 py-3 text-right font-mono">
                      {j.credit_used_qubic
                        ? `${(Number(j.credit_used_qubic) / 1_000_000).toFixed(4)} Qu`
                        : " "}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(j.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-4 text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-medium tracking-tight">{value}</div>
    </div>
  );
}
