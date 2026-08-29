import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@aigarth/ui";
import { Cpu, ShieldCheck, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  loadAnnsWithExecutionInfo,
  loadExecutionsForAnn,
  type DashboardAnn,
  type DashboardExecution,
} from "@/lib/ann-execution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { slug: string };
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function AnnDetailDashboardPage({ params }: PageProps) {
  const all = await loadAnnsWithExecutionInfo();
  const ann = all.find((a) => a.slug === params.slug);
  if (!ann) notFound();
  const executions = await loadExecutionsForAnn(params.slug, 50);
  return <AnnDetailDashboard ann={ann} executions={executions} />;
}

function AnnDetailDashboard({ ann, executions }: { ann: DashboardAnn; executions: DashboardExecution[] }) {
  return (
    <div className="space-y-6 p-6">
      <header>
        <Link
          href="/ann-execution"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All ANNs
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{ann.name}</h1>
        <p className="text-sm text-muted-foreground">{ann.tagline}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Slug" value={ann.slug} mono />
            <Row label="Version" value={ann.currentVersion} mono />
            <Row label="Architecture" value={ann.architecture} mono />
            <Row label="Status" value={ann.status} />
            <Row label="Accuracy" value={ann.accuracy ? `${ann.accuracy}%` : "—"} />
            <Row label="Latency p50" value={ann.latencyP50Ms ? `${ann.latencyP50Ms} ms` : "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manifest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Manifest hash" value={ann.manifestHash ?? "—"} mono />
            {ann.repository && (
              <a
                className="inline-flex items-center gap-1.5 text-xs hover:underline"
                href={`https://github.com/${ann.repository.owner}/${ann.repository.name}`}
                target="_blank"
                rel="noreferrer"
              >
                {ann.repository.owner}/{ann.repository.name} @ {ann.repository.commitSha.slice(0, 7)}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Row label="Published" value={fmtTime(ann.repository?.publishedAt ?? null)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              The dashboard is read-mostly. To run an ANN, open it in the web app
              (signed in) and click Run. Or POST directly to{" "}
              <code>POST /v1/anns/{ann.slug}/execute</code> on services/ann.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5">
                <Cpu className="h-3 w-3" />
                Local
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Qubic OC
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Execution</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Verification</th>
                  <th className="px-4 py-2">Result hash</th>
                  <th className="px-4 py-2">Work id</th>
                  <th className="px-4 py-2">Started</th>
                  <th className="px-4 py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                      No executions for this ANN yet.
                    </td>
                  </tr>
                )}
                {executions.map((e) => {
                  const dur =
                    e.completedAt && e.startedAt
                      ? `${Math.max(0, new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime())} ms`
                      : "—";
                  return (
                    <tr key={e.executionId} className="border-b">
                      <td className="px-4 py-2 font-mono text-xs">{e.executionId}</td>
                      <td className="px-4 py-2">
                        {e.target === "local" ? "Local" : "Qubic OC"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={
                            e.status === "completed"
                              ? "success"
                              : e.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs">{e.verificationStatus}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {e.resultHash ? `${e.resultHash.slice(0, 14)}…` : "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{e.workId ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{fmtTime(e.startedAt)}</td>
                      <td className="px-4 py-2 text-xs">{dur}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-right" : "text-right"}>{value}</span>
    </div>
  );
}
