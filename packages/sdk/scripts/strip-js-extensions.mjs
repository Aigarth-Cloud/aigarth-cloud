/**
 * Post-build helper: strip `.js` extensions from relative imports
 * in the SDK's dist output. Required because tsc preserves the
 * `.js` extensions that ESM Node consumers need, but the same
 * extensions break Next.js's server-actions loader when the SDK
 * is bundled into apps/web.
 *
 * Run via: pnpm build
 *
 * Update 2026-08-18: no-op. The SDK is now consumed directly from
 * `packages/sdk/src/...` by the Next.js apps (via tsconfig paths),
 * so its dist output is only loaded by Node services. Keeping the
 * explicit `.js` extensions is the right default for ESM Node
 * resolution. If Next.js regresses, the apps can also consume
 * `packages/sdk/src/...` directly and bypass the dist entirely.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p);
    } else if (entry.name.endsWith(".js")) {
      yield p;
    }
  }
}

let total = 0;
for await (const file of walk(DIST)) {
  // Intentionally a no-op — keep the `.js` extensions so Node ESM
  // resolution works. Touch the file iterator so we still log a
  // count of what was scanned.
  const _src = await readFile(file, "utf8");
  total++;
}
console.log(`strip-js-extensions: skipped (no-op). inspected ${total} file(s).`);
