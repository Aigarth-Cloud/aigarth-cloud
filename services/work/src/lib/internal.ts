/**
 * Internal-token guard.
 *
 * Per Phase 18 closeout (AGENTS.md): service-to-service calls
 * on `/v1/internal/*` must carry `Authorization: Bearer
 * <INTERNAL_TOKEN>` whose value matches the target service's
 * INTERNAL_TOKEN. The dev default is `internal_dev_token_change_me`.
 *
 * Used by:
 *   - `services/work/src/routes/internal.ts` (preHandler)
 *   - `services/work/src/workers/assignment.ts` (callback to self)
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { loadConfig } from "../config/index.js";

export function isInternalAuthorized(req: FastifyRequest, reply: FastifyReply): boolean {
  const cfg = loadConfig();
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    if (auth.slice(7) === cfg.INTERNAL_TOKEN) return true;
  }
  // Also accept `x-internal-token` header for cross-service HTTP calls
  const headerToken = req.headers["x-internal-token"];
  if (typeof headerToken === "string" && headerToken === cfg.INTERNAL_TOKEN) {
    return true;
  }
  reply.code(401).send({ error: { message: "Invalid or missing internal token" } });
  return false;
}
