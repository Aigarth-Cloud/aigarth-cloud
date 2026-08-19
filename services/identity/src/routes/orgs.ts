/**
 * /v1/orgs — organization + member + team routes.
 *
 *   GET    /v1/orgs                       list my orgs
 *   POST   /v1/orgs                       create new org
 *   GET    /v1/orgs/:orgId                read org
 *   PATCH  /v1/orgs/:orgId                update
 *   DELETE /v1/orgs/:orgId                soft delete
 *   GET    /v1/orgs/:orgId/members        list members
 *   POST   /v1/orgs/:orgId/members        add member
 *   PATCH  /v1/orgs/:orgId/members/:mid   change role
 *   DELETE /v1/orgs/:orgId/members/:mid   remove
 *   GET    /v1/orgs/:orgId/teams          list teams
 *   POST   /v1/orgs/:orgId/teams          create team
 *   POST   /v1/orgs/:orgId/teams/:tid/members   add member to team
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createOrg,
  getOrg,
  updateOrg,
  deleteOrg,
  listUserOrgs,
  listMembers,
  addMember,
  updateMember,
  removeMember,
  listTeams,
  createTeam,
  addTeamMember,
  CreateOrgSchema,
  UpdateOrgSchema,
  AddMemberSchema,
  UpdateMemberSchema,
  CreateTeamSchema,
} from "../services/orgs.js";
import { requireOrgRole } from "../lib/authz.js";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { apiKeys } from "../db/schema.js";

function serializeOrg(org: Awaited<ReturnType<typeof getOrg>> & { role?: string; scopes?: string[] }) {
  if (!org) return null;
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    is_personal: org.isPersonal,
    avatar_url: org.avatarUrl,
    billing_email: org.billingEmail,
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
    ...(org.role ? { role: org.role } : {}),
    ...(org.scopes ? { scopes: org.scopes } : {}),
  };
}

export async function orgRoutes(app: FastifyInstance) {
  // ---------- List my orgs ----------

  app.get(
    "/v1/orgs",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const orgs = await listUserOrgs(req.user.sub);
      return reply.send({ data: orgs.map(serializeOrg) });
    },
  );

  // ---------- Create org ----------

  app.post(
    "/v1/orgs",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateOrgSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const { org, membership } = await createOrg(parse.data, req.user.sub);
        return reply.code(201).send(
          serializeOrg({ ...org, role: membership.role, scopes: membership.scopes ?? [] }),
        );
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  // ---------- Read / update / delete org ----------

  const orgScoped = {
    onRequest: [app.authenticate, requireOrgRole(app, { minRole: "viewer" })],
  };

  const orgAdmin = {
    onRequest: [app.authenticate, requireOrgRole(app, { minRole: "admin" })],
  };

  app.get(
    "/v1/orgs/:orgId",
    orgScoped,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const org = await getOrg((req.params as { orgId: string }).orgId);
      if (!org) return reply.code(404).send({ error: { message: "Not found" } });
      return reply.send(serializeOrg(org));
    },
  );

  app.patch(
    "/v1/orgs/:orgId",
    orgAdmin,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = UpdateOrgSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const org = await updateOrg(
          (req.params as { orgId: string }).orgId,
          parse.data,
          req.user.sub,
        );
        return reply.send(serializeOrg(org));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Update failed" } });
      }
    },
  );

  app.delete(
    "/v1/orgs/:orgId",
    { onRequest: [app.authenticate, requireOrgRole(app, { minRole: "owner" })] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await deleteOrg((req.params as { orgId: string }).orgId, req.user.sub);
        return reply.send({ ok: true });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Delete failed" } });
      }
    },
  );

  // ---------- Members ----------

  app.get(
    "/v1/orgs/:orgId/members",
    orgScoped,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const members = await listMembers((req.params as { orgId: string }).orgId);
      return reply.send({
        data: members.map((m) => ({
          id: m.id,
          user_id: m.userId,
          email: m.email,
          name: m.name,
          role: m.role,
          scopes: m.scopes,
          joined_at: m.joinedAt.toISOString(),
          invited_by: m.invitedBy,
        })),
      });
    },
  );

  app.post(
    "/v1/orgs/:orgId/members",
    orgAdmin,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = AddMemberSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const m = await addMember(
          (req.params as { orgId: string }).orgId,
          parse.data,
          req.user.sub,
        );
        return reply.code(201).send({
          id: m.id,
          user_id: m.userId,
          org_id: m.orgId,
          role: m.role,
          scopes: m.scopes,
          joined_at: m.joinedAt.toISOString(),
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Add failed" } });
      }
    },
  );

  app.patch(
    "/v1/orgs/:orgId/members/:membershipId",
    orgAdmin,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { orgId, membershipId } = req.params as { orgId: string; membershipId: string };
      const parse = UpdateMemberSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const m = await updateMember(orgId, membershipId, parse.data, req.user.sub);
        return reply.send({
          id: m.id,
          user_id: m.userId,
          role: m.role,
          scopes: m.scopes,
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Update failed" } });
      }
    },
  );

  app.delete(
    "/v1/orgs/:orgId/members/:membershipId",
    orgAdmin,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { orgId, membershipId } = req.params as { orgId: string; membershipId: string };
      try {
        await removeMember(orgId, membershipId, req.user.sub);
        // Also revoke all API keys for this user in this org
        await getDb()
          .update(apiKeys)
          .set({ revokedAt: new Date(), revokedReason: "member_removed" })
          .where(eq(apiKeys.orgId, orgId));
        return reply.send({ ok: true });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Remove failed" } });
      }
    },
  );

  // ---------- Teams ----------

  app.get(
    "/v1/orgs/:orgId/teams",
    orgScoped,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const teams = await listTeams((req.params as { orgId: string }).orgId);
      return reply.send({
        data: teams.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          description: t.description,
          created_at: t.createdAt.toISOString(),
        })),
      });
    },
  );

  app.post(
    "/v1/orgs/:orgId/teams",
    orgAdmin,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateTeamSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const team = await createTeam(
          (req.params as { orgId: string }).orgId,
          parse.data,
          req.user.sub,
        );
        return reply.code(201).send({
          id: team.id,
          slug: team.slug,
          name: team.name,
          description: team.description,
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  app.post(
    "/v1/orgs/:orgId/teams/:teamId/members",
    orgAdmin,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { orgId, teamId } = req.params as { orgId: string; teamId: string };
      const body = req.body as { membershipId?: string };
      if (!body?.membershipId) {
        return reply.code(400).send({ error: { message: "membershipId required" } });
      }
      try {
        await addTeamMember(orgId, teamId, body.membershipId, req.user.sub);
        return reply.send({ ok: true });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Add failed" } });
      }
    },
  );
}
