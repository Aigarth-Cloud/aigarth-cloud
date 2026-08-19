"use client";

import * as React from "react";
import Link from "next/link";
import {
  Server,
  Cpu,
  Globe,
  Key,
  Wallet,
  Activity,
  Database,
  Cloud,
  Mail,
  Box,
  ShoppingCart,
  Layers,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Container,
  Shield,
} from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

/**
 * Static manifest of every component in the local stack. Source of
 * truth for the dashboard. The health endpoint probes each port
 * (HTTP for services with /healthz, TCP for raw infra).
 */

type Kind = "app" | "service" | "infra";

type ServiceDef = {
  name: string;
  port: number;
  url: string;
  purpose: string;
  kind: Kind;
  icon: React.ComponentType<{ className?: string }>;
  /** Category within the kind. */
  group: string;
  /** Optional docs link. */
  docs?: string;
};

const APPS: ServiceDef[] = [
  {
    name: "Public site (apps/web)",
    port: 3003,
    url: "http://localhost:3003",
    purpose: "Customer-facing marketing site and dashboard. Next.js 14 App Router. 45 marketing pages + 10 wired dashboard pages + chat playground. Phase 9.",
    kind: "app",
    group: "Apps",
    icon: Globe,
    docs: "/docs",
  },
  {
    name: "Tracker (apps/dashboard)",
    port: 4000,
    url: "http://localhost:4000",
    purpose: "Internal project tracker. Phases, kanban, deliveries, docs, activity, services health. SQLite via better-sqlite3.",
    kind: "app",
    group: "Apps",
    icon: Layers,
  },
];

const SERVICES: ServiceDef[] = [
  {
    name: "Identity",
    port: 7001,
    url: "http://localhost:7001",
    purpose: "Users, orgs, MFA, API keys. JWT issue + verify. /v1/auth, /v1/me, /v1/orgs, /v1/api-keys, /v1/mfa. Phase 1.",
    kind: "service",
    group: "Core services",
    icon: Key,
  },
  {
    name: "Qubic",
    port: 7002,
    url: "http://localhost:7002",
    purpose: "Qubic integration. Wallet linking, multi-sig treasury, staking flow, validator onboarding, network status. Phase 3.",
    kind: "service",
    group: "Core services",
    icon: Wallet,
  },
  {
    name: "Wallet Auth (Qubic)",
    port: 7001,
    url: "http://localhost:7001/v1/auth/wallet/stats",
    purpose: "Wallet-as-identity sign-in / sign-up. POST /v1/auth/wallet/{start,finish}. Provision a user from a signed nonce — no email, no password. Linked to the Qubic service. lp-qubic CTA.",
    kind: "service",
    group: "Core services",
    icon: Shield,
  },
  {
    name: "Compute",
    port: 7003,
    url: "http://localhost:7003",
    purpose: "Aigarth Core. Regions, clusters, jobs, reservations, capacity credit. Brokers work onto Qubic computors. Phase 2.",
    kind: "service",
    group: "Core services",
    icon: Cpu,
  },
  {
    name: "Gateway",
    port: 7004,
    url: "http://localhost:7004",
    purpose: "OpenAI-compatible AI gateway. /v1/chat/completions (sync + SSE), /v1/embeddings, /v1/images, /v1/models, /v1/keys, /v1/usage. Stub backends. Phase 7.",
    kind: "service",
    group: "Edge services",
    icon: Server,
  },
  {
    name: "Billing",
    port: 7005,
    url: "http://localhost:7005",
    purpose: "Plans, subscriptions, invoices, payments, credits, coupons. Stripe-style credit model — credits only consumed at pay time. Phase 4.",
    kind: "service",
    group: "Edge services",
    icon: Activity,
  },
  {
    name: "ANN",
    port: 7006,
    url: "http://localhost:7006",
    purpose: "ANN registry. 16 categories, 4 license kinds, versioning, deploy (forwards to compute), analytics, reviews, fuzzy search. Phase 5 + 5+.",
    kind: "service",
    group: "Edge services",
    icon: Box,
  },
  {
    name: "Marketplace",
    port: 7007,
    url: "http://localhost:7007",
    purpose: "Compute marketplace. Listings (spot/reserved/futures), offers, auctions (Dutch/English/sealed-bid), reviews, 2.5% platform fee. Phase 6.",
    kind: "service",
    group: "Edge services",
    icon: ShoppingCart,
  },
  {
    name: "Tissue",
    port: 7008,
    url: "http://localhost:7008",
    purpose: "Trinary decision composition. Combines ANNs into tissue policies with weighted consensus. /v1/tissues, /v1/decisions. Phase 18.",
    kind: "service",
    group: "Intelligence",
    icon: Layers,
  },
  {
    name: "Dataset",
    port: 7009,
    url: "http://localhost:7009",
    purpose: "First-class datasets. Multipart upload, SHA-256 content hash, schema sniff (CSV/TSV/JSON/JSONL/Parquet), public catalog, connectors. Phase 19B.",
    kind: "service",
    group: "Intelligence",
    icon: Database,
  },
  {
    name: "Economy",
    port: 7010,
    url: "http://localhost:7010",
    purpose: "Staking splits, payouts, revenue distribution. Qearn-aware mirror. Routes worker payouts to creator + user + treasury. Phase 18.",
    kind: "service",
    group: "Economy",
    icon: Activity,
  },
  {
    name: "Training",
    port: 7011,
    url: "http://localhost:7011",
    purpose: "Training orchestration. Recipe catalog (5 built-ins), job queue, compute bridge, SSE progress, auto-publish new ANN versions. Phase 19C.",
    kind: "service",
    group: "Intelligence",
    icon: Cpu,
  },
];

