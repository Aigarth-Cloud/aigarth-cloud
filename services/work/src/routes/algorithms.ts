/**
 * /v1/work/algorithms — algorithm registry (Task 10).
 *
 *   GET    /v1/work/algorithms        — public list
 *   POST   /v1/work/algorithms        — admin-only registration
 *
 * v1 admin policy: any authenticated user can register. The
 * real admin policy (issuer must have `admin:work:write` scope
 * per services/identity) is a follow-up; the build ships with
 * a permissive default and the route layer is the gate.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listAlgorithms, registerAlgorithm } from "../services/algorithms.js";
import { RegisterAlgorithmSchema } from "../types/algorithm.js";

export async function algorithmRoutes(app: FastifyInstance) {
  app.get("/v1/work/algorithms", async (_req: FastifyRequest, reply: FastifyReply) => {
    const all = await listAlgorithms();
    return reply.send({
      data: all.map((a) => ({
        name: a.name,
        version: a.version,
        container: a.container,
        deterministic: a.deterministic,
        description: a.description,
        created_at: a.createdAt.toISOString(),
      })),
    });
  });

  app.post(
    "/v1/work/algorithms",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = RegisterAlgorithmSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const a = await registerAlgorithm(parse.data);
        return reply.code(201).send({
          name: a.name,
          version: a.version,
          container: a.container,
          deterministic: a.deterministic,
          description: a.description,
          created_at: a.createdAt.toISOString(),
        });
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Register failed" } });
      }
    },
  );
}
