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
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet as WalletIcon,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Button } from "@aigarth/ui";

/**
 * Command centre page for the wallet-as-identity auth flow.
 *
 * Polls the identity service's /v1/auth/wallet/stats endpoint and shows:
 *   - Headline KPIs: linked wallets, unique users, 30-day sessions, 24h sign-ins
 *   - Verifier status: real K12 verifier (since the lib/qubic.ts refactor)
 *   - By-kind breakdown: how many of the 30-day logins came from each
 *     proof path (message = vault / window.qubic / dev stub,
 *     transaction = MetaMask Qubic snap)
 *   - Snap active banner: 30-day rolling indicator for MetaMask snap usage
 *   - Recent sign-ins feed (address + timestamp)
 *   - Transaction audit feed: the last 10 wallet-auth events with their
 *     proof kind, label, and IP hash (so the dashboard can show
 *     "MetaMask snap sign-in from <ip-hash>")
 *   - Endpoint health matrix (start, finish, stats)
 *   - Linkage to lp-qubic / docs
 *
 * Updates every 10s. Server-side, the route is public-read so we can poll
 * without auth. The /api/wallet-auth/stats proxy route in apps/dashboard
 * forwards to the identity service so we never expose it to the browser.
 */

type AuditKind = "message" | "transaction" | "unknown";

