/**
 * Training service config.
 *
 * Phase 19C. The recipe catalog + job runner hang off this config.
 * The compute bridge and ANN publisher settings are required at
 * boot; in stub mode the HTTP clients are not actually used, but
 * the values must still be present so tests can flip the mode
 * without a restart.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7011),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity, ann, gateway, dataset, and tissue services. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  CORS_ORIGINS: z.string().default("*"),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),

  /** Comma-separated list of user IDs (uuid) with admin powers in this service. */
  TRAINING_ADMIN_USER_IDS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),

  /**
   * 19C.4 — compute bridge.
   * `stub` keeps everything in-process; `http` talks to services/compute.
   * Same env var is reused for the ANN publisher (19C.6): we treat
   * both bridges symmetrically because they share an auth pattern.
   */
  TRAINING_COMPUTE_MODE: z.enum(["stub", "http"]).default("stub"),
  COMPUTE_BASE_URL: z.string().url().default("http://localhost:7003"),
  COMPUTE_INTERNAL_TOKEN: z.string().min(1).default("internal_dev_token_change_me"),

  /**
   * 19C.6 — auto-publish.
   * The ANN publisher uses TRAINING_COMPUTE_MODE for the same reason
   * (one switch for "are we stubbing downstream services or not").
   */
  TRAINING_ANN_BASE_URL: z.string().url().default("http://localhost:7006"),
  ANN_INTERNAL_TOKEN: z.string().min(1).default("internal_dev_token_change_me"),

  /**
   * 19C.5 — NATS pub/sub for SSE progress.
   * Optional: if NATS is unreachable, the service falls back to an
   * in-process EventEmitter so single-instance dev works without
   * the broker.
   */
  NATS_URL: z.string().default("nats://localhost:4222"),
  TRAINING_PROGRESS_SUBJECT: z.string().default("aigarth.training.progress"),

  /**
   * Worker tuning. v1 uses a single in-process worker; these knobs
   * are exposed so we can tune the poll loop without a redeploy.
   */
  TRAINING_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  TRAINING_PROGRESS_TICK_MS: z.coerce.number().int().positive().default(2000),

  /**
   * Phase 19D.2 — auto-retrain cron.
   *
   * `RETRAIN_SCAN_ENABLED` is true in production, false in tests. The
   * cron calls the ann service's `POST /v1/internal/anns/retrain-scan`
   * endpoint, which walks all opt-in ANNs and enqueues retraining
   * jobs where the trigger conditions are met. The training service
   * is just the cron caller; the trigger logic lives in the ann service.
   */
  RETRAIN_SCAN_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(true),
  /** Default: 6 hours. */
  RETRAIN_SCAN_INTERVAL_MS: z.coerce.number().int().positive().default(6 * 60 * 60 * 1000),
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
