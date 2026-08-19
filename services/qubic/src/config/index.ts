/**
 * Qubic service config.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7002),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url().startsWith("postgres"),

  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:7001"),
  IDENTITY_SERVICE_TOKEN: z.string().optional(),

  /** Must match the identity service's JWT_SECRET for token verification. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  QUBIC_NETWORK: z.enum(["mainnet", "testnet"]).default("testnet"),
  QUBIC_NODE_URL: z.string().url().default("https://testnet-rpc.qubic.org"),
  QUBIC_NODE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  QUBIC_CLIENT_MODE: z.enum(["stub", "http", "tcp"]).default("stub"),

  /** Phase 23.3 (p3) — Qearn contract address. */
  QUBIC_QEARN_CONTRACT_ADDRESS: z.string().default("QEARN" + "A".repeat(55)),

  TREASURY_ADDRESS: z.string().regex(/^[A-Z]{60}$/).optional().or(z.literal("")),
  TREASURY_SEED: z.string().optional(),
  TREASURY_THRESHOLD: z.coerce.number().int().positive().default(3),
  /** Comma-separated list of signer Qubic addresses. */
  TREASURY_SIGNERS: z.string().default(""),

  NATS_URL: z.string().default("nats://localhost:4222"),
  NATS_TX_SUBJECT: z.string().default("aigarth.qubic.tx"),
  NATS_STAKE_SUBJECT: z.string().default("aigarth.qubic.stake"),
  /** Phase 23.3 (p3) — Qearn watcher publish target. */
  NATS_QEARN_SUBJECT: z.string().default("aigarth.qubic.qearn"),

  /**
   * Phase 23.3 (p3) — Qearn watcher. Polls the Qearn contract
   * address for transactions and persists a mirror in
   * `qubic_qearn_events`. Disable with `QEARN_WATCHER_ENABLED=false`.
   */
  QEARN_WATCHER_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(true),
  QEARN_WATCHER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),

  QUBIC_EPOCH_SECONDS: z.coerce.number().int().positive().default(604_800),
  QUBIC_EPOCHS_PER_YEAR: z.coerce.number().int().positive().default(52),
  QUBIC_TOTAL_SUPPLY_QUBIC: z.coerce.bigint().positive().default(1_000_000_000_000n),

  STAKE_COOLDOWN_EPOCHS: z.coerce.number().int().nonnegative().default(0),

  // ---------- AigarthPool (Phase 20) ----------
  /** Backend for the AigarthPool client: "simulator" (default) or "qpi". */
  AIGARTHPOOL_MODE: z.enum(["simulator", "qpi"]).default("simulator"),
  /** Qubic JSON-RPC URL of the AIO Dev Kit (or mainnet) — only used in "qpi" mode. */
  AIGARTHPOOL_RPC_URL: z.string().url().optional(),
  /** Deployed AigarthPool contract index — only used in "qpi" mode. */
  AIGARTHPOOL_CONTRACT_INDEX: z.coerce.number().int().nonnegative().optional(),
  /** Deployer key for the AigarthPool contract — only used in "qpi" mode. */
  AIGARTHPOOL_DEPLOYER_KEY: z.string().optional(),
  UNSTAKE_COOLDOWN_EPOCHS: z.coerce.number().int().nonnegative().default(1),

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
