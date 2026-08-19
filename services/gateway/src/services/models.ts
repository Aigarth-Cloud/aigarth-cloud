/**
 * Model registry + lookups.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { gatewayModels, type GatewayModel } from "../db/schema.js";

export async function listModels(options: { type?: string; activeOnly?: boolean } = {}): Promise<GatewayModel[]> {
  const db = getDb();
  const rows = await db.select().from(gatewayModels);
  return rows.filter((m) => {
    if (options.type && m.type !== options.type) return false;
    if (options.activeOnly && m.status !== "active") return false;
    return true;
  });
}

export async function getModel(id: string): Promise<GatewayModel | null> {
  const db = getDb();
  const rows = await db.select().from(gatewayModels).where(eq(gatewayModels.id, id)).limit(1);
  return rows[0] ?? null;
}
