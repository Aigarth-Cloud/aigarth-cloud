/**
 * Gateway service config.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7004),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity service's JWT_SECRET. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:7001"),
  COMPUTE_SERVICE_URL: z.string().url().default("http://localhost:7003"),
  /** Phase 18C — URL of the ANN service, used when intent='trinary'. */
  ANN_SERVICE_URL: z.string().url().default("http://localhost:7006"),

  // Pricing in QUBIC (smallest unit) per 1K tokens
  GATEWAY_CHAT_INPUT_COST_QUBIC: z.coerce.bigint().nonnegative().default(10n),
  GATEWAY_CHAT_OUTPUT_COST_QUBIC: z.coerce.bigint().nonnegative().default(30n),
  GATEWAY_EMBED_COST_QUBIC: z.coerce.bigint().nonnegative().default(1n),
  GATEWAY_IMAGE_COST_QUBIC: z.coerce.bigint().nonnegative().default(100n),
  /** Phase 18C — flat fee in QUBIC per trinary decision. */
  GATEWAY_TRINARY_DECISION_COST_QUBIC: z.coerce.bigint().nonnegative().default(5n),

  GATEWAY_RPM_LIMIT: z.coerce.number().int().positive().default(60),
  GATEWAY_TPM_LIMIT: z.coerce.number().int().positive().default(100_000),

  GATEWAY_AVG_CHARS_PER_TOKEN: z.coerce.number().int().positive().default(4),

  CORS_ORIGINS: z.string().default("*"),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),
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
