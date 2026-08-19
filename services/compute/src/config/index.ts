/**
 * Compute service config.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7003),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  /** Must match identity service's JWT_SECRET. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  QUBIC_SERVICE_URL: z.string().url().default("http://localhost:7002"),

  JOB_BASE_FEE_QUBIC: z.coerce.bigint().nonnegative().default(1000n),
  JOB_COST_PER_MS_QUBIC: z.coerce.bigint().nonnegative().default(1n),
  RESERVATION_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(50),

  NATS_URL: z.string().default("nats://localhost:4222"),
  NATS_TX_SUBJECT: z.string().default("aigarth.qubic.tx"),
  NATS_JOB_SUBJECT: z.string().default("aigarth.compute.job"),

  DEFAULT_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  MAX_JOBS_PER_USER: z.coerce.number().int().positive().default(100),

  CORS_ORIGINS: z.string().default("*"),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),

  /**
   * Dev-only fallback for the QUBIC/USD price oracle (Phase 24). When
   * the `compute_qubic_usd_rates` table is empty, the service uses this
   * rate instead of refusing to charge. The value is the USD-per-QUBIC
   * rate scaled to 10 decimals (e.g. 0.0000004450 -> "4450000").
   * In production, leave this unset — the oracle worker should always
   * have populated the table before any reservation is created.
   */
  QUBIC_USD_FALLBACK_RATE_SCALED: z.string().regex(/^\d+$/).optional(),

  // ---------- Phase 24.3 — USD price oracle worker ----------
  QUBIC_USD_ORACLE_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(true),
  QUBIC_USD_ORACLE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  /** Comma-separated list of source URLs to query for the QUBIC/USD rate. */
  QUBIC_USD_ORACLE_SOURCES: z
    .string()
    .default("https://api.coingecko.com/api/v3/simple/price?ids=qubic&vs_currencies=usd,https://api.coinmarketcap.com/v1/ticker/qubic/"),
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
