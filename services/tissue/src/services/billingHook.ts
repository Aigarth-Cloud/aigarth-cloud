/**
 * Billing + marketplace hooks — Phase 18E.
 *
 *   The tissue service emits:
 *     1. A usage event to the billing service (always, on
 *        successful /decide), so per-period invoices can include
 *        tissue overage. Best-effort: failures are logged, never
 *        block the /decide response.
 *     2. A counter increment to the marketplace service (only if
 *        the /decide call came through a marketplace listing —
 *        `tissueListingId` was provided). Best-effort, same.
 *
 *   Both are protected by shared internal tokens (X-Internal-Token
 *   header). The tissue service is configured with the same
 *   values via env.
 */

import { loadConfig } from "../config/index.js";

export interface TissueUsageHookEvent {
  userId: string;
  orgId?: string;
  tissueSlug: string;
  tissueVersion: string;
  tissueListingId?: string;
  state: -1 | 0 | 1;
  costQubic: string;
  requestId: string;
}

export interface MarketplaceIncrementHookEvent {
  listingId: string;
  revenueQubic: string;
}

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
 * Best-effort: POST a tissue usage event to the billing service.
 * Returns `true` on success, `false` on any error (logged but not thrown).
 */
export async function reportTissueUsage(event: TissueUsageHookEvent): Promise<boolean> {
  const cfg = loadConfig();
  try {
    const res = await callWithTimeout(
      `${cfg.BILLING_SERVICE_URL}/v1/internal/tissue-usage`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": cfg.BILLING_INTERNAL_TOKEN,
        },
        body: JSON.stringify(event),
      },
      3_000,
    );
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[tissue] billing hook returned ${res.status} for ${event.tissueSlug} (requestId=${event.requestId})`,
      );
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[tissue] billing hook failed for ${event.tissueSlug} (requestId=${event.requestId}):`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Best-effort: increment the marketplace's per-listing decision counter.
 * Returns `true` on success, `false` on any error.
 */
export async function reportMarketplaceDecision(
  event: MarketplaceIncrementHookEvent,
): Promise<boolean> {
  const cfg = loadConfig();
  try {
    const res = await callWithTimeout(
      `${cfg.MARKETPLACE_SERVICE_URL}/v1/tissue-listings/${event.listingId}/decisions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": cfg.MARKETPLACE_INTERNAL_TOKEN,
        },
        body: JSON.stringify({ revenue_qubic: event.revenueQubic }),
      },
      3_000,
    );
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[tissue] marketplace hook returned ${res.status} for listing ${event.listingId}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[tissue] marketplace hook failed for listing ${event.listingId}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