const INFRA: ServiceDef[] = [
  {
    name: "PostgreSQL 16",
    port: 5432,
    url: "tcp://localhost:5432",
    purpose: "Primary database for all 7 services. Postgres:16-alpine, persisted to .pgdata.",
    kind: "infra",
    group: "Data",
    icon: Database,
  },
  {
    name: "Redis 7",
    port: 6379,
    url: "tcp://localhost:6379",
    purpose: "Sessions, rate limits, job queues. Append-only persistence to .redisdata.",
    kind: "infra",
    group: "Data",
    icon: Database,
  },
  {
    name: "NATS 2.10",
    port: 4222,
    url: "http://localhost:8222",
    purpose: "Event bus + Qubic event ingestion. JetStream enabled. Monitoring on 8222.",
    kind: "infra",
    group: "Messaging",
    icon: Cloud,
  },
  {
    name: "MinIO",
    port: 9000,
    url: "http://localhost:9000",
    purpose: "S3-compatible object storage. Bucket: aigarth. Console on 9001.",
    kind: "infra",
    group: "Storage",
    icon: Container,
  },
  {
    name: "MailHog (SMTP)",
    port: 1025,
    url: "tcp://localhost:1025",
    purpose: "Dev SMTP catcher for transactional email. Web UI on 8025.",
    kind: "infra",
    group: "Messaging",
    icon: Mail,
  },
];

const ALL = [...APPS, ...SERVICES, ...INFRA];

type HealthRow = {
  name: string;
  ok: boolean;
  status: number;
  latencyMs: number;
  detail?: string;
  body?: unknown;
};

type HealthResponse = {
  checked_at: string;
  up: number;
  down: number;
  services: HealthRow[];
};

const KIND_LABEL: Record<Kind, string> = {
  app: "App",
  service: "Service",
  infra: "Infra",
};

const KIND_STYLE: Record<Kind, string> = {
  app: "bg-garden-500/10 text-garden-700 dark:text-garden-300 border-garden-500/30",
  service: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  infra: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

function groupBy<T extends { group: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, []);
    map.get(item.group)!.push(item);
  }
  return Array.from(map.entries());
}

