/**
 * Cross-platform clean for @aigarth/trinary.
 * Removes .turbo, dist, coverage, and test cache directories.
 */
import { rm } from "node:fs/promises";

const targets = [".turbo", "dist", "coverage", ".vitest-cache", "node_modules/.cache"];

for (const t of targets) {
  await rm(t, { recursive: true, force: true });
  console.log(`  removed: ${t}`);
}
