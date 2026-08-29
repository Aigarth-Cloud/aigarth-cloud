/**
 * ANN service config.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7006),
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
  /**
   * Phase 19D.2 — training service URL, used by the auto-retrain
   * cron + manual retrain trigger to enqueue a training job.
   */
  TRAINING_SERVICE_URL: z.string().url().default("http://localhost:7011"),
  /**
   * Phase 19D.2 — internal token used to authenticate the ann → training
   * service call. Matches TRAINING_ANN_INTERNAL_TOKEN in services/training.
   * v1: a shared dev secret. v2: per-service mTLS.
   */
  TRAINING_INTERNAL_TOKEN: z
    .string()
    .min(16, "TRAINING_INTERNAL_TOKEN must be at least 16 characters")
    .default("internal_dev_token_change_me"),

  // ---------- AigarthPool (Phase 20) ----------
  /** Backend for the AigarthPool client: "simulator" (default) or "qpi". */
  AIGARTHPOOL_MODE: z.enum(["simulator", "qpi"]).default("simulator"),
  /** Qubic JSON-RPC URL — only used in "qpi" mode. */
  AIGARTHPOOL_RPC_URL: z.string().url().optional(),
  /** Deployed AigarthPool contract index — only used in "qpi" mode. */
  AIGARTHPOOL_CONTRACT_INDEX: z.coerce.number().int().nonnegative().optional(),
  /** Deployer key — only used in "qpi" mode. */
  AIGARTHPOOL_DEPLOYER_KEY: z.string().optional(),

  CORS_ORIGINS: z.string().default("*"),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),

  ANN_DEFAULT_LICENSE_SLUG: z.string().default("open"),
  ANN_MAX_VERSIONS_PER_ANN: z.coerce.number().int().positive().default(200),
  ANN_DEFAULT_REPLICAS: z.coerce.number().int().positive().default(1),

  /**
   * Phase 18B — HMAC-SHA-256 signing key used to sign every trinary
   * IntentEnvelope emitted by the /v1/anns/:id/decide route.
   *
   * v1: a single env-var key shared across all ANNs in this service.
   * v2: per-ANN keys loaded from a secrets manager (KMS, Vault, ...).
   *
   * Must be at least 32 chars in production. The dev `.env` provides
   * a deterministic placeholder so the local stack always boots.
   */
  ANN_TRINARY_SIGNING_KEY: z
    .string()
    .min(16, "ANN_TRINARY_SIGNING_KEY must be at least 16 characters")
    .default("dev-only-rotate-before-prod-please-do-not-use-this-key"),

  /**
   * Phase 19C.3 — which trinary model backend to use.
   *
   * `stub`              — deterministic hash backend, no model required.
   *                        Default. Safe for local dev, CI, and demos.
   * `openai_compatible` — any OpenAI-shaped chat-completions server
   *                        (OpenAI, Ollama, LM Studio, vLLM, ...).
   *                        Requires ANN_LLM_BASE_URL + ANN_LLM_MODEL.
   */
  ANN_LLM_BACKEND: z.enum(["stub", "openai_compatible"]).default("stub"),

  /**
   * Phase 19C.3 — base URL of the OpenAI-compatible server.
   *
   * Examples:
   *   OpenAI:    https://api.openai.com/v1
   *   Ollama:    http://localhost:11434/v1
   *   LM Studio: http://localhost:1234/v1
   *   vLLM:      http://localhost:8000/v1
   */
  ANN_LLM_BASE_URL: z.string().url().default("http://localhost:11434/v1"),

  /**
   * Phase 19C.3 — model name to request from the backend.
   * (e.g. "gpt-4o-mini", "llama3.1", "qwen2.5:7b-instruct", ...).
   */
  ANN_LLM_MODEL: z.string().min(1).default("llama3.1"),

  /**
   * Phase 19C.3 — optional API key. Sent as `Authorization: Bearer ...`.
   * Leave empty for local servers (Ollama, LM Studio) that don't require auth.
   */
  ANN_LLM_API_KEY: z.string().default(""),

  /**
   * Phase 19C.3 — per-request timeout in milliseconds. If the model
   * doesn't respond in this window, the call fails fast and the caller
   * substitutes a neutral envelope. Default 8s.
   */
  ANN_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),

  /**
   * Phase 19C.3 — max tokens in the model's response. The contract
   * is small (a single JSON object), so 512 is plenty. Larger values
   * waste latency and quota.
   */
  ANN_LLM_MAX_TOKENS: z.coerce.number().int().positive().default(512),

  /**
   * Phase 19C.3 — sampling temperature. 0.0 = deterministic. The
   * trinary decision is meant to be a calibrated judgment, not a
   * creative output, so the default is 0.0. Raise to 0.2-0.4 if you
   * want a model to explore.
   */
  ANN_LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.0),

  /** Comma-separated list of user IDs (uuid) that have platform-admin powers in this service. */
  ANN_ADMIN_USER_IDS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),

  // ---------- Phase 29 — Execution Router ----------
  //
  // The QubicOCExecutor submits work items to services/work. The
  // INTERNAL_TOKEN must match the work service's value; the dev
  // default is the shared "internal_dev_token_change_me" placeholder
  // (AGENTS.md §1 — rotate before any non-dev deployment).

  /** services/work base URL. */
  WORK_SERVICE_URL: z.string().url().default("http://localhost:7012"),

  /** Internal token used when calling /v1/internal/work/items. */
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
