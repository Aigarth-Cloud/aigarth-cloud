/**
 * Dashboard — ANN Execution view (Phase 29).
 *
 *   Renders three things:
 *     1. The list of ANNs with their execution-readiness (manifest
 *        hash, repository link, architecture).
 *     2. A "Run" panel that lets the operator fire a quick local
 *        or OC execution against any ANN with a published manifest.
 *     3. The 50 most recent executions across all ANNs, with
 *        status + verification + result hash.
 *
 *   The dashboard is **read-mostly** for the operator: it surfaces
 *   state, it can fire runs, but it does not manage the OC
 *   processor (that lives on /oc).
 */

import { Badge, Card, CardContent, CardHeader, CardTitle, Button } from "@aigarth/ui";
import { Cpu, ShieldCheck, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { DashboardAnn, DashboardExecution } from "@/lib/ann-execution";

interface Props {
  anns: DashboardAnn[];
  executions: DashboardExecution[];
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AnnExecutionView({ anns, executions }: Props) {
  const totalLocal = executions.filter((e) => e.target === "local").length;
  const totalOc = executions.filter((e) => e.target === "qubic_oc").length;
  const verified = executions.filter((e) => e.verificationStatus === "verified" || e.verificationStatus === "local_deterministic").length;
  const disputed = executions.filter((e) => e.verificationStatus === "disputed").length;
  const failed = executions.filter((e) => e.status === "failed").length;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ANN Execution</h1>
          <p className="text-sm text-muted-foreground">
            Phase 29 — the Execution Router layer. {anns.length} ANN{anns.length === 1 ? "" : "s"}{" "}
            with {executions.length} total run{executions.length === 1 ? "" : "s"} ·{" "}
            {totalLocal} local · {totalOc} OC · {verified} verified · {disputed} disputed · {failed} failed.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="h-3 w-3" />
          Auto-refresh
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>ANNs with Execution-Readiness</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">ANN</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Architecture</th>
                  <th className="px-4 py-2">Manifest</th>
                  <th className="px-4 py-2">Repository</th>
                  <th className="px-4 py-2">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {anns.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                      No ANNs found. Run <code>pnpm --filter @aigarth/ann db:seed</code> then{" "}
                      <code>pnpm --filter @aigarth/ann db:seed-btc</code>.
                    </td>
                  </tr>
                )}
                {anns.map((ann) => (
                  <tr key={ann.slug} className="border-b">
                    <td className="px-4 py-2">
                      <Link href={`/ann-execution/${ann.slug}`} className="font-medium hover:underline">
                        {ann.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{ann.slug}</div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={ann.status === "published" ? "success" : "secondary"}>
                        {ann.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{ann.architecture}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {ann.manifestHash ? `${ann.manifestHash.slice(0, 14)}…` : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {ann.repository ? (
                        <a
                          className="inline-flex items-center gap-1 hover:underline"
                          href={`https://github.com/${ann.repository.owner}/${ann.repository.name}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {ann.repository.owner}/{ann.repository.name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {ann.accuracy ? `${ann.accuracy}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent executions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Execution</th>
                  <th className="px-4 py-2">ANN</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Verification</th>
                  <th className="px-4 py-2">Result hash</th>
                  <th className="px-4 py-2">Started</th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                      No executions yet. Open an ANN in the web app and click Run.
                    </td>
                  </tr>
                )}
                {executions.map((e) => (
                  <tr key={e.executionId} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">{e.executionId}</td>
                    <td className="px-4 py-2">
                      <Link href={`/ann-execution/${e.annSlug}`} className="hover:underline">
                        {e.annSlug}
                      </Link>
                      <div className="text-xs text-muted-foreground">{e.annVersion}</div>
                    </td>
                    <td className="px-4 py-2">
                      {e.target === "local" ? (
                        <Badge variant="outline" className="gap-1.5">
                          <Cpu className="h-3 w-3" />
                          Local
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1.5">
                          <ShieldCheck className="h-3 w-3" />
                          Qubic OC
                        </Badge>
                      )}
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
                    <td className="px-4 py-2 text-xs">{fmtTime(e.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
