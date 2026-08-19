/**
 * Authorization middleware.
 *
 * Verifies the authenticated user has a membership in the org and
 * (optionally) a role that satisfies the minimum required level.
 *
 * Role hierarchy: owner > admin > member > viewer.
 *
 * Scope check: the user must have the given custom scope in their
 * membership.scopes array (or be an owner/admin, which implicitly
 * have all scopes).
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { memberships, type MembershipRole } from "../db/schema.js";

export const ROLE_RANK: Record<MembershipRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function hasMinRole(actual: MembershipRole, required: MembershipRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/**
 * Pre-handler that looks up the user's membership in the org
 * (from `req.params.orgId`, the `X-Org-Id` header, or the `orgId`
 * query/body field, in that order) and (optionally) checks role
 * and scope. Attaches the membership to `req.orgMembership` for
 * downstream handlers.
 */
export function requireOrgRole(app: FastifyInstance, opts: { minRole: MembershipRole; scope?: string }) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user.sub;
    const orgId =
      (req.params as { orgId?: string }).orgId ??
      (req.headers["x-org-id"] as string | undefined) ??
      (req.query as { orgId?: string })?.orgId ??
      (req.body as { orgId?: string })?.orgId;
    if (!orgId) {
      return reply.code(400).send({ error: { message: "orgId required (path / X-Org-Id header / query / body)" } });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
      .limit(1);
    const membership = rows[0];

    if (!membership || membership.removedAt) {
      return reply.code(404).send({ error: { message: "Organization not found" } });
    }

    if (!hasMinRole(membership.role, opts.minRole)) {
      return reply
        .code(403)
        .send({ error: { message: `Requires role: ${opts.minRole} or higher` } });
    }

    if (opts.scope) {
      const isPrivileged = membership.role === "owner" || membership.role === "admin";
      const hasScope = Array.isArray(membership.scopes) && membership.scopes.includes(opts.scope);
      if (!isPrivileged && !hasScope) {
        return reply
          .code(403)
          .send({ error: { message: `Missing required scope: ${opts.scope}` } });
      }
    }

    (req as { orgMembership?: typeof membership }).orgMembership = membership;
  };
}
