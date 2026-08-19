/**
 * Qubic client factory.
 *
 * Picks the right implementation based on `QUBIC_CLIENT_MODE`:
 *   - "stub"  : in-memory mock (default for local dev / tests)
 *   - "http"  : JSON-over-HTTP gateway
 *   - "tcp"   : direct TCP to a Qubic node (NOT YET IMPLEMENTED — see TODO below)
 */

import { loadConfig } from "../config/index.js";
import { StubQubicClient } from "./stub.js";
import { HttpQubicClient } from "./http.js";
import type { QubicClient } from "./types.js";

let _client: QubicClient | null = null;

export function getQubicClient(): QubicClient {
  if (_client) return _client;
  const cfg = loadConfig();
  switch (cfg.QUBIC_CLIENT_MODE) {
    case "stub":
      _client = new StubQubicClient();
      break;
    case "http":
      _client = new HttpQubicClient({ baseURL: cfg.QUBIC_NODE_URL, timeoutMs: cfg.QUBIC_NODE_TIMEOUT_MS });
      break;
    case "tcp":
      throw new Error(
        "TCP client not implemented yet. See src/client/tcp-client.ts.TODO for protocol notes, " +
          "or set QUBIC_CLIENT_MODE=stub (dev) or http (gateway).",
      );
    default:
      throw new Error(`Unknown QUBIC_CLIENT_MODE: ${cfg.QUBIC_CLIENT_MODE as string}`);
  }
  return _client;
}

export { type QubicClient, type QubicBalance, type QubicTransaction, type QubicTickInfo, type QubicStakeIntent, type QubicBroadcastResult, type QubicComputor } from "./types.js";
