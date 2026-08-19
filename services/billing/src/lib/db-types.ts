import type { getDb } from "../db/index.js";

export type Database = ReturnType<typeof getDb>;
