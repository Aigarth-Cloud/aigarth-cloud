/**
 * Tissue service config.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7008),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity, ann, and gateway services. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  /** ANN service URL — the tissue calls each member's /decide endpoint here. */
  ANN_SERVICE_URL: z.string().url().default("http://localhost:7006"),

  /** Marketplace + billing service URLs (Phase 18E hooks). */
  MARKETPLACE_SERVICE_URL: z.string().url().default("http://localhost:7007"),
  BILLING_SERVICE_URL: z.string().url().default("http://localhost:7005"),

  /**
   * Phase 18E — internal service-to-service tokens. Must match
   * the values the marketplace and billing services are
   * configured with.
   */
  MARKETPLACE_INTERNAL_TOKEN: z
    .string()
    .min(16, "MARKETPLACE_INTERNAL_TOKEN must be at least 16 characters")
    .default("dev-only-marketplace-internal-token-rotate-in-prod"),
  BILLING_INTERNAL_TOKEN: z
    .string()
    .min(16, "BILLING_INTERNAL_TOKEN must be at least 16 characters")
    .default("dev-only-billing-internal-token-rotate-in-prod"),

  CORS_ORIGINS: z.string().default("*"),

  /**
   * Phase 18D — HMAC-SHA-256 signing key for the tissue-level
   * IntentEnvelope emitted by the /v1/tissues/:id/decide route.
   *
   * v1: a single env-var key shared across all tissues in this
   * service. v2: per-tissue keys loaded from a secrets manager.
   */
  TISSUE_SIGNING_KEY: z
    .string()
    .min(16, "TISSUE_SIGNING_KEY must be at least 16 characters")
    .default("dev-only-rotate-before-prod-please-do-not-use-this-key"),

  TISSUE_DEFAULT_AUTHORITY: z.coerce.number().min(0).max(1).default(0.5),
  TISSUE_MAX_MEMBERS: z.coerce.number().int().positive().default(20),
  TISSUE_DECISION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  /** Comma-separated user IDs with admin powers in this service. */
  TISSUE_ADMIN_USER_IDS: z
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
