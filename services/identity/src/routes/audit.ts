/**
 * /v1/audit-logs — read org audit log with filters.
 *
 *   GET /v1/audit-logs?action=user.created&actor=...&from=2026-01-01&to=2026-12-31&limit=50
 *
 * Only org admins/owners can read.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import { requireOrgRole } from "../lib/authz.js";

const ALLOWED_ACTIONS = new Set([
  "user.created",
  "user.email_verified",
  "user.password_changed",
  "user.suspended",
  "user.deleted",
  "session.created",
  "session.revoked",
  "org.created",
  "org.member_added",
  "org.member_removed",
  "org.role_changed",
  "api_key.created",
  "api_key.rotated",
  "api_key.revoked",
  "wallet.linked",
  "wallet.unlinked",
  "mfa.enrolled",
  "mfa.removed",
  "login.succeeded",
  "login.failed",
]);

export async function auditRoutes(app: FastifyInstance) {
  app.get(
    "/v1/audit-logs",
    { onRequest: [app.authenticate, requireOrgRole(app, { minRole: "admin" })] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const orgId = (req.headers["x-org-id"] as string | undefined) ?? (req.query as { orgId?: string })?.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: { message: "X-Org-Id header or ?orgId= query required" } });
      }
      const q = req.query as {
        action?: string;
        actor?: string;
        from?: string;
        to?: string;
        limit?: string;
        cursor?: string;
      };

      const conditions = [eq(auditLogs.orgId, orgId)];
      if (q.action) {
        if (!ALLOWED_ACTIONS.has(q.action)) {
          return reply.code(400).send({ error: { message: "Unknown action" } });
        }
        conditions.push(eq(auditLogs.action, q.action as never));
      }
      if (q.actor) conditions.push(eq(auditLogs.actorUserId, q.actor));
      if (q.from) conditions.push(gte(auditLogs.createdAt, new Date(q.from)));
      if (q.to) conditions.push(lte(auditLogs.createdAt, new Date(q.to)));
      if (q.cursor) conditions.push(lte(auditLogs.createdAt, new Date(q.cursor)));

      const limit = Math.min(Number(q.limit ?? 50) || 50, 200);

      const db = getDb();
      const rows = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.createdAt.toISOString() : null;

      return reply.send({
        data: data.map((r) => ({
          id: r.id,
          action: r.action,
          actor_user_id: r.actorUserId,
          org_id: r.orgId,
          target_type: r.targetType,
          target_id: r.targetId,
          metadata: r.metadata,
          ip_hash: r.ipHash,
          user_agent: r.userAgent,
          created_at: r.createdAt.toISOString(),
        })),
        next_cursor: nextCursor,
      });
    },
  );

  // Quick stats endpoint for the dashboard
  app.get(
    "/v1/audit-logs/stats",
    { onRequest: [app.authenticate, requireOrgRole(app, { minRole: "admin" })] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const orgId = (req.headers["x-org-id"] as string | undefined) ?? (req.query as { orgId?: string })?.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: { message: "X-Org-Id required" } });
      }
      const db = getDb();
      const rows = await db
        .select({
          action: auditLogs.action,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(auditLogs)
        .where(eq(auditLogs.orgId, orgId))
        .groupBy(auditLogs.action);
      const total = rows.reduce((s, r) => s + Number(r.count), 0);
      return reply.send({ total, by_action: rows });
    },
  );
}
