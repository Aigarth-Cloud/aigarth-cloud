/**
 * /v1/training/jobs/:id/stream — SSE progress stream (Phase 19C.5).
 *
 * Authenticated (JWT). Returns `text/event-stream` and streams
 * events for a single training job:
 *
 *   - `event: snapshot` — current job state (always first)
 *   - `event: progress` — each progress tick from the worker
 *   - `event: end`      — terminal state (success or failure)
 *
 * The stream closes when the job reaches a terminal state, the
 * client disconnects, or the route handler is aborted.
 *
 * Headers:
 *   - Content-Type: text/event-stream
 *   - Cache-Control: no-cache
 *   - Connection: keep-alive
 *   - X-Accel-Buffering: no  (disables nginx buffering)
 *
 * The actual streaming logic is in `streamJobProgress`; the
 * route handler is a thin wrapper. Splitting them lets unit
 * tests exercise the stream directly without going through
 * Fastify's HTTP plumbing.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getJob, TrainingJobNotFoundError } from "../services/jobs.js";
import { subscribeProgress } from "../services/progress.js";
import { serializeJob } from "../lib/serialize.js";
import type { TrainingJobStatus, TrainingJob, TrainingProgress } from "../db/schema.js";

const TERMINAL: ReadonlySet<TrainingJobStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);

export function sseFormat(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Pure logic for the SSE stream. Writes events to `sink.write`
 * and returns when the job reaches a terminal state. Caller is
 * responsible for `sink.close()`.
 *
 * Exposed for testing — the route handler wraps this with the
 * Fastify-specific bits (auth, raw response hijack, etc.).
 */
export async function streamJobProgress(
  initialJob: TrainingJob,
  sink: {
    write: (chunk: string) => void;
    close: () => void;
    onClientClose: (cb: () => void) => void;
  },
): Promise<void> {
  // 1) Send the initial snapshot. If the job is already
  // terminal, end the stream right after.
  sink.write(sseFormat("snapshot", serializeJob(initialJob)));
  if (TERMINAL.has(initialJob.status)) {
    sink.write(
      sseFormat("end", {
        status: initialJob.status,
        metrics: initialJob.metricsJson,
        error: initialJob.errorMessage,
      }),
    );
    sink.close();
    return;
  }

  // 2) Subscribe to progress. Each event is forwarded as
  // `event: progress`. When the job reaches a terminal
  // state, emit `end` and close.
  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    try {
      await unsubscribe();
    } catch {
      /* already unsubscribed */
    }
  };
  sink.onClientClose(() => {
    void cleanup();
  });

  const unsubscribe = await subscribeProgress(initialJob.id, async (event: TrainingProgress) => {
    if (closed) return;
    try {
      sink.write(sseFormat("progress", event));
      if (TERMINAL.has(event.status)) {
        await cleanup();
        sink.write(
          sseFormat("end", {
            status: event.status,
            metrics: event.metrics,
            error: null,
          }),
        );
        sink.close();
      }
    } catch {
      closed = true;
    }
  });
}

export async function progressRoutes(app: FastifyInstance) {
  app.get(
    "/v1/training/jobs/:id/stream",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };

      // 1) Look up the job. 404 if it doesn't exist.
      let initialJob;
      try {
        initialJob = await getJob(id);
      } catch (e) {
        if (e instanceof TrainingJobNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        throw e;
      }

      // 2) Set SSE headers. `reply.hijack()` tells Fastify
      // we'll own the raw response for the lifetime of the
      // stream; otherwise Fastify would try to JSON-serialize
      // the return value of this handler over the same socket
      // and clobber our writes.
      reply.hijack();
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.raw.writeHead(200);
      reply.raw.flushHeaders?.();

      // 3) Heartbeat every 15s so intermediate proxies don't
      // time out the connection.
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
          /* connection lost */
        }
      }, 15_000);

      // 4) Run the stream logic.
      await streamJobProgress(initialJob, {
        write: (chunk) => {
          try {
            reply.raw.write(chunk);
          } catch {
            /* socket closed */
          }
        },
        close: () => {
          clearInterval(heartbeat);
          try {
            reply.raw.end();
          } catch {
            /* already closed */
          }
        },
        onClientClose: (cb) => {
          req.raw.on("close", () => cb());
          req.raw.on("aborted", () => cb());
        },
      });

      // 5) Fastify's reply lifecycle: returning undefined is
      // safe because we called reply.hijack() above.
      return reply;
    },
  );
}
