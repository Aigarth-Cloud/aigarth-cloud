/**
 * Admin authorization.
 *
 * For Phase 5+ we use a config-based admin list (env: ANN_ADMIN_USER_IDS=uuid1,uuid2).
 * This avoids a cross-service coupling to identity for a global admin flag.
 * Real impl: a global `is_admin` field on users in services/identity, exposed in
 * the JWT. Tracked in TODO.
 */

import { loadConfig } from "../config/index.js";

export function isAdmin(userId: string): boolean {
  const cfg = loadConfig();
  return cfg.ANN_ADMIN_USER_IDS.includes(userId);
}

export class AdminRequiredError extends Error {
  constructor() {
    super("Admin privileges required for this action.");
    this.name = "AdminRequiredError";
  }
}
