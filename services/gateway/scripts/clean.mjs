/**
 * Cross-platform clean for the gateway service.
 */
import { rm } from "node:fs/promises";

const targets = [".turbo", "dist", "coverage", ".vitest-cache", "node_modules/.cache"];

for (const t of targets) {
  await rm(t, { recursive: true, force: true });
  console.log(`  removed: ${t}`);
}
