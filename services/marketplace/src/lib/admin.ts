/**
 * Admin authorization.
 */

import { loadConfig } from "../config/index.js";

export function isAdmin(userId: string): boolean {
  const cfg = loadConfig();
  return cfg.MKT_ADMIN_USER_IDS.includes(userId);
}
