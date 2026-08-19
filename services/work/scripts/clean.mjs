#!/usr/bin/env node
/**
 * Build-clean helper for the work service.
 *
 *   node scripts/clean.mjs
 *
 * Removes dist/ and coverage/ (Drizzle migrations are NOT
 * removed). Use after a typecheck or build to start fresh.
 */
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
for (const dir of ["dist", "coverage", ".turbo"]) {
  try {
    rmSync(resolve(root, dir), { recursive: true, force: true });
    console.log(`[clean] removed ${dir}/`);
  } catch {
    // ignore
  }
}
