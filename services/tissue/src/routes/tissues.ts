/**
 * /v1/tissues — registry for tissue compositions.
 *
 * Public (no auth):
 *   GET    /v1/tissues                      — list / search
 *   GET    /v1/tissues/:idOrSlug            — details
 *   GET    /v1/tissues/:idOrSlug/members    — list members
 *
 * Authenticated (JWT):
 *   POST   /v1/tissues                              — create draft
 *   PATCH  /v1/tissues/:id                         — update
 *   POST   /v1/tissues/:id/publish                 — flip to active
 *   POST   /v1/tissues/:id/pause                   — flip to paused
 *   POST   /v1/tissues/:id/members                 — add member
 *   DELETE /v1/tissues/:id/members/:memberId       — remove member
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createTissue,
  updateTissue,
  publishTissue,
  pauseTissue,
  addMember,
  removeMember,
  listTissues,
  listMembers,
  getTissue,
  CreateTissueSchema,
  UpdateTissueSchema,
  AddMemberSchema,
  ListQuerySchema,
  ListMembersQuerySchema,
  TissueNotFoundError,
  TissueMemberLimitError,
  TissueDuplicateMemberError,
} from "../services/tissues.js";
import { serializeTissue, serializeTissueMember } from "../lib/serialize.js";

export async function tissueRoutes(app: FastifyInstance) {
  // ---------- Public list + search ----------

  app.get("/v1/tissues", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const result = await listTissues(parse.data);
    return reply.send({
      data: result.data.map(serializeTissue),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Public details ----------

  app.get("/v1/tissues/:idOrSlug", async (req: FastifyRequest, reply: FastifyReply) => {
    const tissue = await getTissue((req.params as { idOrSlug: string }).idOrSlug);
    if (!tissue) return reply.code(404).send({ error: { message: "Tissue not found" } });
    return reply.send(serializeTissue(tissue));
  });

  // ---------- Public member list ----------

  app.get("/v1/tissues/:idOrSlug/members", async (req: FastifyRequest, reply: FastifyReply) => {
    const tissue = await getTissue((req.params as { idOrSlug: string }).idOrSlug);
    if (!tissue) return reply.code(404).send({ error: { message: "Tissue not found" } });
    const parse = ListMembersQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const result = await listMembers(tissue.id, parse.data);
    return reply.send({
      data: result.data.map(serializeTissueMember),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Authenticated CRUD ----------

  app.post(
    "/v1/tissues",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateTissueSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const t = await createTissue(req.user.sub, parse.data);
        return reply.code(201).send(serializeTissue(t));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  app.patch(
    "/v1/tissues/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = UpdateTissueSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const t = await updateTissue(req.user.sub, (req.params as { id: string }).id, parse.data);
        if (!t) return reply.code(404).send({ error: { message: "Tissue not found" } });
        return reply.send(serializeTissue(t));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Update failed" } });
      }
    },
  );

  app.post(
    "/v1/tissues/:id/publish",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const t = await publishTissue(req.user.sub, (req.params as { id: string }).id);
        if (!t) return reply.code(404).send({ error: { message: "Tissue not found" } });
        return reply.send(serializeTissue(t));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Publish failed" } });
      }
    },
  );

  app.post(
    "/v1/tissues/:id/pause",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const t = await pauseTissue(req.user.sub, (req.params as { id: string }).id);
        if (!t) return reply.code(404).send({ error: { message: "Tissue not found" } });
        return reply.send(serializeTissue(t));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Pause failed" } });
      }
    },
  );

  // ---------- Members ----------

  app.post(
    "/v1/tissues/:id/members",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = AddMemberSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const m = await addMember(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.code(201).send(serializeTissueMember(m));
      } catch (err) {
        if (err instanceof TissueNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof TissueMemberLimitError) {
          return reply.code(400).send({ error: { message: err.message } });
        }
        if (err instanceof TissueDuplicateMemberError) {
          return reply.code(409).send({ error: { message: err.message } });
        }
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Add member failed" } });
      }
    },
  );

  app.delete(
    "/v1/tissues/:id/members/:memberId",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const ok = await removeMember(
          req.user.sub,
          (req.params as { id: string }).id,
          (req.params as { memberId: string }).memberId,
        );
        if (!ok) return reply.code(404).send({ error: { message: "Member not found" } });
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof TissueNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Remove member failed" } });
      }
    },
  );
}
