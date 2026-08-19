/**
 * Marketplace service config.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7007),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity service's JWT_SECRET. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:7001"),
  QUBIC_SERVICE_URL: z.string().url().default("http://localhost:7002"),
  COMPUTE_SERVICE_URL: z.string().url().default("http://localhost:7003"),
  GATEWAY_SERVICE_URL: z.string().url().default("http://localhost:7004"),
  BILLING_SERVICE_URL: z.string().url().default("http://localhost:7005"),
  ANN_SERVICE_URL: z.string().url().default("http://localhost:7006"),

  CORS_ORIGINS: z.string().default("*"),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),

  MKT_MAX_OFFERS_PER_LISTING: z.coerce.number().int().positive().default(200),
  MKT_DEFAULT_AUCTION_DURATION_HOURS: z.coerce.number().int().positive().default(24),
  MKT_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(250),
  MKT_ADMIN_USER_IDS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),

  /**
   * Phase 18E — internal-token gate for service-to-service
   * calls (e.g. tissue service incrementing the per-listing
   * decision counter). Must match the value the caller
   * (tissue service) is configured with.
   */
  MARKETPLACE_INTERNAL_TOKEN: z
    .string()
    .min(16, "MARKETPLACE_INTERNAL_TOKEN must be at least 16 characters")
    .default("dev-only-marketplace-internal-token-rotate-in-prod"),
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
