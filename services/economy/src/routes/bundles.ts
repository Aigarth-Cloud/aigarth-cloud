/**
 * /v1/economy/bundles — N-ANN bundle listings.
 *
 *   GET    /v1/economy/bundles              list all bundles
 *   GET    /v1/economy/bundles/:id          read one bundle
 *   POST   /v1/economy/bundles              create a bundle
 *   PATCH  /v1/economy/bundles/:id          update a bundle
 *   DELETE /v1/economy/bundles/:id          delete a bundle
 *
 * A bundle is a marketplace listing (in services/marketplace) that
 * contains N ANNs. This service holds the bundle-specific metadata
 * (which ANNs, in what order, with what type and price). The marketplace
 * listing itself is created/managed in services/marketplace.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  listBundles,
  getBundle,
  createBundle,
  updateBundle,
  deleteBundle,
} from "../services/bundles.js";
import { logActivity } from "../lib/audit.js";

const CreateBundleSchema = z.object({
  listingId: z.string().uuid(),
  kind: z.enum(["collection", "starter_pack", "curated"]).default("collection"),
  annIds: z.array(z.string().uuid()).min(1).max(64),
  bundlePriceQubic: z.string().regex(/^[0-9]+$/),
  discountBps: z.number().int().min(0).max(10_000).default(0),
  notes: z.string().max(2_000).optional(),
});

const UpdateBundleSchema = CreateBundleSchema.partial();

function serializeBundle(b: NonNullable<Awaited<ReturnType<typeof getBundle>>>) {
  return {
    id: b.id,
    listing_id: b.listingId,
    kind: b.kind,
    ann_ids: b.annIds,
    bundle_price_qubic: b.bundlePriceQubic.toString(),
    discount_bps: b.discountBps,
    notes: b.notes,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  };
}

export async function bundleRoutes(app: FastifyInstance) {
  app.get(
    "/v1/economy/bundles",
    { onRequest: [app.authenticate] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const bundles = await listBundles();
      return reply.send({ data: bundles.map(serializeBundle) });
    },
  );

  app.get(
    "/v1/economy/bundles/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      const bundle = await getBundle(id);
      if (!bundle) return reply.code(404).send({ error: { message: "bundle not found" } });
      return reply.send(serializeBundle(bundle));
    },
  );

  app.post(
    "/v1/economy/bundles",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateBundleSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const bundle = await createBundle({
          ...parse.data,
          bundlePriceQubic: BigInt(parse.data.bundlePriceQubic),
        });
        await logActivity("bundle.create", `Bundle ${bundle.id} created`, {
          actorUserId: req.user.sub,
          targetType: "bundle",
          targetId: bundle.id,
        });
        return reply.code(201).send(serializeBundle(bundle));
      } catch (err) {
        return reply.code(400).send({
          error: { message: err instanceof Error ? err.message : "create failed" },
        });
      }
    },
  );

  app.patch(
    "/v1/economy/bundles/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      const parse = UpdateBundleSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      // Build a Drizzle-shaped patch from the parsed body. We pass
      // bigints through the service which serializes via the schema.
      const patch: Parameters<typeof updateBundle>[1] = {};
      if (parse.data.listingId !== undefined) patch.listingId = parse.data.listingId;
      if (parse.data.kind !== undefined) patch.kind = parse.data.kind;
      if (parse.data.annIds !== undefined) patch.annIds = parse.data.annIds;
      if (parse.data.bundlePriceQubic !== undefined) {
        patch.bundlePriceQubic = BigInt(parse.data.bundlePriceQubic);
      }
      if (parse.data.discountBps !== undefined) patch.discountBps = parse.data.discountBps;
      if (parse.data.notes !== undefined) patch.notes = parse.data.notes;
      const bundle = await updateBundle(id, patch);
      if (!bundle) return reply.code(404).send({ error: { message: "bundle not found" } });
      await logActivity("bundle.update", `Bundle ${bundle.id} updated`, {
        actorUserId: req.user.sub,
        targetType: "bundle",
        targetId: bundle.id,
      });
      return reply.send(serializeBundle(bundle));
    },
  );

  app.delete(
    "/v1/economy/bundles/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      await deleteBundle(id);
      await logActivity("bundle.delete", `Bundle ${id} deleted`, {
        actorUserId: req.user.sub,
        targetType: "bundle",
        targetId: id,
      });
      return reply.code(204).send();
    },
  );
}
