/**
 * Aigarth Cloud — service topology (the ReactFlow architecture map).
 *
 * Static, hand-curated manifest of every node in the system and the
 * edges that connect them. Edges reflect real call paths observed in
 * source (compose depends_on, AIGARTH_*_URL envs, x402/qubic/ann route
 * wiring, gateway forwarders, training→compute bridge, etc.).
 *
 * Phase grouping is editorial, not from the codebase. If a service
 * gets re-tiered (e.g. economy merges into billing), update here.
 *
 * Health (status / latency) is added at render time by mapping
 * /api/services/health results onto these nodes via the `healthKey`
 * field. The `kind` field drives node colour and modal icon.
 */

import type { LucideIcon } from "lucide-react";
import {
  Box,
  Cloud,
  Container,
  Cpu,
  Database,
  Globe,
  Key,
  Layers,
  Mail,
  Server,
  ShoppingCart,
  Shield,
  Wallet,
  Activity,
  Zap,
} from "lucide-react";

export type Kind = "app" | "edge" | "core" | "intel" | "economy" | "infra";

export type NodeDef = {
  /** Stable id. Matches the key used by /api/services/health. */
  id: string;
  /** Display name. */
  name: string;
  /** Tier — drives column position + colour. */
  kind: Kind;
  /** Container / process icon. */
  icon: LucideIcon;
  /** Tier label shown above the column. */
  tier: string;
  /** One-line description. Shown in modal + hover tooltip. */
  short: string;
  /** 2-3 sentence explanation. Shown in modal body. */
  long: string;
  /** Container port (services only). 0 if not applicable. */
  port: number;
  /** Public hostname (only for the gateway). Empty otherwise. */
  publicHost?: string;
  /** Phase that introduced this service. */
  phase: string;
  /** Brief metrics titles for the modal (each metric renders value below). */
  metrics: { label: string; get: (h: HealthSnapshot | undefined) => string }[];
  /** Brief endpoints the modal links to. */
  links: { label: string; href: string; external?: boolean }[];
  /** Position hint for ReactFlow. Computed in topology-layout.ts. */
  position?: { x: number; y: number };
};

export type EdgeDef = {
  id: string;
  source: string;
  target: string;
  /** What kind of relationship. Drives edge colour. */
  rel: "https" | "internal" | "tcp" | "auth" | "event";
  /** Optional short label. */
  label?: string;
};

export type HealthSnapshot = {
  name: string;
  ok: boolean;
  status: number;
  latencyMs: number;
  detail?: string;
};

/* ─────────────────────────────────────────────────────────────────────────
 *  Node definitions
 * ───────────────────────────────────────────────────────────────────────── */

const INTRO = (phase: string, name: string) =>
  `Introduced in ${phase}. `;

