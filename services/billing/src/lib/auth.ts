/**
 * Helper to extract the JWT from a Fastify request.
 * Used when calling cross-service endpoints that need the user's auth.
 */

import type { FastifyRequest } from "fastify";

export function extractJwt(req: FastifyRequest): string {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return "";
}
