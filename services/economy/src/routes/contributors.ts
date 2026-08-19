/**
 * /v1/economy/contributors — contributor share CRUD.
 *
 *   GET    /v1/economy/contributors?annId=…       list active shares for an ANN
 *   POST   /v1/economy/contributors                upsert a single share
 *   PUT    /v1/economy/contributors/:annId         replace the whole list (bps sum must = 10000)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  listShares,
  upsertShare,
  replaceShares,
  ContributorShareError,
} from "../services/contributors.js";
import { logActivity } from "../lib/audit.js";

const UpsertShareSchema = z.object({
  annId: z.string().uuid(),
  userId: z.string().uuid(),
  bps: z.number().int().min(0).max(10_000),
  role: z.enum(["creator", "co_creator", "data_provider", "curator", "reviewer"]).default("co_creator"),
  label: z.string().max(120).optional(),
});

const ReplaceSharesSchema = z.object({
  shares: z
    .array(
      z.object({
        userId: z.string().uuid(),
        bps: z.number().int().min(0).max(10_000),
        role: z.enum(["creator", "co_creator", "data_provider", "curator", "reviewer"]).default("co_creator"),
        label: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(64),
});

function serializeShare(s: Awaited<ReturnType<typeof listShares>>[number]) {
  return {
    id: s.id,
    ann_id: s.annId,
    user_id: s.userId,
    bps: s.bps,
    role: s.role,
    label: s.label,
    is_active: s.isActive,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

export async function contributorRoutes(app: FastifyInstance) {
  app.get(
    "/v1/economy/contributors",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const annId = (req.query as Record<string, string | undefined>)["annId"];
      if (!annId) return reply.code(400).send({ error: { message: "annId is required" } });
      const shares = await listShares(annId);
      return reply.send({ data: shares.map(serializeShare) });
    },
  );

  app.post(
    "/v1/economy/contributors",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = UpsertShareSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const share = await upsertShare(parse.data);
        await logActivity("contributor.upsert", `Contributor share ${share.id} upserted`, {
          actorUserId: req.user.sub,
          targetType: "contributor_share",
          targetId: share.id,
        });
        return reply.code(201).send(serializeShare(share));
      } catch (err) {
        if (err instanceof ContributorShareError) {
          return reply.code(400).send({ error: { message: err.message, code: err.code } });
        }
        throw err;
      }
    },
  );

  app.put(
    "/v1/economy/contributors/:annId",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const annId = (req.params as { annId: string }).annId;
      const parse = ReplaceSharesSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const shares = await replaceShares(annId, parse.data.shares);
        await logActivity("contributor.replace", `${shares.length} contributor shares for ANN ${annId}`, {
          actorUserId: req.user.sub,
          targetType: "ann",
          targetId: annId,
        });
        return reply.send({ data: shares.map(serializeShare) });
      } catch (err) {
        if (err instanceof ContributorShareError) {
          return reply.code(400).send({ error: { message: err.message, code: err.code } });
        }
        throw err;
      }
    },
  );
}
