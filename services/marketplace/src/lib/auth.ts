import type { FastifyRequest } from "fastify";

export function extractJwt(req: FastifyRequest): string {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return "";
}
