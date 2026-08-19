/**
 * Economy service config.
 *
 * The off-chain economy sub-layer. Bridges:
 *   - services/ann (contributor shares per ANN)
 *   - services/billing (usage records drive payouts)
 *   - services/qubic (QUBIC settlement via Qearn + wallet transfers)
 *   - services/compute (compute grant driven by Qearn lock position)
 *
 * Per ADR 001, the economy module NEVER imports from `services/ann` etc.
 * as a peer — it consumes them via HTTP. The schema holds the off-chain
 * mirror of the on-chain state we observe (Qearn locks, payouts, etc.).
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7010),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity service's JWT_SECRET for token verification. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // Cross-service URLs
  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:7001"),
  QUBIC_SERVICE_URL: z.string().url().default("http://localhost:7002"),
  COMPUTE_SERVICE_URL: z.string().url().default("http://localhost:7003"),
  ANN_SERVICE_URL: z.string().url().default("http://localhost:7006"),
  MARKETPLACE_SERVICE_URL: z.string().url().default("http://localhost:7007"),
  BILLING_SERVICE_URL: z.string().url().default("http://localhost:7005"),

  // Qearn contract + procedures
  // 60-char A-Z. Default is the local stub placeholder (QEARN + 55 A's).
  // In prod, fetch from https://static.qubic.org/v1/general/data/smart_contracts.json
  QUBIC_QEARN_CONTRACT_ADDRESS: z
    .string()
    .regex(/^[A-Z]{60}$/)
    .default("QEARNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
  QEARN_LOCK_PROCEDURE_INDEX: z.coerce.number().int().nonnegative().default(1),
  QEARN_UNLOCK_PROCEDURE_INDEX: z.coerce.number().int().nonnegative().default(2),

  // Qearn watcher
  QEARN_WATCHER_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(true),
  QEARN_WATCHER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),

  // Economy defaults
  ECONOMY_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(1_000), // 10%
  ECONOMY_DEFAULT_LOOKBACK_DAYS: z.coerce.number().int().positive().default(7),

  // NATS
  NATS_URL: z.string().default("nats://localhost:4222"),
  NATS_ECONOMY_SUBJECT: z.string().default("aigarth.economy.payouts"),

  /**
   * Service-to-service token. Required for the resolver that calls
   * `/v1/internal/wallets/by-user/:userId` on services/identity before
   * settling a payout. MUST match the env var on services/identity.
   * Default is the same dev placeholder; rotate before non-dev.
   */
  INTERNAL_TOKEN: z
    .string()
    .min(16, "INTERNAL_TOKEN must be at least 16 characters")
    .default("internal_dev_token_change_me"),

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
