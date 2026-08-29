/**
 * Dashboard — Qubic OC Processor view (Phase 29 / ADR 007).
 *
 *   The operator surface for the inbound OC processor. Surfaces
 *   the registered processors, their circuit-breaker state, the
 *   rate-limit accounting, and the recent invocations.
 *
 *   Phase 29 ships the *mechanism* (package + library) but the
 *   production HTTP endpoint + the gateway wiring are Phase 30+.
 *   This page reads from the package registry (process-local) when
 *   the registry is hydrated in the same Node process; otherwise it
 *   surfaces the empty state with a clear "not registered" message.
 */

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@aigarth/ui";
import { ShieldCheck, ShieldOff, Pause, Play } from "lucide-react";

interface Props {
  processors: Array<{
    processor_id: string;
    capabilities: string[];
    fee_qubic: string;
    endpoint: string;
    breaker_state: "CLOSED" | "OPEN" | "HALF_OPEN";
    error_rate: number;
    samples: number;
  }>;
}

function stateIcon(state: "CLOSED" | "OPEN" | "HALF_OPEN") {
  if (state === "CLOSED") return <ShieldCheck className="h-3 w-3" />;
  if (state === "OPEN") return <ShieldOff className="h-3 w-3" />;
  return <ShieldOff className="h-3 w-3" />;
}

function stateBadge(state: "CLOSED" | "OPEN" | "HALF_OPEN") {
  const variant = state === "CLOSED" ? "success" : state === "OPEN" ? "destructive" : "secondary";
  return (
    <Badge variant={variant} className="gap-1.5">
      {stateIcon(state)}
      {state}
    </Badge>
  );
}

export function OcProcessorView({ processors }: Props) {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Qubic OC Processor</h1>
        <p className="text-sm text-muted-foreground">
          ADR 007 — the inbound mirror of the Execution Router. {processors.length} processor
          {processors.length === 1 ? "" : "s"} registered.
        </p>
      </header>

      {processors.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No processors registered</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              The OC processor package (<code>@aigarth/oc-processor</code>) ships a
              process-wide registry. It is populated by the operator's gateway
              boot sequence via <code>registerAsProcessor({"{...}"})</code>.
            </p>
            <p className="mt-3">
              The dashboard reads the registry from the gateway's process-local
              state. In Phase 30+ the registry will be hydrated from a small
              <code>oc_processors</code> table in services/work so the dashboard
              can read it from a different process.
            </p>
            <p className="mt-3">
              <strong>Operational references:</strong> ADR 007
              (<code>docs/architecture-decisions/007-oc-processor.md</code>),
              the public test surface{" "}
              <a
                href="https://ocmock.qubic.org/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                ocmock.qubic.org
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {processors.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {processors.map((p) => (
            <Card key={p.processor_id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm">{p.processor_id}</span>
                  {stateBadge(p.breaker_state)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Endpoint" value={p.endpoint} mono />
                <Row label="Fee" value={`${p.fee_qubic} Qu-bit / call`} mono />
                <div>
                  <div className="text-xs text-muted-foreground">Capabilities</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.capabilities.map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Error rate" value={`${(p.error_rate * 100).toFixed(1)}%`} />
                  <Stat label="Samples" value={String(p.samples)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs hover:bg-muted/40"
                    disabled
                    title="Wired in Phase 30+"
                  >
                    <Pause className="h-3 w-3" />
                    Pause
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs hover:bg-muted/40"
                    disabled
                    title="Wired in Phase 30+"
                  >
                    <Play className="h-3 w-3" />
                    Resume
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent invocations</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            The invocation log lives in the OC processor's process-local state for
            v1. Phase 30+ will persist invocations to services/work so the
            dashboard can read them from a separate process and so the 451/676
            signature bundle is durable.
          </p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}
