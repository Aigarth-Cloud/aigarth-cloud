/**
 * Type alias for the Drizzle database handle.
 */

import type { getDb } from "../db/index.js";

export type Database = ReturnType<typeof getDb>;