type Stats = {
  total_linked: number;
  total_unique_users: number;
  total_sessions_30d: number;
  recent_signins: { address: string; created_at: string; user_id: string }[];
  last_24h_signins: number;
  stub_unverified_count: number;
  recent_audit: {
    actor_user_id: string | null;
    action: string;
    kind: AuditKind;
    address: string | null;
    label: string | null;
    created_at: string;
    ip_hash: string | null;
    user_agent: string | null;
  }[];
  by_kind: {
    message: number;
    transaction: number;
    unknown: number;
  };
  snap_active_30d: boolean;
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

const ENDPOINTS: { name: string; method: EndpointHealth["method"]; path: string; check: (h: EndpointHealth) => Promise<EndpointHealth> }[] = [
  {
    name: "wallet.start",
    method: "POST",
    path: "/v1/auth/wallet/start",
    check: async (h) => {
      const start = performance.now();
      try {
        const res = await fetch("/api/wallet-auth/proxy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        const latencyMs = Math.round(performance.now() - start);
        if (res.status === 400 || res.status === 502) {
          return { ...h, status: "up", latencyMs, detail: "reachable (validation expected)" };
        }
        if (res.ok) return { ...h, status: "up", latencyMs };
        return { ...h, status: "down", latencyMs, detail: `HTTP ${res.status}` };
      } catch (e) {
        return { ...h, status: "down", latencyMs: 0, detail: (e as Error).message };
      }
    },
  },
  {
    name: "wallet.finish",
    method: "POST",
    path: "/v1/auth/wallet/finish",
    check: async (h) => {
      const start = performance.now();
      try {
        const res = await fetch("/api/wallet-auth/proxy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "finish" }),
        });
        const latencyMs = Math.round(performance.now() - start);
        if (res.status === 400 || res.status === 401 || res.status === 502) {
          return { ...h, status: "up", latencyMs, detail: "reachable (validation expected)" };
        }
        if (res.ok) return { ...h, status: "up", latencyMs };
        return { ...h, status: "down", latencyMs, detail: `HTTP ${res.status}` };
      } catch (e) {
        return { ...h, status: "down", latencyMs: 0, detail: (e as Error).message };
      }
    },
  },
  {
    name: "wallet.stats",
    method: "GET",
    path: "/v1/auth/wallet/stats",
    check: async (h) => {
      const start = performance.now();
      try {
        const res = await fetch("/api/wallet-auth/stats");
        const latencyMs = Math.round(performance.now() - start);
        if (!res.ok) {
          return { ...h, status: "down", latencyMs, detail: `HTTP ${res.status}` };
        }
        return { ...h, status: "up", latencyMs };
      } catch (e) {
        return { ...h, status: "down", latencyMs: 0, detail: (e as Error).message };
      }
    },
  },
];

export function WalletAuthView() {
  const [stats, setStats] = React.useState<Stats | null>(null);
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
      const [statsRes, ...endpointResults] = await Promise.all([
        fetch("/api/wallet-auth/stats", { cache: "no-store" }),
        ...ENDPOINTS.map((e) =>
          e.check({
            name: e.name,
            method: e.method,
            path: e.path,
            status: "checking",
            latencyMs: 0,
          }),
        ),
      ]);
      if (statsRes.ok) {
        setStats((await statsRes.json()) as Stats);
        setError(null);
      } else {
        setError(`Stats endpoint returned ${statsRes.status}`);
      }
      setEndpoints(endpointResults);
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
        lastCheckedAt={stats?.checked_at}
      />

      <VerifierBanner stats={stats} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Linked wallets"
          value={stats?.total_linked ?? 0}
          icon={WalletIcon}
          hint="Active (not revoked)"
          accent="primary"
        />
        <StatCard
          label="Unique users"
          value={stats?.total_unique_users ?? 0}
          icon={Users}
          hint="One per Qubic address"
          accent="emerald"
        />
        <StatCard
          label="Sessions (30d)"
          value={stats?.total_sessions_30d ?? 0}
          icon={TrendingUp}
          hint="Wallet-auth logins"
          accent="amber"
        />
        <StatCard
          label="Sign-ins (24h)"
          value={stats?.last_24h_signins ?? 0}
          icon={Clock}
          hint={
            stats && stats.stub_unverified_count > 0
              ? `${stats.stub_unverified_count} stub-unverified`
              : "Real K12 verifier"
          }
          accent="blue"
        />
      </div>

      {/* Phase 21: by-kind breakdown + snap activity indicator */}
      <ByKindBreakdown stats={stats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent sign-ins</CardTitle>
                <CardDescription>Last 10 wallet-auth sessions</CardDescription>
              </div>
              <Link
                href="/services"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                All services →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {!error && (!stats || stats.recent_signins.length === 0) && (
              <div className="rounded-md border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                No wallet-auth sign-ins yet. Try it from{" "}
                <Link href="/lp-qubic" className="text-primary hover:underline">
                  /lp-qubic
                </Link>{" "}
                (open the page in a new tab — paste any 60-char uppercase address).
              </div>
            )}
            {stats && stats.recent_signins.length > 0 && (
              <ul className="divide-y">
                {stats.recent_signins.map((s, i) => (
                  <li key={`${s.user_id}-${i}`} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <WalletIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs">{s.address}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <CopyButton value={s.address} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endpoint health</CardTitle>
            <CardDescription>Live ping to identity service</CardDescription>
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
      </div>

      {/* Phase 21: transaction audit feed (last 10 wallet-auth events) */}
      <TransactionAuditFeed stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>How the flow works</CardTitle>
          <CardDescription>Wallet-as-identity on the identity service</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 text-sm sm:grid-cols-3">
            <FlowStep
              n={1}
              title="Request nonce"
              body="Browser POSTs a 60-char Qubic address to /v1/auth/wallet/start. The server stores a one-shot nonce (5 min TTL) and returns the canonical message to sign."
            />
            <FlowStep
              n={2}
              title="Sign"
              body="Pick a path: window.qubic, MetaMask Qubic snap (Option B — self-transfer with the challenge in input), in-browser vault, or paste-address dev stub. The server accepts kind:'message' or kind:'transaction'."
            />
            <FlowStep
              n={3}
              title="Verify + provision"
              body="/v1/auth/wallet/finish verifies the proof (K12 + SchnorrQ_Verify, or the dev-stub shape check), finds or creates the user (deterministic email + personal org), issues a JWT session, and sets the aigarth_session cookie."
            />
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="http://localhost:3003/lp-qubic"
              className="inline-flex items-center gap-1 rounded-md border bg-primary/10 px-2.5 py-1 font-medium text-primary hover:bg-primary/20"
            >
              Open lp-qubic
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
        <h1 className="text-2xl font-medium tracking-tight">Wallet Auth</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Command centre for the Qubic wallet-as-identity flow. Powers the{" "}
          <Link href="http://localhost:3003/lp-qubic" className="text-primary hover:underline">
            lp-qubic
          </Link>{" "}
          CTA. New endpoint as of today — live stats will fill in as wallets connect.
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

function VerifierBanner({ stats }: { stats: Stats | null }) {
  // Since Phase 19 we run the real K12 + SchnorrQ verifier. The
  // dev-stub path remains a fallback only — the banner says so.
  const isStub = (stats?.stub_unverified_count ?? 0) > 0;
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        isStub
          ? "border-amber-500/30 bg-amber-500/[0.04]"
          : "border-emerald-500/30 bg-emerald-500/[0.04]"
      }`}
    >
      {isStub ? (
        <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500" />
      ) : (
        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
      )}
      <div className="flex-1 text-xs">
        <div className="font-medium">
          {isStub ? "Some stub-unverified wallets" : "Real K12 verifier active"}
        </div>
        <p className="mt-0.5 text-muted-foreground">
          {isStub ? (
            <>
              K12 + SchnorrQ_Verify is the default path. {stats?.stub_unverified_count} linked
              wallet(s) were verified via the legacy 32-byte dev-stub shape check; they
              remain valid for backwards compatibility, but new sign-ins require a real
              signature (window.qubic / vault / MetaMask snap).
            </>
          ) : (
            <>
              K12 + SchnorrQ_Verify is the only path now. The 32-byte dev stub is no
              longer emitted by any client; it's only a historical marker.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function ByKindBreakdown({ stats }: { stats: Stats | null }) {
  const total = stats ? stats.by_kind.message + stats.by_kind.transaction + stats.by_kind.unknown : 0;
  const snapCount = stats?.by_kind.transaction ?? 0;
  const msgCount = stats?.by_kind.message ?? 0;
  const snapPct = total > 0 ? Math.round((snapCount / total) * 100) : 0;
  const msgPct = total > 0 ? Math.round((msgCount / total) * 100) : 0;
  const snapActive = stats?.snap_active_30d ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>30-day proof kinds</CardTitle>
            <CardDescription>How the user proved wallet ownership at sign-in</CardDescription>
          </div>
          {snapActive && (
            <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
              <Sparkles className="h-3 w-3" />
              MetaMask snap active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <KindTile
            label="kind: message"
            hint="window.qubic / vault / paste-address dev stub"
            count={msgCount}
            pct={msgPct}
            color="bg-primary"
            total={total}
          />
          <KindTile
            label="kind: transaction"
            hint="MetaMask Qubic snap (Option B — self-transfer w/ challenge in input)"
            count={snapCount}
            pct={snapPct}
            color="bg-amber-500"
            total={total}
          />
        </div>
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {total > 0 && (
            <>
              <div
                className="bg-primary transition-all"
                style={{ width: `${msgPct}%` }}
                title={`message: ${msgCount}`}
              />
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${snapPct}%` }}
                title={`transaction: ${snapCount}`}
              />
            </>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          message = direct 64-byte SchnorrQ over the canonical challenge. transaction = the
          snap's <code className="rounded bg-muted px-1 py-0.5">signTransaction</code>{" "}
          RPC wrapped around a self-transfer with{" "}
          <code className="rounded bg-muted px-1 py-0.5">inputType 0x4147</code> ("AG");
          the server unwraps and verifies against the embedded challenge. The{" "}
          <code className="rounded bg-muted px-1 py-0.5">unknown</code> bucket is for
          audit rows whose metadata doesn't carry a kind (should be 0 after Phase 21).
        </p>
      </CardContent>
    </Card>
  );
}

function KindTile({
  label,
  hint,
  count,
  pct,
  color,
  total,
}: {
  label: string;
  hint: string;
  count: number;
  pct: number;
  color: string;
  total: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold">{label}</span>
        <span className="font-mono text-2xl font-medium tracking-tight">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="font-mono">{pct}%</span>
        <span>of {total.toLocaleString()} 30d logins</span>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function TransactionAuditFeed({ stats }: { stats: Stats | null }) {
  const feed = stats?.recent_audit ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transaction audit feed</CardTitle>
            <CardDescription>
              Last 10 wallet-auth events with proof kind, label, and IP hash
            </CardDescription>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Phase 21
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {feed.length === 0 && (
          <div className="rounded-md border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No wallet-auth events yet. Sign in via the snap (MetaMask Flask), the
            in-browser vault, or paste an address to populate the feed.
          </div>
        )}
        {feed.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Kind</th>
                  <th className="py-2 pr-3 font-medium">Address</th>
                  <th className="py-2 pr-3 font-medium">Label</th>
                  <th className="py-2 pr-3 font-medium">IP hash</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((row, i) => (
                  <tr
                    key={`${row.actor_user_id ?? "?"}-${i}`}
                    className="border-b last:border-b-0"
                  >
                    <td className="py-2 pr-3 text-[10px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">
                      <KindBadge kind={row.kind} />
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-mono text-[11px]">
                        {row.address
                          ? `${row.address.slice(0, 8)}…${row.address.slice(-4)}`
                          : "(no address)"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[11px] text-muted-foreground">
                      {row.label ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[10px] text-muted-foreground">
                      {row.ip_hash ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-[10px] text-muted-foreground">
                      {row.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KindBadge({ kind }: { kind: AuditKind }) {
  if (kind === "transaction") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-px font-mono text-[10px] text-amber-600 dark:text-amber-400">
        <Sparkles className="h-2.5 w-2.5" />
        transaction
      </span>
    );
  }
  if (kind === "message") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[10px] text-primary">
        message
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
      unknown
    </span>
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
  value: number;
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
        <div className="mt-3 text-2xl font-medium tracking-tight">
          {value.toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
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
      aria-label="Copy address"
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
