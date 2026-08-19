/**
 * Connector framework (Phase 19B.5).
 *
 * A connector is a background poller that pulls data from an
 * external source and writes a new dataset_version on each sync.
 * v1 ships one kind: `http_api` (poll a URL with an optional auth
 * header, write the response body as a new version).
 *
 * The framework is intentionally small. Each connector kind is a
 * module under `src/connectors/<kind>.ts` that exports a single
 * `run()` function. Adding a new kind is a 30-line module + a line
 * in the dispatch switch below.
 *
 * Failure model: connector errors are persisted in `last_error` and
 * surfaced via the API. A failing connector never crashes the
 * service. The owner can pause it via `POST /:id/pause`.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { datasetConnectors, datasets, type DatasetConnector } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { runHttpApiConnector, HttpApiConfigSchema, type HttpApiConfig } from "../connectors/http-api.js";

// ---------- Public schemas ----------

export const CreateConnectorSchema = z.object({
  kind: z.literal("http_api"),
  name: z.string().min(1).max(80).optional(),
  config: HttpApiConfigSchema,
});
export type CreateConnectorInput = z.infer<typeof CreateConnectorSchema>;

export const ListConnectorsQuerySchema = z.object({
  status: z.enum(["active", "paused", "error"]).optional(),
});
export type ListConnectorsQuery = z.infer<typeof ListConnectorsQuerySchema>;

// ---------- Errors ----------

export class ConnectorNotFoundError extends Error {
  constructor(id: string) {
    super(`Connector '${id}' not found.`);
    this.name = "ConnectorNotFoundError";
  }
}

export class ConnectorUnsupportedKindError extends Error {
  constructor(kind: string) {
    super(`Connector kind '${kind}' is not supported in this build.`);
    this.name = "ConnectorUnsupportedKindError";
  }
}

// ---------- Mutations ----------

export async function createConnector(
  callerUserId: string,
  datasetId: string,
  input: CreateConnectorInput,
): Promise<DatasetConnector> {
  const db = getDb();
  const id = uid();
  const name = input.name ?? `${input.kind}-${id.slice(0, 8)}`;
  await db.insert(datasetConnectors).values({
    id,
    datasetId,
    kind: input.kind,
    name,
    configJson: input.config as unknown as Record<string, unknown>,
    status: "active",
    lastError: null,
    lastSyncAt: null,
    lastSyncVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [row] = await db
    .select()
    .from(datasetConnectors)
    .where(eq(datasetConnectors.id, id))
    .limit(1);
  if (!row) throw new Error("Connector inserted but not found");
  void callerUserId; // reserved for audit log
  return row;
}

export async function pauseConnector(_callerUserId: string, connectorId: string): Promise<DatasetConnector> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(datasetConnectors)
    .where(eq(datasetConnectors.id, connectorId))
    .limit(1);
  if (!row) throw new ConnectorNotFoundError(connectorId);
  await db
    .update(datasetConnectors)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(datasetConnectors.id, connectorId));
  const [updated] = await db
    .select()
    .from(datasetConnectors)
    .where(eq(datasetConnectors.id, connectorId))
    .limit(1);
  if (!updated) throw new ConnectorNotFoundError(connectorId);
  return updated;
}

export async function resumeConnector(_callerUserId: string, connectorId: string): Promise<DatasetConnector> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(datasetConnectors)
    .where(eq(datasetConnectors.id, connectorId))
    .limit(1);
  if (!row) throw new ConnectorNotFoundError(connectorId);
  await db
    .update(datasetConnectors)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(datasetConnectors.id, connectorId));
  const [updated] = await db
    .select()
    .from(datasetConnectors)
    .where(eq(datasetConnectors.id, connectorId))
    .limit(1);
  if (!updated) throw new ConnectorNotFoundError(connectorId);
  return updated;
}

// ---------- Reads ----------

export async function listConnectors(
  datasetId: string,
  query: ListConnectorsQuery = {},
): Promise<DatasetConnector[]> {
  const db = getDb();
  if (query.status) {
    return db
      .select()
      .from(datasetConnectors)
      .where(eq(datasetConnectors.datasetId, datasetId) && eq(datasetConnectors.status, query.status)
        ? undefined
        : undefined)
      .limit(0);
  }
  return db
    .select()
    .from(datasetConnectors)
    .where(eq(datasetConnectors.datasetId, datasetId))
    .limit(100);
}

export async function getConnector(connectorId: string): Promise<DatasetConnector | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(datasetConnectors)
    .where(eq(datasetConnectors.id, connectorId))
    .limit(1);
  return row ?? null;
}

// ---------- Dispatch ----------

/**
 * Run a connector once. The caller is the API layer (for a manual
 * "sync now" trigger) or a future cron (for scheduled polling).
 *
 * For v1, this is a synchronous one-shot. A v2 cron will iterate
 * active connectors and call this with a small jitter.
 */
export async function runConnector(connectorId: string): Promise<{
  ok: boolean;
  versionId?: string;
  error?: string;
}> {
  const row = await getConnector(connectorId);
  if (!row) throw new ConnectorNotFoundError(connectorId);
  if (row.status === "paused") {
    return { ok: false, error: "Connector is paused" };
  }

  const db = getDb();
  const now = new Date();
  try {
    let result: { versionId: string };
    switch (row.kind) {
      case "http_api":
        // Look up the dataset's owner so the connector run is
        // attributed to the same person who owns the dataset.
        const [ds] = await db
          .select({ ownerUserId: datasets.ownerUserId })
          .from(datasets)
          .where(eq(datasets.id, row.datasetId))
          .limit(1);
        if (!ds) {
          throw new Error(`Dataset ${row.datasetId} not found for connector ${connectorId}`);
        }
        result = await runHttpApiConnector(
          row.datasetId,
          ds.ownerUserId,
          row.configJson as unknown as HttpApiConfig,
        );
        break;
      default:
        throw new ConnectorUnsupportedKindError(row.kind);
    }
    await db
      .update(datasetConnectors)
      .set({
        status: "active",
        lastError: null,
        lastSyncAt: now,
        lastSyncVersionId: result.versionId,
        updatedAt: now,
      })
      .where(eq(datasetConnectors.id, connectorId));
    return { ok: true, versionId: result.versionId };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    await db
      .update(datasetConnectors)
      .set({ status: "error", lastError: msg, updatedAt: now })
      .where(eq(datasetConnectors.id, connectorId));
    return { ok: false, error: msg };
  }
}
