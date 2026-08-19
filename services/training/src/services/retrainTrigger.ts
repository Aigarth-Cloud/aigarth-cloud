/**
 * Phase 19D.2 — retrain cron client (training-service side).
 *
 * The training service hosts a `setInterval` cron that periodically
 * calls the ann service's `POST /v1/internal/anns/retrain-scan` endpoint.
 * The ann service owns the actual trigger logic and the event log;
 * the training service is just the cron caller.
 *
 * Why the split: keeping the trigger conditions and event log in
 * the ann service means the retrain story is fully ANN-scoped — a
 * future AigarthPool contract that mirrors retrain events on-chain
 * only needs to subscribe to one service.
 */

import { loadConfig } from "../config/index.js";

export interface RetrainScanResult {
  scanned: number;
  triggered: number;
  skipped: number;
  errors: number;
}

/**
 * Call the ann service's retrain-scan endpoint. Returns the counters
 * from the scan (scanned, triggered, skipped, errors). Throws if the
 * ann service is unreachable so the cron can log and retry on the
 * next tick.
 */
export async function runRetrainScan(): Promise<RetrainScanResult> {
  const cfg = loadConfig();
  const url = `${cfg.TRAINING_ANN_BASE_URL}/v1/internal/anns/retrain-scan`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.ANN_INTERNAL_TOKEN}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ann ${url} -> ${res.status} ${text}`.trim());
  }
  return (await res.json()) as RetrainScanResult;
}
