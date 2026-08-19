"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet as WalletIcon,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Button } from "@aigarth/ui";

/**
 * Command centre page for the AigarthPool multi-sig governance.
 *
 * Polls the ann service's /v1/aigarthpool/governance/state endpoint
 * and shows:
 *   - Headline KPIs: initialized, signers, threshold, pending ops
 *   - Verifier status: which signer set is in effect
 *   - Signer list with the first 6 chars + last 4 of each
 *   - Pending treasury transfer card (if any): from, to, approvals
 *   - Pending signer change card (if any): add, remove, threshold
 *   - How the flow works (3 steps)
 *
 * Updates every 10s. Server-side, the route is public-read so we
 * can poll without auth. Mutations (submit, approve, execute) are
 * JWT-gated on the ann service and out of scope for the command
 * centre — they live in the wallet UI.
 */

type PendingTreasuryTransfer = {
  to: string;
  nonce: number;
  submitted_at_epoch: number;
  approvals: string[];
  approval_count: number;
};

type PendingSignerChange = {
  to_add: string[];
  to_remove: string[];
  new_threshold: number | null;
  nonce: number;
  submitted_at_epoch: number;
  approvals: string[];
  approval_count: number;
};

type GovernanceState = {
  initialized: boolean;
  signers: string[];
  threshold: number;
  treasury_wallet: string;
  has_pending_treasury_transfer: boolean;
  has_pending_signer_change: boolean;
  pending_treasury_transfer: PendingTreasuryTransfer | null;
  pending_signer_change: PendingSignerChange | null;
  pending_op_expires_at_epoch: number | null;
  /** Phase 23.2 (M4) — circuit breaker. */
  paused: boolean;
  checked_at?: string;
};

type EndpointHealth = {
  name: string;
  method: "GET" | "POST";
  path: string;
  status: "up" | "down" | "checking";
  latencyMs: number;
  detail?: string;
};

const ENDPOINTS: { name: string; method: EndpointHealth["method"]; path: string }[] = [
  { name: "governance.state", method: "GET", path: "/v1/aigarthpool/governance/state" },
  { name: "governance.init", method: "POST", path: "/v1/aigarthpool/governance/init" },
  { name: "governance.treasury-transfer", method: "POST", path: "/v1/aigarthpool/governance/treasury-transfer" },
  { name: "governance.signer-change", method: "POST", path: "/v1/aigarthpool/governance/signer-change" },
  { name: "governance.pause", method: "POST", path: "/v1/aigarthpool/governance/pause" },
];

