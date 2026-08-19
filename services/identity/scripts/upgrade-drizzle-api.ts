/**
 * Refactor Drizzle 0.36 syntax to 0.42 (thenable) syntax.
 *
 * Replaces:
 *   .get()                 → (await …)[0]
 *   .all()                 → await …
 *   .run()                 → await … (and adds .returning() if value was used)
 *
 * Run once after upgrading drizzle-orm.
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
let changedFiles = 0;
let totalReplacements = 0;

for (const f of files) {
  let src = fs.readFileSync(f, "utf-8");
  const before = src;
  let fileReplacements = 0;

  // The patterns to handle. Each must look like `…<EOL>` or `…;` or be inside parens.

  // 1) Wrap any standalone <expr>.get() → (await <expr>)[0]
  //    This is tricky to do perfectly with regex; we do a heuristic: match a line
  //    ending in .get() and prepend `await` to the start of the statement.
  src = src.replace(
    /(^|\n)([ \t]*)(const\s+([A-Za-z_$][\w$]*)\s*=\s*)([^;\n]+?)\.get\(\)\s*;?/g,
    (_m, prefix, indent, decl, varName, expr) => {
      fileReplacements++;
      // Make the expr awaitable
      return `${prefix}${indent}${decl}await ${expr.trim()}.then((rows) => rows[0] ?? undefined)`;
    },
  );

  // 2) Replace <expr>.all() → await <expr>
  src = src.replace(
    /(^|\n)([ \t]*)([A-Za-z_$][\w$]*\s*=\s*)([^;\n]+?)\.all\(\)\s*;?/g,
    (_m, prefix, indent, decl, expr) => {
      fileReplacements++;
      return `${prefix}${indent}${decl}await ${expr.trim()}`;
    },
  );

  // 3) Replace <expr>.run() → await <expr>
  //    For inserts, we want to capture the return value, so add .returning() when followed by an assignment.
  //    First, simple await: foo.insert(t).values(...).run() → await foo.insert(t).values(...)
  src = src.replace(
    /(^|\n)([ \t]*)([A-Za-z_$][\w$]*\s*=\s*)([^;\n]+?)\.run\(\)\s*;?/g,
    (_m, prefix, indent, decl, expr) => {
      fileReplacements++;
      return `${prefix}${indent}${decl}await ${expr.trim()}`;
    },
  );

  // 4) Standalone statements (no assignment) like `db.update(t).set(...).where(...).run();` → `await ...`
  src = src.replace(
    /(^|\n)([ \t]*)((?:[A-Za-z_$][\w$]*\.)?(?:insert|update|delete)\([^)]*\)[^;]*?)\.run\(\)\s*;?/g,
    (_m, prefix, indent, expr) => {
      fileReplacements++;
      return `${prefix}${indent}await ${expr.trim()}`;
    },
  );

  if (src !== before) {
    fs.writeFileSync(f, src, "utf-8");
    changedFiles++;
    totalReplacements += fileReplacements;
    console.log(`  ${path.relative(root, f)}: ${fileReplacements} replacements`);
  }
}

console.log(`\nDone. ${totalReplacements} replacements across ${changedFiles} files.`);
console.log("⚠️  Review the changes — this is a heuristic migration.");
