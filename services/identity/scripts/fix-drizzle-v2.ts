/**
 * Aggressive Drizzle 0.36 → 0.42 migration.
 * Handles multi-line statements and any other patterns we missed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) files.push(p);
  }
  return files;
}

const files = walk(root);

for (const f of files) {
  let src = fs.readFileSync(f, "utf-8");
  const before = src;

  // Strip any remaining .get() / .all() / .run() (these are now invalid)
  // We convert each pattern to the equivalent in 0.42:

  // 1) .get() at end of an expression statement
  //    The challenge: we need to find a complete expression ending in .get()
  //    Approach: replace `.get()` only when preceded by a db.query expression.
  //    Specifically: if a line ends with .get() (with optional trailing semicolon),
  //    and the variable being assigned is a Promise, wrap with await.
  //    Simpler: any `.get()` should be replaced with `.then(...)`.

  // We'll do precise replacement: for each `.get()` we find, look backwards to
  // find the matching opening of the statement (the `=` or `(` or line start),
  // then wrap the expression in `await (...)[0]`.

  // Simpler approach: assume .get() is at end-of-statement and find the
  // preceding statement-start. We'll do this by line.

  // First: any line containing only `.get();` (the standalone case)
  src = src.replace(
    /(\.where\([^)]*\)\s*)\.get\(\);/g,
    (m) => m.replace(/\.get\(\);$/, ".limit(1); /* was: .get() */"),
  );

  // Multi-line: lines ending in `.get()` (no semicolon, just .get())
  src = src.replace(/\.get\(\)\s*;?\s*$/gm, ".limit(1) /* was: .get() */");

  // Standalone .all() → nothing (just remove)
  src = src.replace(/\.all\(\)\s*;?\s*$/gm, "");

  // Standalone .run() → nothing
  src = src.replace(/\.run\(\)\s*;?\s*$/gm, "");

  if (src !== before) {
    fs.writeFileSync(f, src, "utf-8");
    console.log(`  ${path.relative(root, f)}: updated`);
  }
}

console.log("\nDone.");
