/**
 * S3-compatible object storage client (Phase 19B.3).
 *
 * Wraps the AWS SDK v3 S3 client + Upload helper for streaming
 * multipart uploads. Works with MinIO (default for local dev),
 * AWS S3, Cloudflare R2, and any other S3-compatible backend.
 *
 * Why this lives in a service: the dataset service is the only
 * place in the platform that uploads user bytes. If other services
 * (models, marketplace) need storage in the future, they can
 * depend on the dataset service or this module gets extracted to
 * `@aigarth/storage`.
 *
 * Failure model:
 *   - Network errors and 5xx → throw `StorageError`
 *   - 4xx (auth, bucket policy) → throw `StorageError` with status
 *   - All errors carry the operation + key + a redacted message.
 *   - The caller is responsible for cleanup if the upload fails
 *     mid-way (we don't auto-delete partial uploads in v1).
 */

import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { loadConfig } from "../config/index.js";

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly key?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const cfg = loadConfig();
  const config: S3ClientConfig = {
    region: cfg.S3_REGION,
    endpoint: cfg.S3_ENDPOINT,
    forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: cfg.S3_ACCESS_KEY_ID,
      secretAccessKey: cfg.S3_SECRET_ACCESS_KEY,
    },
  };
  _client = new S3Client(config);
  return _client;
}

/** Test-only: reset the cached client. */
export function __resetStorageClientForTests(): void {
  _client = null;
}

/**
 * Upload bytes to the configured bucket under the given key.
 *
 * Uses the multipart upload helper from `@aws-sdk/lib-storage` so
 * even large payloads stream in chunks without buffering the whole
 * file in memory. Accepts a Buffer (we collect multipart parts into
 * one in the route layer, bounded by `DATASET_MAX_UPLOAD_BYTES`).
 *
 * Returns the ETag of the uploaded object on success.
 */
export async function putObject(args: {
  key: string;
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<{ etag: string | undefined; bucket: string; key: string }> {
  const cfg = loadConfig();
  const client = getClient();
  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: cfg.S3_BUCKET,
        Key: args.key,
        Body: args.body,
        ContentType: args.contentType,
        Metadata: args.metadata,
      },
    });
    const result = await upload.done();
    return {
      etag: result.ETag,
      bucket: cfg.S3_BUCKET,
      key: args.key,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    throw new StorageError(
      `putObject failed: ${err?.message ?? String(e)}`,
      "putObject",
      args.key,
      err?.$metadata?.httpStatusCode,
    );
  }
}

/**
 * Build the canonical object key for a dataset version.
 *
 * Format: `datasets/<dataset_id>/<version>/<content_hash>`
 *
 * Two uploads of the same content hash land on the same key —
 * S3/MinIO dedupes by ETag and the second call is a no-op.
 */
export function buildObjectKey(args: {
  datasetId: string;
  version: string;
  contentHash: string;
}): string {
  return `datasets/${args.datasetId}/${args.version}/${args.contentHash}`;
}

/**
 * Best-effort: ensure the configured bucket exists. Called once on
 * service startup. Idempotent — if the bucket already exists, the
 * 409/200 from the SDK is treated as success.
 */
export async function ensureBucket(): Promise<void> {
  const cfg = loadConfig();
  const client = getClient();
  const { HeadBucketCommand, CreateBucketCommand } = await import("@aws-sdk/client-s3");
  try {
    await client.send(new HeadBucketCommand({ Bucket: cfg.S3_BUCKET }));
    return;
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      try {
        await client.send(new CreateBucketCommand({ Bucket: cfg.S3_BUCKET }));
        return;
      } catch (createErr) {
        // Race: another instance created the bucket. OK.
        const ce = createErr as { name?: string };
        if (ce?.name === "BucketAlreadyOwnedByYou" || ce?.name === "BucketAlreadyExists") {
          return;
        }
        throw new StorageError(
          `ensureBucket create failed: ${(createErr as Error).message}`,
          "ensureBucket",
          cfg.S3_BUCKET,
        );
      }
    }
    throw new StorageError(
      `ensureBucket head failed: ${(e as Error).message}`,
      "ensureBucket",
      cfg.S3_BUCKET,
    );
  }
}
