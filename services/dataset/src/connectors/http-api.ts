/**
 * HTTP API connector (Phase 19B.5).
 *
 * The one connector kind shipped in v1. Polls a URL with an
 * optional auth header, downloads the response body, and writes
 * a new dataset_version with the bytes. The dataset_service's
 * existing `uploadVersion` function does the hashing + storage +
 * schema sniffing — this connector just provides the bytes.
 *
 * Config shape (validated by `HttpApiConfigSchema`):
 *
 *   {
 *     url: string,                    // required
 *     auth_header?: string,           // e.g. "Bearer sk-..."
 *     content_type?: string,          // override the inferred mime type
 *     poll_interval_seconds?: number, // reserved; v1 doesn't auto-poll
 *   }
 *
 * Failure model: any HTTP error or non-2xx is surfaced to the
 * caller, which persists `last_error` on the connector row.
 */

import { z } from "zod";
import { uploadVersion } from "../services/versions.js";

export const HttpApiConfigSchema = z.object({
  url: z.string().url(),
  auth_header: z.string().min(1).max(500).optional(),
  content_type: z.string().min(1).max(120).optional(),
  poll_interval_seconds: z.number().int().positive().max(86_400).optional(),
});
export type HttpApiConfig = z.infer<typeof HttpApiConfigSchema>;

/**
 * Run the HTTP API connector once. Downloads the body, computes a
 * version label (the ISO timestamp + content hash prefix), and
 * calls `uploadVersion` to persist.
 *
 * The caller (the connectors service) passes the dataset's
 * `owner_user_id` so the upload is attributed to the same person
 * who owns the dataset.
 */
export async function runHttpApiConnector(
  datasetId: string,
  ownerUserId: string,
  config: HttpApiConfig,
): Promise<{ versionId: string }> {
  const headers: Record<string, string> = {};
  if (config.auth_header) headers.Authorization = config.auth_header;
  if (config.content_type) headers.Accept = config.content_type;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000); // 1 minute
  let res: Response;
  try {
    res = await fetch(config.url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string })?.name === "AbortError") {
      throw new Error(`HTTP request to ${config.url} timed out after 60s`);
    }
    throw new Error(`HTTP request to ${config.url} failed: ${(e as Error).message}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${config.url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const contentType = config.content_type ?? res.headers.get("content-type") ?? undefined;

  // Version label: the dataset's existing versions are semver
  // — but the connector doesn't have a natural source for a
  // semver bump. We use the SHA-256 prefix of the downloaded
  // bytes (first 8 hex chars) as a build-metadata tag. v1
  // uses `auto.<timestamp>` for simplicity; v2 will compute
  // the next semver from the existing versions.
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 8);

  const result = await uploadVersion({
    callerUserId: ownerUserId,
    datasetIdOrSlug: datasetId,
    version: `auto.${Date.now()}.${hash}`,
    bytes,
    contentType,
  });

  return { versionId: result.version.id };
}
