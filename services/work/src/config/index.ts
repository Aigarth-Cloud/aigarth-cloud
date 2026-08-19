/**
 * Work service config.
 *
 * Mirrors @aigarth/tissue config shape. Adds Work Runtime
 * specifics: WORK_LEASE_DURATION_MS, WORK_HEARTBEAT_INTERVAL_MS,
 * WORK_OFFLINE_AFTER_MS, WORKER_DEFAULT_CONCURRENCY_CAP, etc.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7012),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity, ann, tissue, and gateway services. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  /** Cross-service URLs. */
  ANN_SERVICE_URL: z.string().url().default("http://localhost:7006"),
  BILLING_SERVICE_URL: z.string().url().default("http://localhost:7005"),

  /**
   * Phase 18 closeout — internal service-to-service token. Must
   * match the value identity and economy services are configured
   * with.
   */
  INTERNAL_TOKEN: z
    .string()
    .min(16, "INTERNAL_TOKEN must be at least 16 characters")
    .default("internal_dev_token_change_me"),

  CORS_ORIGINS: z.string().default("*"),

  /**
   * Phase 27 — HMAC-SHA-256 signing key for the work-item
   * envelope and the algorithm container signature.
   *
   * v1: a single env-var key shared across the whole service.
   * v2: per-algorithm keys loaded from a secrets manager.
   */
  WORK_SIGNING_KEY: z
    .string()
    .min(16, "WORK_SIGNING_KEY must be at least 16 characters")
    .default("dev-only-rotate-before-prod-please-do-not-use-this-key"),

  /** Worker lease / heartbeat defaults (ADR 006 §5 + PEP §12). */
  WORK_LEASE_DURATION_MS: z.coerce.number().int().positive().default(30_000),
  WORK_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  WORK_OFFLINE_AFTER_MS: z.coerce.number().int().positive().default(30_000),
  WORKER_DEFAULT_CONCURRENCY_CAP: z.coerce.number().int().positive().default(2),
  WORKER_HARD_MAX_CONCURRENCY: z.coerce.number().int().positive().default(5),
  REPUTATION_DECAY_MALICIOUS: z.coerce.number().min(0).max(1).default(0.1),
  REPUTATION_FLOOR: z.coerce.number().min(0).max(1).default(0.5),

  /** Background loop intervals. */
  SCHEDULER_TICK_MS: z.coerce.number().int().positive().default(5_000),
  CHALLENGER_TICK_MS: z.coerce.number().int().positive().default(60_000),
  CHALLENGE_RATIO: z.coerce.number().min(0).max(1).default(0.01),
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

/** Test-only: reset the config cache so test setups can mutate env. */
export function _resetConfigForTests(): void {
  cached = null;
}
