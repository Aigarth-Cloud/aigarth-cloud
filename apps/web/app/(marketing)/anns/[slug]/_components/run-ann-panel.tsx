"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw, CheckCircle2, XCircle, Loader2, Cpu, ShieldCheck } from "lucide-react";
import { Button, Badge } from "@aigarth/ui";

type Target = "local" | "qubic_oc";

interface RunAnnPanelProps {
  slug: string;
  version: string;
  manifestHash: string;
  architecture: string;
  signedIn: boolean;
}

interface ExecutionRow {
  execution_id: string;
  ann_version: string;
  target: Target;
  status: "queued" | "running" | "completed" | "failed";
  result_hash: string | null;
  verification_status: string;
  work_id: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

const DEFAULT_BTC_INPUT = `{
  "features": [100, 101.5, 103, 104.2, 105.8, 107, 108.5, 110, 111.4, 112.7, 114, 115.3, 116.5, 117.8, 119, 120.2, 121.5, 122.7, 124, 125.2, 126.5, 127.8, 129, 130.2, 131.5, 132.7, 134, 135.3, 136.5, 137.8]
}`;

/**
 * Run ANN panel — the Phase 29 user surface.
 *
 *   1. Pick a target (Local | Qubic OC).
 *   2. Edit the input JSON. A 30-day BTC price window is pre-filled
 *      for the BTC Direction Predictor demo; the panel still works
 *      for any ANN.
 *   3. Click Run. The panel POSTs to /api/anns/:slug/execute (a
 *      server proxy that carries the JWT from the session cookie).
 *   4. The returned execution id is polled every 2 s until the
 *      execution reaches a terminal state (or a 30 s timeout).
 *   5. The last 20 executions are listed below.
 */
export function RunAnnPanel({ slug, version, manifestHash, architecture, signedIn }: RunAnnPanelProps) {
  const router = useRouter();
  const [target, setTarget] = React.useState<Target>("local");
  const [inputText, setInputText] = React.useState(DEFAULT_BTC_INPUT);
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [current, setCurrent] = React.useState<ExecutionRow | null>(null);
  const [history, setHistory] = React.useState<ExecutionRow[]>([]);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  // Load history on mount.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/anns/${encodeURIComponent(slug)}/executions?limit=20`, {
          cache: "no-store",
        });
        if (!r.ok) {
          setHistoryError(`Failed to load history: ${r.status}`);
          return;
        }
        const data = (await r.json()) as { data: ExecutionRow[] };
        if (!cancelled) setHistory(data.data ?? []);
      } catch (err) {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const submit = React.useCallback(async () => {
    setInputError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(inputText);
    } catch (err) {
      setInputError(`Input is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (!manifestHash) {
      setInputError("This ANN has no published manifest hash yet. Run `pnpm db:seed-btc` first.");
      return;
    }
    setSubmitting(true);
    setCurrent(null);
    try {
      const r = await fetch(`/api/anns/${encodeURIComponent(slug)}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manifest_hash: manifestHash,
          version,
          target,
          request_id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          input: parsed,
          parameters: { timeout_ms: 30_000, deterministic: true },
        }),
      });
      if (!r.ok) {
        const detail = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
        setInputError(detail.error?.message ?? `Execute failed: ${r.status}`);
        return;
      }
      const out = (await r.json()) as { execution_id: string; status: string };
      const placeholder: ExecutionRow = {
        execution_id: out.execution_id,
        ann_version: version,
        target,
        status: "running",
        result_hash: null,
        verification_status: "pending",
        work_id: null,
        error: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      };
      setCurrent(placeholder);
      await pollExecution(slug, out.execution_id, (row) => setCurrent(row));
      // Refresh history.
      const hr = await fetch(`/api/anns/${encodeURIComponent(slug)}/executions?limit=20`, {
        cache: "no-store",
      });
      if (hr.ok) {
        const data = (await hr.json()) as { data: ExecutionRow[] };
        setHistory(data.data ?? []);
      }
      router.refresh();
    } catch (err) {
      setInputError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [slug, version, target, inputText, manifestHash, router]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Run ANN</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a workload to the Execution Router. The same ANN and input go to either
          backend. The result hash is deterministic — anyone with the manifest can re-derive it.
        </p>

        {!signedIn && (
          <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-4 text-sm">
            <p className="font-medium">Sign in to run this ANN.</p>
            <p className="mt-1 text-muted-foreground">
              The execution log is read-only without a session. Sign in to submit runs and
              see the verification status.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push(`/login?next=/anns/${slug}`)}
            >
              Sign in
            </Button>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <TargetPill
            target="local"
            active={target === "local"}
            onSelect={() => setTarget("local")}
            icon={<Cpu className="h-4 w-4" />}
            title="Local"
            description="Deterministic, in-process. Always produces the same result for the same input."
          />
          <TargetPill
            target="qubic_oc"
            active={target === "qubic_oc"}
            onSelect={() => setTarget("qubic_oc")}
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Qubic OC"
            description="Submitted to the Aigarth OC engine, verified by replication. Decentralized."
          />
        </div>

        <div className="mt-6">
          <label className="text-sm font-medium">Input</label>
          <p className="mt-1 text-xs text-muted-foreground">
            Validated against the manifest&apos;s <code>inputSchema</code>. The BTC Direction
            Predictor expects a <code>features</code> array of 30 closing prices.
          </p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="mt-3 h-48 w-full rounded-xl border bg-muted/30 p-3 font-mono text-xs"
            spellCheck={false}
          />
          {inputError && (
            <p className="mt-2 text-xs text-red-500">{inputError}</p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={submit} disabled={submitting || !signedIn} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run ANN
          </Button>
          <span className="text-xs text-muted-foreground">
            Architecture: <code>{architecture}</code>
          </span>
        </div>

        {current && (
          <div className="mt-6 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Latest run</div>
                <div className="mt-1 font-mono text-xs">{current.execution_id}</div>
              </div>
              <StatusBadge status={current.status} verification={current.verification_status} />
            </div>
            {current.result_hash && (
              <div className="mt-3 grid gap-2 text-xs">
                <Row label="Result hash" value={current.result_hash} mono />
                {current.work_id && <Row label="Work id (OC)" value={current.work_id} mono />}
                <Row label="Verification" value={current.verification_status} />
              </div>
            )}
            {current.error && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-500">
                {current.error}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-medium tracking-tight">History</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.refresh()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The 20 most recent executions for this ANN.
        </p>
        {historyError && (
          <p className="mt-3 text-xs text-red-500">{historyError}</p>
        )}
        <div className="mt-4 space-y-2">
          {history.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No executions yet. Click <span className="font-medium">Run ANN</span> to start.
            </div>
          )}
          {history.map((row) => (
            <HistoryRow key={row.execution_id} row={row} />
          ))}
        </div>
      </div>
    </div>
  );
}

async function pollExecution(
  slug: string,
  executionId: string,
  onUpdate: (row: ExecutionRow) => void,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000));
    try {
      const r = await fetch(
        `/api/anns/${encodeURIComponent(slug)}/executions/${encodeURIComponent(executionId)}`,
        { cache: "no-store" },
      );
      if (!r.ok) continue;
      const row = (await r.json()) as ExecutionRow;
      onUpdate(row);
      if (row.status === "completed" || row.status === "failed") return;
    } catch {
      // Network blip — keep polling.
    }
  }
}

function TargetPill({
  target,
  active,
  onSelect,
  icon,
  title,
  description,
}: {
  target: Target;
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "rounded-xl border p-4 text-left transition",
        active ? "border-foreground bg-foreground/5" : "hover:border-foreground/40",
      ].join(" ")}
      aria-pressed={active}
      data-target={target}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{title}</span>
        {active && <Badge variant="glow" className="ml-auto">Selected</Badge>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function StatusBadge({ status, verification }: { status: string; verification: string }) {
  if (status === "completed" && verification === "local_deterministic") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        local_deterministic
      </Badge>
    );
  }
  if (status === "completed" && verification === "verified") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        verified
      </Badge>
    );
  }
  if (status === "disputed" || verification === "disputed") {
    return (
      <Badge variant="outline" className="gap-1.5 text-amber-500">
        <XCircle className="h-3 w-3" />
        disputed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="gap-1.5 text-red-500">
        <XCircle className="h-3 w-3" />
        failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5">
      <Loader2 className="h-3 w-3 animate-spin" />
      {status}
    </Badge>
  );
}

function HistoryRow({ row }: { row: ExecutionRow }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-xs">{row.execution_id}</div>
        <StatusBadge status={row.status} verification={row.verification_status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>target: {row.target}</div>
        <div>version: {row.ann_version}</div>
        {row.result_hash && <div className="col-span-2 truncate">hash: {row.result_hash}</div>}
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono truncate" : "truncate"}>{value}</span>
    </div>
  );
}
