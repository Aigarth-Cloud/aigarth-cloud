/**
 * Type alias for the Drizzle database handle.
 * Imported wherever we need to pass a DB around as a function arg.
 */

import type { getDb } from "../db/index.js";

export type Database = ReturnType<typeof getDb>;
