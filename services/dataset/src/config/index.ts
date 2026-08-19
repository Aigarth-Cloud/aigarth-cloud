/**
 * Dataset service config.
 *
 * Phase 19B. The schema and storage are the load-bearing primitives —
 * the rest of the service (catalog, connectors, SDK) hangs off this
 * config. See ADR 004 for the dataset ownership / licensing model.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7009),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity, ann, gateway, and tissue services. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  CORS_ORIGINS: z.string().default("*"),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),

  /**
   * Phase 19B.3 — S3-compatible object storage. Default values match
   * the local MinIO container in `infrastructure/docker-compose.yml`.
   * Override S3_ENDPOINT + S3_BUCKET for production (R2, AWS S3, etc.).
   */
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1).default("aigarth"),
  S3_ACCESS_KEY_ID: z.string().min(1).default("aigarth"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default("aigarth_dev_secret"),
  /** MinIO requires path-style; AWS S3 prefers virtual-host. Default true for MinIO. */
  S3_FORCE_PATH_STYLE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(true),

  /**
   * Phase 19B.3 — upload limits.
   *
   * `DATASET_MAX_UPLOAD_BYTES` is the hard cap on a single multipart
   * upload. Default 1 GiB. Larger datasets should be uploaded via the
   * connector framework (19B.5), not the HTTP route.
   *
   * `DATASET_SAMPLE_PEEK_BYTES` is how many bytes we read to infer the
   * schema. Default 1 MiB. Big enough for any sane CSV header or JSON
   * sample; small enough not to slow down the upload.
   */
  DATASET_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(1024 * 1024 * 1024),
  DATASET_SAMPLE_PEEK_BYTES: z.coerce.number().int().positive().default(1024 * 1024),

  /** Comma-separated list of user IDs (uuid) with admin powers in this service. */
  DATASET_ADMIN_USER_IDS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  cached = result.data;
  return cached;
}

/** Test-only: reset the cached config so unit tests can mutate env. */
export function __resetConfigForTests(): void {
  cached = null;
}
