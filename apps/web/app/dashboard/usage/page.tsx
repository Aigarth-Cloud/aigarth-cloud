import { redirect } from "next/navigation";
import { Activity, Coins, Cpu, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

function fmtNumber(n: number | bigint | string | undefined): string {
  if (n === undefined || n === null) return " ";
  const v = typeof n === "bigint" ? Number(n) : Number(n);
  if (!Number.isFinite(v)) return " ";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtQu(qubic: string | number | bigint | undefined): string {
  if (qubic === undefined || qubic === null) return " ";
  const v = Number(qubic) / 1_000_000;
  if (!Number.isFinite(v)) return " ";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 6 })} Qu`;
}

interface RawUsage {
  total_requests?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_cost_qubic?: string;
  by_model?: { model: string; requests: number; tokens: number; cost: string }[];
  by_endpoint?: { endpoint: string; requests: number; tokens: number; cost: string }[];
}

interface RawRequest {
  id: string;
  model: string;
  endpoint: string;
  status_code: number;
  duration_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  created_at: string;
}

export default async function UsagePage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;

  const [usageRes, recentRes, stats] = await Promise.all([
    a.usage.list().catch(() => null),
    a.usage.recent(20).catch(() => ({ data: [] as RawRequest[] })),
    a.compute.stats().catch(() => null),
  ]);

  const usage = (usageRes as unknown as RawUsage) ?? null;
  const recent = (recentRes as unknown as { data: RawRequest[] }).data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage"
        description="API calls, tokens, and spend across all your keys."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total requests" value={fmtNumber(usage?.total_requests)} icon={Activity} />
        <Stat label="Total tokens" value={fmtNumber(usage?.total_tokens)} icon={Cpu} />
        <Stat label="Total cost" value={fmtQu(usage?.total_cost_qubic)} icon={Coins} />
        <Stat label="Compute jobs" value={fmtNumber(stats?.total_jobs)} icon={TrendingUp} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">By model</h3>
          <div className="mt-4 space-y-2">
            {!usage?.by_model || usage.by_model.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No model usage yet. Make a chat completion to populate this.
              </div>
            ) : (
              usage.by_model.map((m) => (
                <div key={m.model} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{m.model}</span>
                  <span className="text-muted-foreground">
                    {fmtNumber(m.requests)} req · {fmtNumber(m.tokens)} tok · {fmtQu(m.cost)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">By endpoint</h3>
          <div className="mt-4 space-y-2">
            {!usage?.by_endpoint || usage.by_endpoint.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No endpoint usage yet.
              </div>
            ) : (
              usage.by_endpoint.map((e) => (
                <div key={e.endpoint} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{e.endpoint}</span>
                  <span className="text-muted-foreground">
                    {fmtNumber(e.requests)} req · {fmtNumber(e.tokens)} tok
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-6">
          <h3 className="font-semibold">Recent requests</h3>
          <p className="text-sm text-muted-foreground">Last 20 calls across all your keys.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left">Time</th>
                <th className="px-6 py-3 text-left">Model</th>
                <th className="px-6 py-3 text-left">Endpoint</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Tokens</th>
                <th className="px-6 py-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No requests yet.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{r.model}</td>
                    <td className="px-6 py-3 font-mono text-xs">{r.endpoint}</td>
                    <td className="px-6 py-3">
                      <span className={r.status_code >= 400 ? "text-red-500" : "text-mint-600"}>
                        {r.status_code}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {fmtNumber(r.prompt_tokens + r.completion_tokens)}
                    </td>
                    <td className="px-6 py-3 text-right text-muted-foreground">
                      {r.duration_ms}ms
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
