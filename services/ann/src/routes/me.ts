/**
 * /v1/me — endpoints scoped to the caller.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listAnns, ListQuerySchema, getUserLicensedAnns, type Ann } from "../services/anns.js";
import { listMyLicenses, type AnnLicenseGrant } from "../services/license-grants.js";
import { listMyDeployments } from "../services/deployments.js";
import { serializeDeployment } from "../lib/serialize.js";

export async function meRoutes(app: FastifyInstance) {
  // ANNs I created
  app.get(
    "/v1/me/anns",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // Re-use ListQuerySchema but force creator=self, no status filter
      const parse = ListQuerySchema.partial().safeParse(req.query);
      const query = {
        ...ListQuerySchema.parse({ status: "published", ...parse.data }),
        creator: req.user.sub,
        status: (parse.data?.status as "draft" | "published" | "deprecated" | "suspended" | undefined) ?? "published",
        visibility: undefined,
      };
      const result = await listAnns(query);
      return reply.send({
        data: result.data.map(serializeAnnLite),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  // ANNs I've licensed (active grants)
  app.get(
    "/v1/me/licenses",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const grants = await listMyLicenses(req.user.sub);
      return reply.send({ data: grants.map(serializeGrant) });
    },
  );

  // My active deployments
  app.get(
    "/v1/me/deployments",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const deployments = await listMyDeployments(req.user.sub);
      return reply.send({ data: deployments.map(serializeDeployment) });
    },
  );

  // ANNs I've licensed (as Ann rows, for richer UI)
  app.get(
    "/v1/me/anns/licensed",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await getUserLicensedAnns(req.user.sub);
      return reply.send({ data: list.map(serializeAnnLite) });
    },
  );
}

function serializeAnnLite(a: Ann) {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    tagline: a.tagline,
    icon: a.icon,
    status: a.status,
    visibility: a.visibility,
    creator_name: a.creatorName,
    rating_average: a.ratingAverage,
    rating_count: a.ratingCount,
    total_calls: a.totalCalls.toString(),
    monthly_calls: a.monthlyCalls.toString(),
  };
}

function serializeGrant(g: AnnLicenseGrant) {
  return {
    id: g.id,
    ann_id: g.annId,
    license_id: g.licenseId,
    status: g.status,
    granted_at: g.grantedAt.toISOString(),
    expires_at: g.expiresAt?.toISOString() ?? null,
    call_count: g.callCount.toString(),
  };
}
