/**
 * Identity service config.
 *
 * Read from environment. All required vars are validated at startup;
 * the process exits with a clear error if any are missing or invalid.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** JWT signing secret. Generate with: openssl rand -hex 32 */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ISSUER: z.string().default("aigarth-identity"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  /** Argon2id parameters. Tune based on your hardware. */
  ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(19_456),
  ARGON2_ITERATIONS: z.coerce.number().int().positive().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  /** Where to send verification / password-reset emails in dev (MailHog). */
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().email().default("hello@aigarth.local"),

  /** CORS allowlist. Comma-separated, or "*". */
  CORS_ORIGINS: z.string().default("*"),

  /** Cookie settings. */
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),

  /**
   * Internal service-to-service token. Required for callers hitting
   * `/v1/internal/*` (e.g. services/economy resolving wallet addresses
   * before settling a payout). MUST match the env var on the caller.
   * Default is the same dev placeholder as services/ann + services/training
   * use; rotate before any non-dev environment.
   */
  INTERNAL_TOKEN: z
    .string()
    .min(16, "INTERNAL_TOKEN must be at least 16 characters")
    .default("internal_dev_token_change_me"),
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
