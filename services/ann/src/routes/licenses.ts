/**
 * /v1/licenses — public list of license types.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listLicenses } from "../services/licenses.js";
import type { License } from "../db/schema.js";

export async function licenseRoutes(app: FastifyInstance) {
  app.get("/v1/licenses", async (_req: FastifyRequest, reply: FastifyReply) => {
    const list = await listLicenses();
    return reply.send({ data: list.map(serialize) });
  });

  app.get("/v1/licenses/:slug", async (req: FastifyRequest, reply: FastifyReply) => {
    const { getLicenseBySlug } = await import("../services/licenses.js");
    const lic = await getLicenseBySlug((req.params as { slug: string }).slug);
    if (!lic) return reply.code(404).send({ error: { message: "License not found" } });
    return reply.send(serialize(lic));
  });
}

function serialize(l: License) {
  return {
    id: l.id,
    slug: l.slug,
    name: l.name,
    description: l.description,
    kind: l.kind,
    terms: l.terms,
    price_per_call_qubic: l.pricePerCallQubic.toString(),
    revenue_share_bps: l.revenueShareBps,
    allows_modification: l.allowsModification,
    allows_commercial_use: l.allowsCommercialUse,
    allows_redistribution: l.allowsRedistribution,
    requires_attribution: l.requiresAttribution,
    is_active: l.isActive,
  };
}
