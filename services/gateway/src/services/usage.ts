/**
 * Usage tracking + aggregation.
 *
 * Every API call is logged to gateway_requests. This module provides
 * read-side aggregation for the /v1/usage endpoint.
 */

import { eq, and, gte, lte, sql, desc, sum } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { gatewayRequests, type GatewayRequest } from "../db/schema.js";
import { uid } from "../lib/ids.js";

export interface RequestLogInput {
  userId: string;
  orgId?: string | null;
  apiKeyId?: string | null;
  model: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costQubic: bigint;
  ip?: string | null;
  userAgent?: string | null;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
  errorMessage?: string | null;
}

export async function logRequest(input: RequestLogInput): Promise<void> {
  const db = getDb();
  await db.insert(gatewayRequests).values({
    id: uid(),
    userId: input.userId,
    orgId: input.orgId ?? null,
    apiKeyId: input.apiKeyId ?? null,
    model: input.model,
    endpoint: input.endpoint,
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    promptTokens: input.promptTokens ?? 0,
    completionTokens: input.completionTokens ?? 0,
    totalTokens: input.totalTokens ?? 0,
    costQubic: input.costQubic,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    requestBody: input.requestBody ?? null,
    responseBody: input.responseBody ?? null,
    errorMessage: input.errorMessage ?? null,
  });
}

export interface UsageAggregate {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostQubic: bigint;
  byModel: Array<{ model: string; requests: number; tokens: number; cost: bigint }>;
  byEndpoint: Array<{ endpoint: string; requests: number; cost: bigint }>;
}

export async function getUserUsage(
  userId: string,
  options: { since?: Date; until?: Date } = {},
): Promise<UsageAggregate> {
  const db = getDb();
  const conditions = [eq(gatewayRequests.userId, userId)];
  if (options.since) conditions.push(gte(gatewayRequests.createdAt, options.since));
  if (options.until) conditions.push(lte(gatewayRequests.createdAt, options.until));

  const all = await db
    .select()
    .from(gatewayRequests)
    .where(and(...conditions));

  const byModel = new Map<string, { requests: number; tokens: number; cost: bigint }>();
  const byEndpoint = new Map<string, { requests: number; cost: bigint }>();
  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalCost = 0n;

  for (const r of all) {
    totalTokens += r.totalTokens;
    promptTokens += r.promptTokens;
    completionTokens += r.completionTokens;
    totalCost += r.costQubic;

    const m = byModel.get(r.model) ?? { requests: 0, tokens: 0, cost: 0n };
    m.requests += 1;
    m.tokens += r.totalTokens;
    m.cost += r.costQubic;
    byModel.set(r.model, m);

    const e = byEndpoint.get(r.endpoint) ?? { requests: 0, cost: 0n };
    e.requests += 1;
    e.cost += r.costQubic;
    byEndpoint.set(r.endpoint, e);
  }

  return {
    totalRequests: all.length,
    totalTokens,
    promptTokens,
    completionTokens,
    totalCostQubic: totalCost,
    byModel: Array.from(byModel.entries())
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => (a.cost < b.cost ? 1 : -1)),
    byEndpoint: Array.from(byEndpoint.entries())
      .map(([endpoint, v]) => ({ endpoint, ...v }))
      .sort((a, b) => (a.cost < b.cost ? 1 : -1)),
  };
}

export async function getRecentRequests(userId: string, limit = 25): Promise<GatewayRequest[]> {
  const db = getDb();
  return db
    .select()
    .from(gatewayRequests)
    .where(eq(gatewayRequests.userId, userId))
    .orderBy(desc(gatewayRequests.createdAt))
    .limit(Math.min(limit, 100));
}
