/**
 * Billing + accountant hooks — Phase 27.
 *
 * Mirrors services/tissue/src/services/billingHook.ts.
 *
 * The accountant calls `reportWorkUsage` on every verified work
 * item. Best-effort: failures are logged, never block the
 * response. The accountant has its own idempotency layer (via
 * the work_audit log).
 */

import type { WorkUsageEvent } from "../types/billing.js";

async function callWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Best-effort: POST a work usage event to the billing service.
 * Returns `true` on success, `false` on any error (logged but not thrown).
 */
export async function reportWorkUsage(
  event: WorkUsageEvent,
  billingServiceUrl: string,
  internalToken: string,
): Promise<boolean> {
  try {
    const res = await callWithTimeout(
      `${billingServiceUrl}/v1/internal/work-usage`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": internalToken,
        },
        body: JSON.stringify(event),
      },
      3_000,
    );
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[work] billing hook returned ${res.status} for ${event.workId} (requestId=${event.requestId})`,
      );
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[work] billing hook failed for ${event.workId} (requestId=${event.requestId}):`,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}
