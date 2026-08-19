/**
 * /v1/me — authenticated user info.
 *
 *   GET /v1/me
 *
 * Requires a valid JWT in the Authorization header (Bearer) or the
 * aigarth_session cookie.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { users, memberships, organizations, sessions } from "../db/schema.js";

export async function meRoutes(app: FastifyInstance) {
  app.get(
    "/v1/me",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;
      if (!userId || typeof userId !== "string") {
        return reply.code(401).send({ error: { message: "Invalid token" } });
      }
      const db = getDb();

      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = userRows[0];
      if (!user || user.status === "deleted") {
        return reply.code(404).send({ error: { message: "User not found" } });
      }

      const myMemberships = await db
        .select({
          membership: memberships,
          org: organizations,
        })
        .from(memberships)
        .innerJoin(organizations, eq(memberships.orgId, organizations.id))
        .where(eq(memberships.userId, userId));

      const jti = req.user.jti;
      const sessionRows = jti
        ? await db.select().from(sessions).where(eq(sessions.jti, jti as string)).limit(1)
        : [];
      const session = sessionRows[0] ?? null;

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatarUrl,
        status: user.status,
        email_verified: user.emailVerifiedAt !== null,
        locale: user.locale,
        timezone: user.timezone,
        created_at: user.createdAt.toISOString(),
        last_seen_at: user.lastSeenAt?.toISOString() ?? null,
        session: session
          ? {
              id: session.id,
              expires_at: session.expiresAt.toISOString(),
              last_used_at: session.lastUsedAt.toISOString(),
            }
          : null,
        organizations: myMemberships
          .filter((m) => m.membership.removedAt === null && m.org.deletedAt === null)
          .map((m) => ({
            id: m.org.id,
            slug: m.org.slug,
            name: m.org.name,
            is_personal: m.org.isPersonal,
            role: m.membership.role,
            scopes: m.membership.scopes,
            joined_at: m.membership.joinedAt.toISOString(),
          })),
      });
    },
  );
}