export function GovernanceView() {
  const [state, setState] = React.useState<GovernanceState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [endpoints, setEndpoints] = React.useState<EndpointHealth[]>(
    ENDPOINTS.map((e) => ({
      name: e.name,
      method: e.method,
      path: e.path,
      status: "checking",
      latencyMs: 0,
    })),
  );

  const refresh = React.useCallback(async (manual: boolean) => {
    if (manual) setRefreshing(true);
    try {
      const start = performance.now();
      const statsRes = await fetch("/api/aigarthpool/governance/state", { cache: "no-store" });
      const latencyMs = Math.round(performance.now() - start);
      if (statsRes.ok) {
        setState((await statsRes.json()) as GovernanceState);
        setError(null);
        setEndpoints((curr) =>
          curr.map((e) => (e.name === "governance.state" ? { ...e, status: "up", latencyMs } : e)),
        );
      } else {
        setError(`Governance endpoint returned ${statsRes.status}`);
        setEndpoints((curr) =>
          curr.map((e) => (e.name === "governance.state" ? { ...e, status: "down", latencyMs, detail: `HTTP ${statsRes.status}` } : e)),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    refresh(false);
    const interval = setInterval(() => refresh(false), 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <PageHeader
        refreshing={refreshing}
        onRefresh={() => refresh(true)}
        lastCheckedAt={state?.checked_at}
      />

      <PauseBanner state={state} />

      <VerifierBanner state={state} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Initialized"
          value={state?.initialized ? "Yes" : "No"}
          icon={ShieldCheck}
          hint={state?.initialized ? "Governance active" : "Run /init to bootstrap"}
          accent={state?.initialized ? "emerald" : "amber"}
        />
        <StatCard
          label="Signers"
          value={state?.signers.length ?? 0}
          icon={Users}
          hint={`Threshold: ${state?.threshold ?? 0}`}
          accent="primary"
        />
        <StatCard
          label="Treasury"
          value={state?.treasury_wallet ? `${state.treasury_wallet.slice(0, 6)}…${state.treasury_wallet.slice(-4)}` : "—"}
          icon={WalletIcon}
          hint={state?.treasury_wallet ? "Active wallet" : "Not set"}
          accent="blue"
        />
        <StatCard
          label="Pending ops"
          value={(state?.has_pending_treasury_transfer ? 1 : 0) + (state?.has_pending_signer_change ? 1 : 0)}
          icon={Clock}
          hint={
            state?.pending_op_expires_at_epoch != null
              ? `Expires @ epoch ${state.pending_op_expires_at_epoch}`
              : "None"
          }
          accent="amber"
        />
        <StatCard
          label="Pool status"
          value={state?.paused ? "Paused" : "Active"}
          icon={state?.paused ? PauseCircle : PlayCircle}
          hint={
            state?.paused
              ? "All stake/unlock/claim halted (M4)"
              : "Stake, unlock, and claim open"
          }
          accent={state?.paused ? "amber" : "emerald"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SignerListCard state={state} />
        <TreasuryCard state={state} />
      </div>

      <SignerChangeCard state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Endpoint health</CardTitle>
          <CardDescription>Live ping to the ANN service</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {endpoints.map((e) => (
              <li
                key={e.name}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2 text-xs"
              >
                <HealthIcon status={e.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold">{e.name}</span>
                    <span className="rounded bg-muted px-1 py-px text-[9px] uppercase tracking-wider text-muted-foreground">
                      {e.method}
                    </span>
                  </div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {e.path}
                  </div>
                  {e.detail && (
                    <div className="truncate text-[10px] text-muted-foreground">
                      {e.detail}
                    </div>
                  )}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {e.status === "checking" ? "…" : `${e.latencyMs}ms`}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How the multi-sig flow works</CardTitle>
          <CardDescription>Phase 22 — addresses audit-checklist M1+M2</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 text-sm sm:grid-cols-3">
            <FlowStep
              n={1}
              title="Init"
              body="POST /v1/aigarthpool/governance/init with the initial signer set and threshold. One-time, deploy-time operation. The treasury wallet defaults to the first signer."
            />
            <FlowStep
              n={2}
              title="Submit + approve"
              body="A current signer submits a change (treasury transfer or signer rotation) with a caller-chosen nonce. Other signers approve. The op is queued until threshold is met."
            />
            <FlowStep
              n={3}
              title="Execute"
              body="Once threshold approvals are met, anyone can call execute. The change applies. Pending ops expire after 4 epochs (PENDING_OP_TTL_EPOCHS)."
            />
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/services"
              className="inline-flex items-center gap-1 rounded-md border bg-primary/10 px-2.5 py-1 font-medium text-primary hover:bg-primary/20"
            >
              All services
              <ExternalLink className="h-3 w-3" />
            </Link>
            <span className="text-muted-foreground">→</span>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2.5 py-1 font-medium hover:bg-muted"
            >
              <KeyRound className="h-3 w-3" />
              Auth docs
            </Link>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

function PageHeader({
  refreshing,
  onRefresh,
  lastCheckedAt,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  lastCheckedAt?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">AigarthPool Governance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Multi-sig signer set, threshold, and pending ops for the on-chain
          treasury. Powers M1+M2 from the audit checklist.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {lastCheckedAt && (
          <span className="text-xs text-muted-foreground">
            updated {new Date(lastCheckedAt).toLocaleTimeString()}
          </span>
        )}
        <Button
          onClick={onRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>
    </div>
  );
}

function PauseBanner({ state }: { state: GovernanceState | null }) {
  if (!state?.paused) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/[0.06] p-3"
    >
      <PauseCircle className="mt-0.5 h-4 w-4 text-red-500" />
      <div className="flex-1 text-xs">
        <div className="font-medium text-red-600 dark:text-red-400">
          Pool paused (M4 circuit breaker)
        </div>
        <p className="mt-0.5 text-muted-foreground">
          All mutation procedures — <code className="rounded bg-muted px-1 py-0.5">stakeForAnn</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">extendLock</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">unlock</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">claimRewards</code>, and{" "}
          <code className="rounded bg-muted px-1 py-0.5">setAnnSplits</code> — reject with{" "}
          <code className="rounded bg-muted px-1 py-0.5">PAUSED</code>. Read-only queries and the
          watcher subscription continue to mirror state. A current governance signer can resume the
          pool via the wallet UI.
        </p>
      </div>
    </div>
  );
}

function VerifierBanner({ state }: { state: GovernanceState | null }) {
  if (!state?.initialized) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500" />
        <div className="flex-1 text-xs">
          <div className="font-medium">Governance not initialized</div>
          <p className="mt-0.5 text-muted-foreground">
            POST <code className="rounded bg-muted px-1 py-0.5">/v1/aigarthpool/governance/init</code> with
            the initial signer set and threshold. Until then, the only way to
            set ANN splits is via the ANN's creator wallet.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
      <div className="flex-1 text-xs">
        <div className="font-medium">
          Multi-sig governance active · {state.threshold}-of-{state.signers.length}
        </div>
        <p className="mt-0.5 text-muted-foreground">
          {state.threshold} of {state.signers.length} signers must approve any
          treasury transfer or signer change. Pending ops expire after 4
          epochs if they don't reach threshold.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  accent: "primary" | "amber" | "emerald" | "blue";
}) {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  }[accent];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-medium tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function SignerListCard({ state }: { state: GovernanceState | null }) {
  const signers = state?.signers ?? [];
  const threshold = state?.threshold ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signer set</CardTitle>
        <CardDescription>
          {signers.length > 0
            ? `${signers.length} signers · ${threshold} required for approval`
            : "No signers yet"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {signers.length === 0 ? (
          <div className="rounded-md border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            Init governance to populate the signer set.
          </div>
        ) : (
          <ul className="space-y-2">
            {signers.map((s, i) => (
              <li
                key={`${s}-${i}`}
                className="flex items-center gap-3 rounded-md border bg-muted/20 px-2.5 py-2 text-xs"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs">{s}</div>
                </div>
                <CopyButton value={s} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TreasuryCard({ state }: { state: GovernanceState | null }) {
  const pending = state?.pending_treasury_transfer;
  const treasury = state?.treasury_wallet;
  const threshold = state?.threshold ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Treasury wallet</CardTitle>
        <CardDescription>
          Receives the treasury_bps share of every unlock
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/20 p-2.5 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
          <div className="mt-1 flex items-center gap-2 font-mono">
            <WalletIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{treasury ?? "—"}</span>
            {treasury && <CopyButton value={treasury} />}
          </div>
        </div>
        {!pending ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            No pending treasury transfer.
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.04] p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Pending transfer
            </div>
            <div className="mt-2 space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-muted-foreground">to:</span>{" "}
                <span className="truncate">{pending.to}</span>
              </div>
              <div>
                <span className="text-muted-foreground">nonce:</span> {pending.nonce}
              </div>
              <div>
                <span className="text-muted-foreground">submitted @ epoch:</span> {pending.submitted_at_epoch}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="font-mono text-[11px]">
                {pending.approval_count} / {threshold} approvals
              </span>
              <ApprovalPill count={pending.approval_count} threshold={threshold} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SignerChangeCard({ state }: { state: GovernanceState | null }) {
  const pending = state?.pending_signer_change;
  const threshold = state?.threshold ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending signer change</CardTitle>
        <CardDescription>
          Add / remove signers, optionally update the threshold
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!pending ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            No pending signer change. Submit one via
            <code className="ml-1 rounded bg-muted px-1 py-0.5">/v1/aigarthpool/governance/signer-change</code>.
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.04] p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Change queued (nonce {pending.nonce})
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add</div>
                {pending.to_add.length === 0 ? (
                  <div className="text-muted-foreground">—</div>
                ) : (
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {pending.to_add.map((s, i) => (
                      <li key={`${s}-${i}`} className="truncate">{s}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remove</div>
                {pending.to_remove.length === 0 ? (
                  <div className="text-muted-foreground">—</div>
                ) : (
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {pending.to_remove.map((s, i) => (
                      <li key={`${s}-${i}`} className="truncate">{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
              <div className="font-mono">
                <span className="text-muted-foreground">new threshold:</span>{" "}
                {pending.new_threshold ?? "unchanged"}
              </div>
              <div className="font-mono">
                <span className="text-muted-foreground">submitted @ epoch:</span>{" "}
                {pending.submitted_at_epoch}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="font-mono text-[11px]">
                {pending.approval_count} / {threshold} approvals
              </span>
              <ApprovalPill count={pending.approval_count} threshold={threshold} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalPill({ count, threshold }: { count: number; threshold: number }) {
  const ready = count >= threshold;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-px font-mono text-[10px] ${
        ready
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          : "border border-amber-500/30 bg-amber-500/10 text-amber-600"
      }`}
    >
      {ready ? "Ready to execute" : "Awaiting approvals"}
    </span>
  );
}

function HealthIcon({ status }: { status: EndpointHealth["status"] }) {
  if (status === "up") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === "down") return <XCircle className="h-4 w-4 shrink-0 text-red-500" />;
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex h-6 items-center gap-1 rounded border bg-muted/40 px-1.5 text-[10px] text-muted-foreground hover:bg-muted"
      aria-label="Copy"
    >
      {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "copied" : "copy"}
    </button>
  );
}

function FlowStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">
          {n}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}

// Suppress unused-import warning for Circle (kept for future
// expansion; the signer-status indicator may grow).
void Circle;