export function ServicesView() {
  const [data, setData] = React.useState<HealthResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastCheckedAt, setLastCheckedAt] = React.useState<string | null>(null);

  const fetch_ = React.useCallback(async (manual: boolean) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/services/health", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as HealthResponse;
        setData(json);
        setLastCheckedAt(json.checked_at);
      }
    } catch (err) {
      console.error("health check failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetch_(false);
    const interval = setInterval(() => fetch_(false), 10_000);
    return () => clearInterval(interval);
  }, [fetch_]);

  const healthByName = new Map<string, HealthRow>();
  for (const row of data?.services ?? []) {
    healthByName.set(row.name, row);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every running component in the local stack — apps, services, and
            infrastructure. Health-checked every 10s via{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /api/services/health
            </code>{" "}
            (server-side, parallel ping to {data?.services.length ?? ALL.length} targets).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <div className="flex items-center gap-3 rounded-md border bg-card/50 px-3 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 text-mint-600 dark:text-mint-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {data.up} up
              </span>
              {data.down > 0 && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <XCircle className="h-3.5 w-3.5" />
                  {data.down} down
                </span>
              )}
              <span className="text-muted-foreground">
                · {lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString() : "—"}
              </span>
            </div>
          )}
          <button
            onClick={() => fetch_(true)}
            disabled={refreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs hover:bg-accent disabled:opacity-50"
            aria-label="Refresh health"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          <p className="mt-3">Probing {ALL.length} endpoints…</p>
        </div>
      )}

      {data &&
        groupBy(ALL).map(([group, items]) => (
          <section key={group}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => {
                const health = healthByName.get(s.name);
                const isUp = health?.ok;
                const isUnknown = !health;
                const Icon = s.icon;
                return (
                  <Card
                    key={s.name}
                    className={cn(
                      "transition-all",
                      isUp === true && "border-mint-500/40 bg-mint-500/[0.02]",
                      isUp === false && "border-red-500/40 bg-red-500/[0.03]",
                    )}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isUnknown ? (
                            <Badge variant="secondary">probing…</Badge>
                          ) : isUp ? (
                            <Badge variant="success" className="gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
                              up
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              down
                            </Badge>
                          )}
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                              KIND_STYLE[s.kind],
                            )}
                          >
                            {KIND_LABEL[s.kind]}
                          </span>
                        </div>
                      </div>
                      <CardTitle className="mt-4 text-base">{s.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {s.purpose}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Port</span>
                          <span className="font-mono">{s.port}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">URL</span>
                          <a
                            href={s.url.replace(/^tcp:\/\//, "http://localhost:")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-mono text-primary hover:underline"
                          >
                            {s.url.replace(/^tcp:\/\//, "").replace(/^https?:\/\//, "")}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {health && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Latency</span>
                              <span className="font-mono">
                                {health.latencyMs}ms
                              </span>
                            </div>
                            {health.status > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <span
                                  className={cn(
                                    "font-mono",
                                    isUp ? "text-mint-600 dark:text-mint-400" : "text-red-500",
                                  )}
                                >
                                  {health.status}
                                </span>
                              </div>
                            )}
                            {health.detail && !isUp && (
                              <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-600 dark:text-red-400">
                                {health.detail}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">Bring up the local stack</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          From the repo root:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border bg-background p-3 text-xs">
{`pnpm stack:up      # start postgres + redis + nats + minio + mailhog
pnpm stack:down    # stop
pnpm stack:logs    # follow logs
pnpm stack:ps      # show running containers

# Then run the services + apps:
pnpm dev            # turbo: starts all 7 services + apps/web + apps/dashboard`}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          See <code className="rounded bg-muted px-1 py-0.5 text-xs">infrastructure/docker-compose.yml</code> for
          the full port map and image tags.
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Probing every 10s · {data?.services.length ?? ALL.length} targets · server-side parallel ping
        </span>
        {data && (
          <Link href="/api/services/health" className="hover:text-foreground">
            raw JSON ↗
          </Link>
        )}
      </div>
    </div>
  );
}
