/**
 * Tissues dashboard view — Phase 18E.
 *
 *   Two sections:
 *     1. Tissues: list of all registered tissues with their
 *        status, policy, access model, and total decisions.
 *     2. Recent decisions: most recent 50 tissue-level
 *        decisions across the network.
 *
 *   Designed to be readable even when the tissue service is
 *   down — the page renders the empty state instead of throwing.
 */

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@aigarth/ui";
import type { DashboardTissue, DashboardTissueDecision } from "@/lib/tissues";

interface Props {
  tissues: DashboardTissue[];
  decisions: DashboardTissueDecision[];
}

function stateBadge(state: -1 | 0 | 1) {
  if (state === 1) return <Badge variant="success">+1 proceed</Badge>;
  if (state === -1) return <Badge variant="destructive">-1 block</Badge>;
  return <Badge variant="secondary">0 observe</Badge>;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fmtConfidence(v: number): string {
  return v.toFixed(3);
}

export function TissuesHistoryView({ tissues, decisions }: Props) {
  const totalDecisions = tissues.reduce((acc, t) => acc + t.totalDecisions, 0);
  const last24h = decisions.filter(
    (d) => Date.now() - new Date(d.createdAt).getTime() < 24 * 3600 * 1000,
  ).length;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tissues</h1>
        <p className="text-sm text-muted-foreground">
          Trinary Intelligence Layer — Phase 18E. {tissues.length} tissue
          {tissues.length === 1 ? "" : "s"} · {totalDecisions.toLocaleString()} total
          decision{totalDecisions === 1 ? "" : "s"} · {last24h} in the last 24h.
        </p>
      </header>

      {/* Tissues table */}
      <Card>
        <CardHeader>
          <CardTitle>Tissues</CardTitle>
        </CardHeader>
        <CardContent>
          {tissues.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tissues found. Is the tissue service running?
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Slug</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Policy</th>
                    <th className="py-2 font-medium">Access</th>
                    <th className="py-2 text-right font-medium">Decisions</th>
                  </tr>
                </thead>
                <tbody>
                  {tissues.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{t.name}</td>
                      <td className="py-2 font-mono text-xs">{t.slug}</td>
                      <td className="py-2">
                        <Badge variant={t.status === "active" ? "success" : "outline"}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-2 font-mono text-xs">{t.policyKind}</td>
                      <td className="py-2">
                        <Badge variant={t.access === "open" ? "secondary" : "warning"}>
                          {t.access}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-mono">
                        {t.totalDecisions.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent decisions table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No decisions yet. Call <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/v1/tissues/&lt;slug&gt;/decide</code> to produce one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Tissue</th>
                    <th className="py-2 font-medium">State</th>
                    <th className="py-2 font-medium">Confidence</th>
                    <th className="py-2 font-medium">Authority</th>
                    <th className="py-2 font-medium">Reasoning</th>
                    <th className="py-2 text-right font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 align-top">
                      <td className="py-2 text-xs text-muted-foreground">
                        {fmtTime(d.createdAt)}
                      </td>
                      <td className="py-2 font-mono text-xs">{d.tissueSlug}</td>
                      <td className="py-2">{stateBadge(d.state)}</td>
                      <td className="py-2 font-mono text-xs">
                        {fmtConfidence(d.confidence)}
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {fmtConfidence(d.authority)}
                      </td>
                      <td className="py-2 max-w-md">
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {d.reasoning}
                        </p>
                      </td>
                      <td className="py-2 text-right font-mono text-xs">
                        {d.latencyMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
