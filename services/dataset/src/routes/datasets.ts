/**
 * /v1/datasets — dataset registry.
 *
 * Public (no auth):
 *   GET    /v1/datasets                 — list / search (status filter)
 *   GET    /v1/datasets/catalog         — public catalog (status=public)
 *   GET    /v1/datasets/:idOrSlug       — details
 *   GET    /v1/datasets/:idOrSlug/versions — version list
 *
 * Authenticated (JWT):
 *   POST   /v1/datasets                 — create
 *   PATCH  /v1/datasets/:idOrSlug       — update metadata
 *   POST   /v1/datasets/:idOrSlug/status — change status
 *
 * Authenticated + multipart:
 *   POST   /v1/datasets/:idOrSlug/versions — upload a new version
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createDataset,
  updateDataset,
  changeDatasetStatus,
  getDataset,
  listDatasets,
  listPublicCatalog,
  CreateDatasetSchema,
  UpdateDatasetSchema,
  ListDatasetsQuerySchema,
  DatasetStatusSchema,
  DatasetNotFoundError,
  DatasetForbiddenError,
  DatasetSlugCollisionError,
} from "../services/datasets.js";
import {
  listVersions,
  uploadVersion,
  CreateVersionSchema,
  DatasetVersionConflictError,
  DatasetUploadTooLargeError,
  DatasetEmptyUploadError,
} from "../services/versions.js";
import {
  createConnector,
  listConnectors,
  pauseConnector,
  resumeConnector,
  runConnector,
  CreateConnectorSchema,
  ListConnectorsQuerySchema,
  ConnectorNotFoundError,
} from "../services/connectors.js";
import { serializeDataset, serializeDatasetVersion } from "../lib/serialize.js";
import { loadConfig } from "../config/index.js";

export async function datasetRoutes(app: FastifyInstance) {
  // ---------- Public list (filterable) ----------

  app.get("/v1/datasets", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListDatasetsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const result = await listDatasets(parse.data);
    return reply.send({
      data: result.data.map(serializeDataset),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Public catalog ----------

  app.get("/v1/datasets/catalog", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListDatasetsQuerySchema.partial().safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const result = await listPublicCatalog({
      limit: parse.data.limit ?? 20,
      offset: parse.data.offset ?? 0,
      kind: parse.data.kind,
      license: parse.data.license,
      search: parse.data.search,
    });
    return reply.send({
      data: result.data.map(serializeDataset),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Public details ----------

  app.get("/v1/datasets/:idOrSlug", async (req: FastifyRequest, reply: FastifyReply) => {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const dataset = await getDataset(idOrSlug);
    if (!dataset) return reply.code(404).send({ error: { message: "Dataset not found" } });
    return reply.send(serializeDataset(dataset));
  });

  // ---------- Public version list ----------

  app.get(
    "/v1/datasets/:idOrSlug/versions",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug } = req.params as { idOrSlug: string };
      const dataset = await getDataset(idOrSlug);
      if (!dataset) return reply.code(404).send({ error: { message: "Dataset not found" } });
      const limit = Number((req.query as { limit?: string }).limit ?? 20);
      const offset = Number((req.query as { offset?: string }).offset ?? 0);
      const result = await listVersions(dataset.id, { limit, offset });
      return reply.send({
        data: result.data.map(serializeDatasetVersion),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  // ---------- Authenticated: create ----------

  app.post(
    "/v1/datasets",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateDatasetSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid body", issues: parse.error.issues } });
      }
      const callerUserId = req.user.sub;
      try {
        const created = await createDataset(callerUserId, parse.data);
        return reply.code(201).send(serializeDataset(created));
      } catch (e) {
        if (e instanceof DatasetSlugCollisionError) {
          return reply.code(409).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  // ---------- Authenticated: update ----------

  app.patch(
    "/v1/datasets/:idOrSlug",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug } = req.params as { idOrSlug: string };
      const parse = UpdateDatasetSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid body", issues: parse.error.issues } });
      }
      const callerUserId = req.user.sub;
      try {
        const updated = await updateDataset(callerUserId, idOrSlug, parse.data);
        return reply.send(serializeDataset(updated));
      } catch (e) {
        if (e instanceof DatasetNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        if (e instanceof DatasetForbiddenError) {
          return reply.code(403).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  // ---------- Authenticated: change status ----------

  app.post(
    "/v1/datasets/:idOrSlug/status",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug } = req.params as { idOrSlug: string };
      const body = req.body as { status?: string };
      const parse = DatasetStatusSchema.safeParse(body?.status);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid status", allowed: DatasetStatusSchema.options } });
      }
      const callerUserId = req.user.sub;
      try {
        const updated = await changeDatasetStatus(callerUserId, idOrSlug, parse.data);
        return reply.send(serializeDataset(updated));
      } catch (e) {
        if (e instanceof DatasetNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        if (e instanceof DatasetForbiddenError) {
          return reply.code(403).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  // ---------- Authenticated + multipart: upload version ----------

  app.post(
    "/v1/datasets/:idOrSlug/versions",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const cfg = loadConfig();
      const { idOrSlug } = req.params as { idOrSlug: string };
      const callerUserId = req.user.sub;

      // Multipart fields: `version` (text) and `file` (binary).
      // We buffer the whole upload into memory — bounded by
      // DATASET_MAX_UPLOAD_BYTES at the bodyLimit (see server.ts).
      let versionField: string | null = null;
      let changelogField: string | null = null;
      let fileBuffer: Buffer | null = null;
      let fileMime: string | undefined;

      const parts = req.parts({ limits: { fileSize: cfg.DATASET_MAX_UPLOAD_BYTES } });
      try {
        for await (const part of parts) {
          if (part.type === "field" && part.fieldname === "version") {
            versionField = String(part.value);
          } else if (part.type === "field" && part.fieldname === "changelog") {
            changelogField = String(part.value);
          } else if (part.type === "file" && part.fieldname === "file") {
            fileMime = part.mimetype;
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            fileBuffer = Buffer.concat(chunks);
          } else if (part.type === "file") {
            // Drain any extra files so the request closes cleanly.
            for await (const _ of part.file) {
              /* drain */
            }
          }
        }
      } catch (e) {
        // fastify-multipart throws RequestFileTooLargeError if the
        // limit is exceeded.
        if (
          (e as { code?: string })?.code === "FST_FILES_LIMIT" ||
          (e as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE"
        ) {
          return reply.code(413).send({
            error: {
              message: `Upload exceeds the maximum size of ${cfg.DATASET_MAX_UPLOAD_BYTES} bytes.`,
            },
          });
        }
        throw e;
      }

      if (!versionField) {
        return reply.code(400).send({ error: { message: "Missing 'version' field" } });
      }
      const versionParse = CreateVersionSchema.safeParse({ version: versionField, changelog: changelogField ?? undefined });
      if (!versionParse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid version", issues: versionParse.error.issues } });
      }
      if (!fileBuffer) {
        return reply.code(400).send({ error: { message: "Missing 'file' part" } });
      }

      try {
        const { version: row, created } = await uploadVersion({
          callerUserId,
          datasetIdOrSlug: idOrSlug,
          version: versionParse.data.version,
          bytes: fileBuffer,
          contentType: fileMime,
          changelog: versionParse.data.changelog,
        });
        return reply
          .code(created ? 201 : 200)
          .send(serializeDatasetVersion(row));
      } catch (e) {
        if (e instanceof DatasetNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        if (e instanceof DatasetForbiddenError) {
          return reply.code(403).send({ error: { message: e.message } });
        }
        if (e instanceof DatasetVersionConflictError) {
          return reply.code(409).send({ error: { message: e.message } });
        }
        if (e instanceof DatasetUploadTooLargeError) {
          return reply.code(413).send({ error: { message: e.message } });
        }
        if (e instanceof DatasetEmptyUploadError) {
          return reply.code(400).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  // ---------- Connectors (Phase 19B.5) ----------

  // List connectors for a dataset (auth: owner only)
  app.get(
    "/v1/datasets/:idOrSlug/connectors",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug } = req.params as { idOrSlug: string };
      const dataset = await getDataset(idOrSlug);
      if (!dataset) return reply.code(404).send({ error: { message: "Dataset not found" } });
      if (dataset.ownerUserId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Only the dataset owner can list connectors" } });
      }
      const parse = ListConnectorsQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
      }
      const rows = await listConnectors(dataset.id, parse.data);
      return reply.send({ data: rows });
    },
  );

  // Create a connector
  app.post(
    "/v1/datasets/:idOrSlug/connectors",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug } = req.params as { idOrSlug: string };
      const dataset = await getDataset(idOrSlug);
      if (!dataset) return reply.code(404).send({ error: { message: "Dataset not found" } });
      if (dataset.ownerUserId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Only the dataset owner can create connectors" } });
      }
      const parse = CreateConnectorSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid body", issues: parse.error.issues } });
      }
      const created = await createConnector(req.user.sub, dataset.id, parse.data);
      return reply.code(201).send(created);
    },
  );

  // Pause / resume / sync
  app.post(
    "/v1/datasets/:idOrSlug/connectors/:connectorId/pause",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug, connectorId } = req.params as { idOrSlug: string; connectorId: string };
      const dataset = await getDataset(idOrSlug);
      if (!dataset) return reply.code(404).send({ error: { message: "Dataset not found" } });
      if (dataset.ownerUserId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Only the dataset owner can pause a connector" } });
      }
      try {
        const updated = await pauseConnector(req.user.sub, connectorId);
        return reply.send(updated);
      } catch (e) {
        if (e instanceof ConnectorNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  app.post(
    "/v1/datasets/:idOrSlug/connectors/:connectorId/resume",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug, connectorId } = req.params as { idOrSlug: string; connectorId: string };
      const dataset = await getDataset(idOrSlug);
      if (!dataset) return reply.code(404).send({ error: { message: "Dataset not found" } });
      if (dataset.ownerUserId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Only the dataset owner can resume a connector" } });
      }
      try {
        const updated = await resumeConnector(req.user.sub, connectorId);
        return reply.send(updated);
      } catch (e) {
        if (e instanceof ConnectorNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  // Manual sync trigger. Runs the connector once, returns the
  // resulting version (or error message).
  app.post(
    "/v1/datasets/:idOrSlug/connectors/:connectorId/sync",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { idOrSlug, connectorId } = req.params as { idOrSlug: string; connectorId: string };
      const dataset = await getDataset(idOrSlug);
      if (!dataset) return reply.code(404).send({ error: { message: "Dataset not found" } });
      if (dataset.ownerUserId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Only the dataset owner can sync a connector" } });
      }
      const result = await runConnector(connectorId);
      if (!result.ok) {
        return reply.code(502).send({ ok: false, error: result.error });
      }
      return reply.send({ ok: true, version_id: result.versionId });
    },
  );
}
