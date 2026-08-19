/**
 * Auth helper. Routes use `app.authenticate` (decorated on the
 * Fastify instance) for the normal path. This file exists so
 * service-layer code that doesn't have the Fastify request object
 * (e.g. the worker) can still validate a JWT-derived user id
 * before doing privileged work.
 */

import type { FastifyRequest, FastifyReply } from "fastify";

/** Read the bearer token from a request. Returns null if absent. */
export function extractBearer(req: FastifyRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m?.[1]?.trim() ?? null;
}

/** Returns the caller's user id from a verified request, or null. */
export function callerUserId(req: FastifyRequest): string | null {
  return req.user?.sub ?? null;
}

/** Returns the caller's user id, or 401. */
export async function requireUser(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<string | null> {
  const uid = callerUserId(req);
  if (!uid) {
    reply.code(401).send({ error: { message: "Authentication required" } });
    return null;
  }
  return uid;
}
