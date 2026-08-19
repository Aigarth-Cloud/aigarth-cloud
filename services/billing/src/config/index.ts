/**
 * Billing service config.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7005),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity service's JWT_SECRET. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:7001"),
  QUBIC_SERVICE_URL: z.string().url().default("http://localhost:7002"),
  COMPUTE_SERVICE_URL: z.string().url().default("http://localhost:7003"),
  GATEWAY_SERVICE_URL: z.string().url().default("http://localhost:7004"),
  ANN_SERVICE_URL: z.string().url().default("http://localhost:7006"),
  TISSUE_SERVICE_URL: z.string().url().default("http://localhost:7008"),

  TREASURY_ADDRESS: z.string().optional(),

  BILLING_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
  BILLING_DEFAULT_PAYMENT_METHOD: z.enum(["qubic", "credits", "fiat"]).default("qubic"),
  INVOICE_DUE_DAYS: z.coerce.number().int().positive().default(14),
  BILLING_GRACE_DAYS: z.coerce.number().int().positive().default(3),

  CORS_ORIGINS: z.string().default("*"),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),

  /**
   * Phase 18E — internal-token gate for service-to-service
   * calls. The tissue service uses this when POSTing usage
   * events to /v1/internal/tissue-usage.
   */
  BILLING_INTERNAL_TOKEN: z
    .string()
    .min(16, "BILLING_INTERNAL_TOKEN must be at least 16 characters")
    .default("dev-only-billing-internal-token-rotate-in-prod"),
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
