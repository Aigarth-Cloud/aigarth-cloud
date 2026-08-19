/**
 * Gateway service — Drizzle schema.
 *
 * Owns:
 *   gateway_models         — registered models (chat, embed, image)
 *   gateway_deployments    — model → region/cluster mapping
 *   gateway_api_keys       — gateway-specific API keys (separate from identity's org keys)
 *   gateway_requests       — every API call, with usage + cost
 *   gateway_rate_limits    — per-key per-minute/per-day windows
 *   gateway_audit_logs     — service-local audit log
 *
 * All bigint columns omit defaults (drizzle-kit can't serialize BigInt
 * literals). Audit log is prefixed to avoid collision with the other
 * services in the shared `public` schema.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

export const modelType = pgEnum("model_type", ["chat", "embedding", "image", "audio", "video"]);

export const modelStatus = pgEnum("model_status", ["active", "deprecated", "preview", "offline"]);

export const deploymentStatus = pgEnum("deployment_status", [
  "active",
  "draining",
  "offline",
]);

export const apiKeyStatus = pgEnum("gateway_api_key_status", [
  "active",
  "revoked",
]);

// ---------- Models ----------

export const gatewayModels = pgTable(
  "gateway_models",
  {
    id: text("id").primaryKey(), // e.g. "aigarth-meridian-1"
    name: text("name").notNull(),
    family: text("family").notNull(), // "aigarth-meridian", "openai-gpt4o"
    type: modelType("type").notNull(),
    description: text("description"),
    contextWindow: integer("context_window").notNull().default(8192),
    maxOutputTokens: integer("max_output_tokens").notNull().default(4096),
    /** Cost per 1K input tokens in QUBIC. */
    inputCostQubic: bigint("input_cost_qubic", { mode: "bigint" }).notNull(),
    /** Cost per 1K output tokens in QUBIC. */
    outputCostQubic: bigint("output_cost_qubic", { mode: "bigint" }).notNull(),
    status: modelStatus("status").notNull().default("active"),
    ownedBy: text("owned_by").notNull().default("aigarth"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeIdx: index("gateway_models_type_idx").on(t.type),
    statusIdx: index("gateway_models_status_idx").on(t.status),
  }),
);

// ---------- Deployments (model × region × cluster) ----------

export const gatewayDeployments = pgTable(
  "gateway_deployments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => gatewayModels.id, { onDelete: "cascade" }),
    region: text("region").notNull().default("global"),
    clusterHint: text("cluster_hint"), // free-form cluster slug (matches compute.clusters.slug)
    status: deploymentStatus("status").notNull().default("active"),
    /** Priority for routing (higher = preferred). */
    priority: integer("priority").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    modelIdx: index("gateway_deployments_model_idx").on(t.modelId),
    regionIdx: index("gateway_deployments_region_idx").on(t.region),
  }),
);

// ---------- API Keys ----------

export const gatewayApiKeys = pgTable(
  "gateway_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    name: text("name").notNull(),
    /** 8-char public prefix; used to identify the key without the secret. */
    prefix: text("prefix").notNull(),
    /** First 8 chars of the sha256(secret) for display. */
    secretHash: text("secret_hash").notNull(),
    /** Last 4 chars of the prefix+secret, for display. */
    secretLast4: text("secret_last4").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    status: apiKeyStatus("status").notNull().default("active"),
    rateLimitRpm: integer("rate_limit_rpm"),
    rateLimitTpm: integer("rate_limit_tpm"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    prefixIdx: uniqueIndex("gateway_api_keys_prefix_idx").on(t.prefix),
    userIdx: index("gateway_api_keys_user_idx").on(t.userId),
    statusIdx: index("gateway_api_keys_status_idx").on(t.status),
  }),
);

// ---------- Requests (usage log) ----------

export const gatewayRequests = pgTable(
  "gateway_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    apiKeyId: uuid("api_key_id").references(() => gatewayApiKeys.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    endpoint: text("endpoint").notNull(), // "chat.completions", "embeddings", "images.generations"
    statusCode: integer("status_code").notNull(),
    durationMs: integer("duration_ms").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costQubic: bigint("cost_qubic", { mode: "bigint" }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestBody: jsonb("request_body").$type<Record<string, unknown>>(),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("gateway_requests_user_idx").on(t.userId),
    keyIdx: index("gateway_requests_key_idx").on(t.apiKeyId),
    modelIdx: index("gateway_requests_model_idx").on(t.model),
    endpointIdx: index("gateway_requests_endpoint_idx").on(t.endpoint),
    createdIdx: index("gateway_requests_created_idx").on(t.createdAt),
  }),
);

// ---------- Rate limits (sliding window) ----------

export const gatewayRateLimits = pgTable(
  "gateway_rate_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => gatewayApiKeys.id, { onDelete: "cascade" }),
    /** Window identifier: "YYYY-MM-DDTHH:MM" (minute buckets) */
    window: text("window").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    tokenCount: integer("token_count").notNull().default(0),
  },
  (t) => ({
    keyWindowIdx: uniqueIndex("gateway_rate_limits_key_window_idx").on(t.apiKeyId, t.window),
  }),
);

// ---------- Audit log ----------

export const auditLogs = pgTable(
  "gateway_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id"),
    orgId: uuid("org_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("gateway_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("gateway_audit_logs_action_idx").on(t.action),
    createdIdx: index("gateway_audit_logs_created_idx").on(t.createdAt),
  }),
);

// ---------- Type exports ----------

export type GatewayModel = typeof gatewayModels.$inferSelect;
export type NewGatewayModel = typeof gatewayModels.$inferInsert;
export type GatewayDeployment = typeof gatewayDeployments.$inferSelect;
export type GatewayApiKey = typeof gatewayApiKeys.$inferSelect;
export type NewGatewayApiKey = typeof gatewayApiKeys.$inferInsert;
export type ApiKeyStatus = (typeof apiKeyStatus.enumValues)[number];
export type GatewayRequest = typeof gatewayRequests.$inferSelect;
export type GatewayRateLimit = typeof gatewayRateLimits.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