export const NODES: NodeDef[] = [
  // ── Apps ──
  {
    id: "apps/web",
    name: "Public site",
    kind: "app",
    icon: Globe,
    tier: "Apps",
    short: "Customer-facing marketing site + chat playground.",
    long:
      "Next.js 14 App Router. Marketing pages, blog, docs index, customer dashboard, chat playground. " +
      "Handles signup/login, AI playground calls (via the gateway), and Stripe-style checkout (via billing).",
    port: 3003,
    publicHost: "aigarth.cloud",
    phase: "9",
    metrics: [
      { label: "Port", get: () => "3003" },
      { label: "Container", get: () => "aigarth-web" },
      { label: "Phase", get: () => "9" },
    ],
    links: [
      { label: "Open site", href: "https://aigarth.cloud", external: true },
    ],
  },
  {
    id: "apps/dashboard",
    name: "Project tracker",
    kind: "app",
    icon: Layers,
    tier: "Apps",
    short: "Internal command surface — phases, kanban, deliveries, activity.",
    long:
      "Next.js 14 App Router. SQLite-backed via better-sqlite3. Hosts this topology page, /services health grid, " +
      "/phases tracker, /kanban, /deliveries, /docs, /activity. Lives at command.aigarth.cloud.",
    port: 4000,
    publicHost: "command.aigarth.cloud",
    phase: "0",
    metrics: [
      { label: "Port", get: () => "4000" },
      { label: "Container", get: () => "aigarth-dashboard" },
      { label: "Phase", get: () => "0" },
    ],
    links: [
      { label: "Open tracker", href: "https://command.aigarth.cloud", external: true },
    ],
  },

  // ── Edge ──
  {
    id: "identity",
    name: "Identity",
    kind: "edge",
    icon: Key,
    tier: "Edge",
    short: "Users, orgs, MFA, API keys, JWT issue + verify.",
    long:
      INTRO("1", "Identity") +
      "Phase 1 service. /v1/auth (login, signup, refresh), /v1/me, /v1/orgs, " +
      "/v1/api-keys, /v1/mfa. Also hosts the wallet-auth sign-in/start/finish flow on the same process.",
    port: 7001,
    phase: "1",
    metrics: [
      { label: "Port", get: () => "7001" },
      { label: "Routes", get: () => "/v1/auth, /v1/me, /v1/orgs, /v1/mfa" },
      { label: "Phase", get: () => "1" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=identity", external: false },
    ],
  },
  {
    id: "identity-wallet-auth",
    name: "Wallet Auth",
    kind: "edge",
    icon: Shield,
    tier: "Edge",
    short: "Wallet-as-identity sign-in (no email, no password).",
    long:
      "Lives inside the Identity process. POST /v1/auth/wallet/start and /v1/auth/wallet/finish. " +
      "Provisions a user from a signed nonce — linked to the Qubic service for the on-chain proof.",
    port: 7001,
    phase: "21",
    metrics: [
      { label: "Port", get: () => "7001" },
      { label: "Mount", get: () => "in-process on identity" },
      { label: "Phase", get: () => "21" },
    ],
    links: [
      { label: "stats", href: "/v1/auth/wallet/stats", external: false },
    ],
  },
  {
    id: "gateway",
    name: "Gateway",
    kind: "edge",
    icon: Server,
    tier: "Edge",
    short: "OpenAI-compatible AI gateway. /v1/chat, /v1/embeddings, /v1/images.",
    long:
      INTRO("7", "Gateway") +
      "Public API surface. Hosts the AI gateway at /v1/* (chat completions sync + SSE, embeddings, images, models). " +
      "Verifies JWTs with Identity, forwards inference to Compute (Phase 19A), records usage with Billing.",
    port: 7004,
    publicHost: "api.aigarth.cloud",
    phase: "7",
    metrics: [
      { label: "Port", get: () => "7004" },
      { label: "Public", get: () => "api.aigarth.cloud" },
      { label: "Phase", get: () => "7" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=gateway", external: false },
      { label: "Open API", href: "https://api.aigarth.cloud/v1/models", external: true },
    ],
  },

  // ── Core ──
  {
    id: "qubic",
    name: "Qubic",
    kind: "core",
    icon: Wallet,
    tier: "Core",
    short: "Qubic integration. Wallet linking, multi-sig treasury, staking.",
    long:
      INTRO("3", "Qubic") +
      "Bridges Aigarth Cloud to the Qubic L1: wallet linking, multi-sig treasury operations, " +
      "staking flow, validator onboarding, network status, /v1/verify for receipts. NATS subscribes to chain events.",
    port: 7002,
    phase: "3",
    metrics: [
      { label: "Port", get: () => "7002" },
      { label: "Phase", get: () => "3" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=qubic", external: false },
    ],
  },
  {
    id: "compute",
    name: "Compute",
    kind: "core",
    icon: Cpu,
    tier: "Core",
    short: "Aigarth Core. Regions, clusters, jobs, reservations, capacity credit.",
    long:
      INTRO("2", "Compute") +
      "Brokers work onto Qubic computors. /v1/regions, /v1/clusters, /v1/jobs, /v1/reservations, /v1/capacity. " +
      "This is where the gateway forwards inference and where Training reads capacity from.",
    port: 7003,
    phase: "2",
    metrics: [
      { label: "Port", get: () => "7003" },
      { label: "Phase", get: () => "2" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=compute", external: false },
    ],
  },
  {
    id: "billing",
    name: "Billing",
    kind: "core",
    icon: Activity,
    tier: "Core",
    short: "Plans, subscriptions, invoices, payments, credits, coupons.",
    long:
      INTRO("4", "Billing") +
      "Stripe-style credit model — credits only consumed at pay time. /v1/plans, /v1/subscriptions, " +
      "/v1/invoices, /v1/payments, /v1/credits, /v1/coupons. Hooked by Gateway (record usage) and Economy (settle revenue).",
    port: 7005,
    phase: "4",
    metrics: [
      { label: "Port", get: () => "7005" },
      { label: "Phase", get: () => "4" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=billing", external: false },
    ],
  },

  // ── Intelligence ──
  {
    id: "ann",
    name: "ANN",
    kind: "intel",
    icon: Box,
    tier: "Intelligence",
    short: "ANN registry. 16 categories, 4 license kinds, versioning, deploy.",
    long:
      INTRO("5+", "ANN") +
      "Stores the model registry. Versioning, deploy (forwards to compute), analytics, reviews, fuzzy search. " +
      "Tissue consumes ANNs to build policies. Training auto-publishes new ANN versions here on success.",
    port: 7006,
    phase: "5+",
    metrics: [
      { label: "Port", get: () => "7006" },
      { label: "Phase", get: () => "5+" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=ann", external: false },
    ],
  },
  {
    id: "marketplace",
    name: "Marketplace",
    kind: "intel",
    icon: ShoppingCart,
    tier: "Intelligence",
    short: "Compute marketplace. Listings, offers, auctions.",
    long:
      INTRO("6", "Marketplace") +
      "Listings (spot / reserved / futures), offers, auctions (Dutch / English / sealed-bid), reviews, 2.5% platform fee. " +
      "Buyers pay in QUBIC, settlements settle into Billing credits and Economy splits.",
    port: 7007,
    phase: "6",
    metrics: [
      { label: "Port", get: () => "7007" },
      { label: "Phase", get: () => "6" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=marketplace", external: false },
    ],
  },
  {
    id: "tissue",
    name: "Tissue",
    kind: "intel",
    icon: Layers,
    tier: "Intelligence",
    short: "Trinary decision composition. ANNs → tissue policies with weighted consensus.",
    long:
      INTRO("18", "Tissue") +
      "Combines ANNs into tissue policies with weighted consensus. /v1/tissues, /v1/decisions. " +
      "Layered on top of the ANN registry; this is where Phase 30 (x402-Qubic) sells and ships decisions.",
    port: 7008,
    phase: "18",
    metrics: [
      { label: "Port", get: () => "7008" },
      { label: "Phase", get: () => "18" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=tissue", external: false },
    ],
  },
  {
    id: "dataset",
    name: "Dataset",
    kind: "intel",
    icon: Database,
    tier: "Intelligence",
    short: "First-class datasets. Multipart upload, SHA-256 content hash, schema sniff.",
    long:
      INTRO("19B", "Dataset") +
      "Multipart upload, SHA-256 content hash, schema sniff (CSV/TSV/JSON/JSONL/Parquet), public catalog, connectors. " +
      "Files land in MinIO; Training reads them. Catalog is the public dataset on aigarth.cloud.",
    port: 7009,
    phase: "19B",
    metrics: [
      { label: "Port", get: () => "7009" },
      { label: "Phase", get: () => "19B" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=dataset", external: false },
    ],
  },
  {
    id: "training",
    name: "Training",
    kind: "intel",
    icon: Zap,
    tier: "Intelligence",
    short: "Training orchestrator. Recipe catalog, job queue, SSE progress, auto-publish.",
    long:
      INTRO("19C", "Training") +
      "Recipe catalog (5 built-ins), job queue, compute bridge, SSE progress, auto-publishes new ANN versions on success. " +
      "Auto-bridges to Compute (TRAINING_COMPUTE_MODE=stub|http) and ANN for version auto-publish.",
    port: 7011,
    phase: "19C",
    metrics: [
      { label: "Port", get: () => "7011" },
      { label: "Phase", get: () => "19C" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=training", external: false },
    ],
  },
  {
    id: "work",
    name: "Work",
    kind: "intel",
    icon: Cpu,
    tier: "Intelligence",
    short: "Work Runtime. Registry, replication verifier, billing hook.",
    long:
      INTRO("27", "Work") +
      "Algorithm registry (awork_1, evo_step), scheduler, replication verifier, worker heartbeat, billing hook. " +
      "Backbone of AIGARTH-EVO-01 + EVO-02: every training step and decision runs as a work unit here.",
    port: 7012,
    phase: "27",
    metrics: [
      { label: "Port", get: () => "7012" },
      { label: "Phase", get: () => "27" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=work", external: false },
    ],
  },

  // ── Economy ──
  {
    id: "economy",
    name: "Economy",
    kind: "economy",
    icon: Activity,
    tier: "Economy",
    short: "Staking splits, payouts, revenue distribution. Qearn-aware mirror.",
    long:
      INTRO("18", "Economy") +
      "Routes worker payouts to creator + user + treasury. Qearn-aware mirror of on-chain splits. " +
      "Settles with Billing (credits) and Qubic (chain proofs).",
    port: 7010,
    phase: "18",
    metrics: [
      { label: "Port", get: () => "7010" },
      { label: "Phase", get: () => "18" },
    ],
    links: [
      { label: "healthz", href: "/api/proxy/health?target=economy", external: false },
    ],
  },

  // ── Infra ──
  {
    id: "postgres",
    name: "Postgres 16",
    kind: "infra",
    icon: Database,
    tier: "Infra",
    short: "Primary database for all 12 services.",
    long:
      "Postgres 16-alpine. One database, one schema owner; every service has its own tables. " +
      "Migrations run via the aigarth/migrate image (one-shot). Persisted to aigarth-pgdata volume.",
    port: 5432,
    phase: "infra",
    metrics: [
      { label: "Port", get: () => "5432" },
      { label: "Image", get: () => "postgres:16-alpine" },
    ],
    links: [],
  },
  {
    id: "redis",
    name: "Redis 7",
    kind: "infra",
    icon: Database,
    tier: "Infra",
    short: "Sessions, rate limits, job queues.",
    long:
      "Redis 7-alpine, append-only persistence to aigarth-redisdata. Maxmemory 256mb, allkeys-lru. " +
      "Used by Identity (sessions), Gateway (rate limits + usage cache), Training + Work (job queues).",
    port: 6379,
    phase: "infra",
    metrics: [
      { label: "Port", get: () => "6379" },
      { label: "Image", get: () => "redis:7-alpine" },
    ],
    links: [],
  },
  {
    id: "nats",
    name: "NATS 2.10",
    kind: "infra",
    icon: Cloud,
    tier: "Infra",
    short: "Event bus + Qubic event ingestion.",
    long:
      "NATS 2.10-alpine, JetStream enabled, monitoring on 8222. Qubic publishes chain events here; " +
      "services subscribe to aigarth.* subjects for orchestration.",
    port: 4222,
    phase: "infra",
    metrics: [
      { label: "Port", get: () => "4222" },
      { label: "Image", get: () => "nats:2.10-alpine" },
      { label: "Monitor", get: () => "8222" },
    ],
    links: [],
  },
  {
    id: "minio",
    name: "MinIO",
    kind: "infra",
    icon: Container,
    tier: "Infra",
    short: "S3-compatible object storage. Buckets: aigarth, aigarth-uploads.",
    long:
      "S3-compatible object store. Dataset uploads land in aigarth-uploads; public catalogue in aigarth. " +
      "Console on 9001 in dev only (not exposed on production).",
    port: 9000,
    phase: "infra",
    metrics: [
      { label: "Port", get: () => "9000" },
      { label: "Image", get: () => "minio/minio:latest" },
    ],
    links: [],
  },
  {
    id: "mailhog",
    name: "MailHog",
    kind: "infra",
    icon: Mail,
    tier: "Infra",
    short: "Dev SMTP catcher. Not deployed on production.",
    long:
      "MailHog for transactional email capture during local dev. SMTP on 1025, web UI on 8025. " +
      "Local-only; production ships without it and uses a real SMTP relay instead.",
    port: 1025,
    phase: "dev",
    metrics: [
      { label: "SMTP", get: () => "1025" },
      { label: "Web UI", get: () => "8025" },
      { label: "Status", get: () => "local only" },
    ],
    links: [],
  },
];

/* ─────────────────────────────────────────────────────────────────────────
 *  Edge definitions — what calls what
 *  rel drives colour; label is rendered on the edge.
 * ───────────────────────────────────────────────────────────────────────── */

export const EDGES: EdgeDef[] = [
  // Public traffic
  { id: "browser-web", source: "apps/web", target: "gateway", rel: "https", label: "HTTPS" },
  { id: "browser-dash", source: "apps/dashboard", target: "identity", rel: "https", label: "auth" },
  { id: "dash-id", source: "apps/dashboard", target: "identity", rel: "internal", label: "JWT verify" },
  { id: "web-id", source: "apps/web", target: "identity", rel: "internal", label: "login" },
  { id: "web-gw", source: "apps/web", target: "gateway", rel: "internal", label: "chat/embed" },
  { id: "gw-id", source: "gateway", target: "identity", rel: "internal", label: "verify JWT" },
  { id: "gw-compute", source: "gateway", target: "compute", rel: "internal", label: "forward" },
  { id: "gw-billing", source: "gateway", target: "billing", rel: "internal", label: "usage" },
  { id: "gw-ann", source: "gateway", target: "ann", rel: "internal", label: "model lookup" },

  // Qubic + wallet
  { id: "id-qubic", source: "identity", target: "qubic", rel: "internal", label: "wallet link" },
  { id: "qubic-nats", source: "qubic", target: "nats", rel: "event", label: "chain events" },
  { id: "qubic-econ", source: "qubic", target: "economy", rel: "internal", label: "splits" },

  // Compute backbone
  { id: "compute-qubic", source: "compute", target: "qubic", rel: "internal", label: "computors" },

  // ANN + ecosystem
  { id: "ann-compute", source: "ann", target: "compute", rel: "internal", label: "deploy" },
  { id: "ann-id", source: "ann", target: "identity", rel: "internal", label: "creator" },
  { id: "tissue-ann", source: "tissue", target: "ann", rel: "internal", label: "compose" },
  { id: "tissue-id", source: "tissue", target: "identity", rel: "internal", label: "author" },

  // Dataset
  { id: "dataset-minio", source: "dataset", target: "minio", rel: "internal", label: "blobs" },
  { id: "dataset-id", source: "dataset", target: "identity", rel: "internal", label: "uploader" },

  // Training
  { id: "training-compute", source: "training", target: "compute", rel: "internal", label: "bridge" },
  { id: "training-ann", source: "training", target: "ann", rel: "internal", label: "publish" },
  { id: "training-dataset", source: "training", target: "dataset", rel: "internal", label: "read" },
  { id: "training-id", source: "training", target: "identity", rel: "internal", label: "author" },

  // Work
  { id: "work-compute", source: "work", target: "compute", rel: "internal", label: "run" },
  { id: "work-id", source: "work", target: "identity", rel: "internal", label: "worker" },
  { id: "work-econ", source: "work", target: "economy", rel: "internal", label: "payout" },

  // Marketplace
  { id: "mkt-billing", source: "marketplace", target: "billing", rel: "internal", label: "fees" },
  { id: "mkt-id", source: "marketplace", target: "identity", rel: "internal", label: "buyer" },

  // Economy
  { id: "econ-billing", source: "economy", target: "billing", rel: "internal", label: "settle" },

  // Infra fan-out (all services depend on infra)
  { id: "id-pg", source: "identity", target: "postgres", rel: "tcp" },
  { id: "qubic-pg", source: "qubic", target: "postgres", rel: "tcp" },
  { id: "compute-pg", source: "compute", target: "postgres", rel: "tcp" },
  { id: "gw-pg", source: "gateway", target: "postgres", rel: "tcp" },
  { id: "billing-pg", source: "billing", target: "postgres", rel: "tcp" },
  { id: "ann-pg", source: "ann", target: "postgres", rel: "tcp" },
  { id: "mkt-pg", source: "marketplace", target: "postgres", rel: "tcp" },
  { id: "tissue-pg", source: "tissue", target: "postgres", rel: "tcp" },
  { id: "ds-pg", source: "dataset", target: "postgres", rel: "tcp" },
  { id: "econ-pg", source: "economy", target: "postgres", rel: "tcp" },
  { id: "train-pg", source: "training", target: "postgres", rel: "tcp" },
  { id: "work-pg", source: "work", target: "postgres", rel: "tcp" },

  // Redis (sessions / rate limits / queues)
  { id: "id-redis", source: "identity", target: "redis", rel: "tcp" },
  { id: "gw-redis", source: "gateway", target: "redis", rel: "tcp" },
  { id: "train-redis", source: "training", target: "redis", rel: "tcp" },
  { id: "work-redis", source: "work", target: "redis", rel: "tcp" },

  // Event bus
  { id: "id-nats", source: "identity", target: "nats", rel: "event" },
  { id: "compute-nats", source: "compute", target: "nats", rel: "event" },
  { id: "gw-nats", source: "gateway", target: "nats", rel: "event" },
  { id: "ann-nats", source: "ann", target: "nats", rel: "event" },
  { id: "mkt-nats", source: "marketplace", target: "nats", rel: "event" },
  { id: "tissue-nats", source: "tissue", target: "nats", rel: "event" },
  { id: "ds-nats", source: "dataset", target: "nats", rel: "event" },
  { id: "econ-nats", source: "economy", target: "nats", rel: "event" },
  { id: "train-nats", source: "training", target: "nats", rel: "event" },
  { id: "work-nats", source: "work", target: "nats", rel: "event" },
];

/* ─────────────────────────────────────────────────────────────────────────
 *  Visual config
 * ───────────────────────────────────────────────────────────────────────── */

export const KIND_STYLE: Record<Kind, {
  ring: string;
  bg: string;
  text: string;
  pill: string;
  edge: string;
  label: string;
}> = {
  app: {
    ring: "ring-garden-500/40",
    bg: "bg-garden-500/10",
    text: "text-garden-700 dark:text-garden-300",
    pill: "border-garden-500/30 bg-garden-500/10 text-garden-700 dark:text-garden-300",
    edge: "#22c55e",
    label: "App",
  },
  edge: {
    ring: "ring-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    pill: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    edge: "#0ea5e9",
    label: "Edge",
  },
  core: {
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    pill: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    edge: "#f59e0b",
    label: "Core",
  },
  intel: {
    ring: "ring-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-300",
    pill: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    edge: "#8b5cf6",
    label: "Intelligence",
  },
  economy: {
    ring: "ring-rose-500/40",
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    pill: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    edge: "#f43f5e",
    label: "Economy",
  },
  infra: {
    ring: "ring-slate-500/40",
    bg: "bg-slate-500/10",
    text: "text-slate-700 dark:text-slate-300",
    pill: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    edge: "#64748b",
    label: "Infra",
  },
};

export const EDGE_STYLE: Record<EdgeDef["rel"], { stroke: string; label?: string }> = {
  https:    { stroke: "#22c55e", label: "HTTPS" },
  internal: { stroke: "#94a3b8", label: "HTTP" },
  tcp:      { stroke: "#475569" },
  auth:     { stroke: "#facc15", label: "auth" },
  event:    { stroke: "#a855f7", label: "NATS" },
};

/* ─────────────────────────────────────────────────────────────────────────
 *  Layout — column per tier, stack nodes vertically.
 *  ReactFlow coordinates: x right, y down.
 * ───────────────────────────────────────────────────────────────────────── */

const TIER_ORDER: Kind[] = ["app", "edge", "core", "intel", "economy", "infra"];
const COL_WIDTH = 220;
const COL_GAP = 120;
const ROW_HEIGHT = 110;

export function layoutNodes(): NodeDef[] {
  const byTier: Record<Kind, NodeDef[]> = {
    app: [], edge: [], core: [], intel: [], economy: [], infra: [],
  };
  for (const n of NODES) byTier[n.kind].push(n);

  let xCursor = 0;
  return NODES.map((n) => {
    const idx = byTier[n.kind].indexOf(n);
    const y = idx * ROW_HEIGHT + 40;
    const x = xCursor + TIER_ORDER.indexOf(n.kind) * (COL_WIDTH + COL_GAP);
    if (n.kind === "infra" && idx === byTier[n.kind].length - 1) {
      // nothing — just a noop so linter stops complaining
    }
    return { ...n, position: { x, y } };
  });
}

export function nodesById(): Record<string, NodeDef> {
  const out: Record<string, NodeDef> = {};
  for (const n of layoutNodes()) out[n.id] = n;
  return out;
}