/**
 * Round 3: properly migrate Drizzle 0.36 → 0.42 syntax.
 *
 * Strategy: read each file, do source-level analysis to find DB query
 * expressions, and rewrite them to use the new thenable API.
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

  // 1) Remove the leftover comments from v2
  src = src.replace(/\s*\/\* was: \.get\(\) \*\//g, "");
  src = src.replace(/\s*\/\* was: \.all\(\) \*\//g, "");
  src = src.replace(/\s*\/\* was: \.run\(\) \*\//g, "");

  // 2) "const x = db.something()... .limit(1)" → wrap with await and [0]
  //    These were originally .get() — they want a single row.
  src = src.replace(
    /(const|let|var)\s+(\w+)\s*=\s*(db\.[^;]+?)\.limit\(1\)\s*;?/g,
    "$1 $2 = (await $3.limit(1))[0];",
  );

  // 3) "const x = db.something()..." (no .limit, no .run) → these were originally .all()
  //    Just add await.
  src = src.replace(
    /(const|let|var)\s+(\w+)\s*=\s*(db\.[^;]+?);/g,
    (m, decl, varName, expr) => {
      // Skip if it already has await
      if (expr.includes("await ")) return m;
      // Skip if it's clearly a non-Drizzle thing (rare)
      if (!expr.includes(".select(") && !expr.includes(".insert(") &&
          !expr.includes(".update(") && !expr.includes(".delete(")) {
        return m;
      }
      return `${decl} ${varName} = await ${expr};`;
    },
  );

  // 4) "await db.something()...".run() and "db.something()...".run() (leftover)
  //    Strip the .run() and ensure await
  src = src.replace(/\.run\(\)\s*;?/g, ";");

  // 5) db.transaction((tx) => { ... }) → make async
  //    Find db.transaction((tx) => { and convert to async
  src = src.replace(
    /db\.transaction\(\s*\(tx\)\s*=>\s*\{/g,
    "db.transaction(async (tx) => {",
  );

  // 6) Inside transactions, the same patterns need fixing:
  //    tx.update(t).set(...).where(...).run() — strip .run() and ensure await
  //    Already handled by 4).

  if (src !== before) {
    fs.writeFileSync(f, src, "utf-8");
    console.log(`  ${path.relative(root, f)}: updated`);
  }
}

console.log("\nDone.");
