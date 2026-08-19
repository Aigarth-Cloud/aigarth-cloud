// Clean build artifacts.
import { rm } from "node:fs/promises";

const targets = ["dist", "coverage", ".turbo"];
for (const t of targets) {
  await rm(t, { recursive: true, force: true });
  console.log(`removed ${t}`);
}
