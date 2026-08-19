/**
 * services/identity client — internal service-to-service calls.
 *
 * Used by the payout settler (`settleRun`) to resolve each recipient's
 * Qubic wallet address before broadcasting a transfer. We don't store
 * wallet addresses in services/economy (per ADR 001 — economy never
 * duplicates identity data) so we look them up at settle time.
 *
 * The caller MUST send `INTERNAL_TOKEN` as a bearer token; the target
 * (services/identity) checks it against its own `INTERNAL_TOKEN` env.
 *
 * Phase 18 closeout: this is the missing join that kept
 * `wallet_address` blank in earlier payout runs.
 */

import { loadConfig } from "../config/index.js";

export class IdentityLookupError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "IdentityLookupError";
  }
}

/**
 * Look up a user's verified (non-revoked) Qubic wallet addresses via
 * services/identity. Returns an empty array when the user has linked
 * no verified wallet — that's not an error, the recipient just can't
 * be settled.
 *
 * Throws IdentityLookupError on transport / non-2xx responses, except
 * for 404 (user does not exist), which returns an empty array (same
 * semantics as "no wallet").
 */
export async function lookupWalletsForUser(
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  if (!userId || typeof userId !== "string") {
    throw new IdentityLookupError("userId is required", "INVALID_INPUT");
  }
  const cfg = loadConfig();
  const url = new URL(
    `/v1/internal/wallets/by-user/${encodeURIComponent(userId)}`,
    cfg.IDENTITY_SERVICE_URL,
  );
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfg.INTERNAL_TOKEN}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new IdentityLookupError(
      `identity service unreachable: ${(err as Error)?.message ?? String(err)}`,
      "TRANSPORT_ERROR",
    );
  }
  if (res.status === 404) {
    // No such user — same as "no wallet" for our purposes.
    return [];
  }
  if (res.status === 401) {
    throw new IdentityLookupError(
      "identity service rejected internal token (check INTERNAL_TOKEN)",
      "UNAUTHORIZED",
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new IdentityLookupError(
      `identity service returned ${res.status}: ${text.slice(0, 256)}`,
      `HTTP_${res.status}`,
    );
  }
  const body = (await res.json()) as { addresses?: unknown };
  if (!body || !Array.isArray(body.addresses)) {
    throw new IdentityLookupError(
      "identity service returned an unexpected payload",
      "BAD_PAYLOAD",
    );
  }
  return body.addresses.filter(
    (a): a is string => typeof a === "string" && a.length === 60,
  );
}
