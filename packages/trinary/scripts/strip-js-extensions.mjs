/**
 * Post-build helper: strip `.js` extensions from relative imports in
 * the trinary package's dist output. Mirrors `@aigarth/sdk`'s helper.
 *
 * tsc preserves the `.js` extensions that ESM Node consumers need, but
 * the same extensions break Next.js's bundler when the package is
 * consumed by apps/web. This script runs after `tsc` to make the dist
 * importable from both worlds.
 *
 * Run via: pnpm build
 *
 * Update 2026-08-18: the strip step is a no-op. The same trinary dist
 * has to be importable from both Node services (which need the explicit
 * `.js` extensions on relative imports per ESM resolution) and from
 * the Next.js apps (which previously broke on them). Next.js 14+ has
 * stable support for `.js` extension imports inside workspace packages,
 * so the safer default is to keep the extensions and let Next.js handle
 * them. If a regression appears, switch back to stripping and add a
 * re-add step in the service Dockerfile before `pnpm deploy`.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";

let total = 0;
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

// Intentionally a no-op: keep `.js` extensions so Node ESM can resolve
// them. See the file header note for the trade-off with Next.js.
for await (const file of walk(DIST)) {
  // touch the iterator so the script still confirms a successful run
  const _src = await readFile(file, "utf8");
  total++;
}
console.log(`strip-js-extensions: skipped (no-op). inspected ${total} file(s).`);
