/**
 * USD price oracle worker — Phase 24.3.
 *
 * Polls external price sources (CoinGecko + CoinMarketCap by default)
 * every 60s, computes the median, and writes a row to
 * `compute_qubic_usd_rates`. The node-reservations service reads the
 * most recent row and refuses to charge if it's >5 minutes stale.
 *
 * Failure mode: if all sources fail, the worker logs and retries on
 * the next interval. The previous rate in the table is unaffected,
 * so reservations keep working against the last known good rate
 * until the staleness check kicks in (after 5 minutes).
 *
 * Run: `pnpm --filter @aigarth/compute worker:usd-price-oracle`
 * Disable: set `QUBIC_USD_ORACLE_ENABLED=false` in services/compute/.env.
 */

import { closeDb } from "../db/index.js";
import { recordQubicUsdRate } from "../services/node-reservations.js";
import { loadConfig } from "../config/index.js";

const log = (level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](
    JSON.stringify({ ts: new Date().toISOString(), level, service: "usd-price-oracle", msg, ...extra }),
  );
};

const SOURCE_TIMEOUT_MS = 8_000;

interface SourceResult {
  source: string;
  rateUsdPerQubic: number | null;
  error?: string;
}

/**
 * Fetch the QUBIC/USD rate from a single source URL. The convention is
 * that the response body contains a `rate` field with the rate as a
 * float, or a nested structure we can navigate. This is intentionally
 * simple — each source URL handler is hand-rolled below.
 */
async function fetchFromSource(url: string, signal: AbortSignal): Promise<SourceResult> {
  const host = new URL(url).hostname;
  try {
    const res = await fetch(url, { signal, headers: { "user-agent": "aigarth-usd-price-oracle/1.0" } });
    if (!res.ok) {
      return { source: host, rateUsdPerQubic: null, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as unknown;
    if (host.includes("coingecko")) {
      // /simple/price?ids=qubic&vs_currencies=usd
      // -> { "qubic": { "usd": 0.0000004450 } }
      const r =
        typeof body === "object" && body !== null
          ? (body as { qubic?: { usd?: unknown } }).qubic?.usd
          : undefined;
      if (typeof r === "number" && r > 0) return { source: "coingecko", rateUsdPerQubic: r };
      return { source: "coingecko", rateUsdPerQubic: null, error: "missing qubic.usd" };
    }
    if (host.includes("coinmarketcap")) {
      // /v1/ticker/qubic/ (legacy v1)
      // -> [ { "price_usd": "0.0000004450", ... } ]
      const row = Array.isArray(body)
        ? (body[0] as { price_usd?: unknown; price?: unknown } | undefined)
        : (body as { 0?: { price_usd?: unknown; price?: unknown } })[0];
      const r = row?.price_usd ?? row?.price;
      if (typeof r === "string" || typeof r === "number") {
        const f = Number(r);
        if (f > 0) return { source: "coinmarketcap", rateUsdPerQubic: f };
      }
      return { source: "coinmarketcap", rateUsdPerQubic: null, error: "missing price_usd" };
    }
    return { source: host, rateUsdPerQubic: null, error: "unknown source shape" };
  } catch (e) {
    return { source: host, rateUsdPerQubic: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function pollOnce(): Promise<{ ok: boolean; recorded?: bigint; sources: SourceResult[] }> {
  const cfg = loadConfig();
  const sources = cfg.QUBIC_USD_ORACLE_SOURCES.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const results = await Promise.all(
    sources.map((url) => {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), SOURCE_TIMEOUT_MS);
      return fetchFromSource(url, ac.signal).finally(() => clearTimeout(timer));
    }),
  );
  const good = results.filter((r): r is SourceResult & { rateUsdPerQubic: number } =>
    typeof r.rateUsdPerQubic === "number" && r.rateUsdPerQubic > 0,
  );
  if (good.length === 0) {
    return { ok: false, sources: results };
  }
  // Median of the good rates.
  const sorted = good.map((r) => r.rateUsdPerQubic).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  // Scale to 10 decimals (round to nearest integer).
  const rateScaled = BigInt(Math.round(median * 1e10));
  const recorded = await recordQubicUsdRate({
    rateScaled,
    source: good.length === 1 ? good[0]!.source : `median(${good.map((g) => g.source).join("+")})`,
    rateRaw: median.toString(),
  });
  return { ok: true, recorded: rateScaled, sources: results };
}

async function main() {
  const cfg = loadConfig();
  if (!cfg.QUBIC_USD_ORACLE_ENABLED) {
    log("info", "oracle disabled (QUBIC_USD_ORACLE_ENABLED=false). Exiting.");
    return;
  }
  log("info", "starting", {
    pollIntervalMs: cfg.QUBIC_USD_ORACLE_POLL_INTERVAL_MS,
    sources: cfg.QUBIC_USD_ORACLE_SOURCES.split(",").length,
  });
  let stopping = false;
  const stop = (sig: "SIGINT" | "SIGTERM") => {
    if (stopping) return;
    stopping = true;
    log("info", `received ${sig}, shutting down`);
    closeDb().finally(() => process.exit(0));
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  while (!stopping) {
    const start = Date.now();
    try {
      const r = await pollOnce();
      if (r.ok) {
        const scaled = r.recorded!;
        const usd = Number(scaled) / 1e10;
        log("info", "recorded", { rateUsdPerQubic: usd, sources: r.sources.length });
      } else {
        log("warn", "all sources failed", { sources: r.sources.map((s) => ({ source: s.source, error: s.error })) });
      }
    } catch (e) {
      log("error", "poll error", { error: e instanceof Error ? e.message : String(e) });
    }
    const elapsed = Date.now() - start;
    const wait = Math.max(0, cfg.QUBIC_USD_ORACLE_POLL_INTERVAL_MS - elapsed);
    if (wait > 0 && !stopping) await new Promise((r) => setTimeout(r, wait));
  }
}

// Exported for tests.
export { pollOnce, fetchFromSource };

// Run when invoked directly.
if (
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("usd-price-oracle.ts") ||
  process.argv[1]?.endsWith("usd-price-oracle.js")
) {
  main().catch((e) => {
    log("error", "fatal", { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  });
}
