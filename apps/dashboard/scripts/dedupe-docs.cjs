/**
 * One-time cleanup: collapse duplicate doc rows that exist because
 * some historical seeds stored paths with `../../docs/...` and some
 * without. The canonical form is `../../docs/...` (relative to
 * apps/dashboard/scripts/ — what the docs/[slug] page and the
 * current seed.ts use). Other forms are merged into their canonical
 * counterpart and deleted.
 *
 * Run: node apps/dashboard/scripts/dedupe-docs.cjs
 */

const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

const dbPath = path.join(__dirname, "..", "data", "tracker.db");
if (!fs.existsSync(dbPath)) {
  console.error(`db not found: ${dbPath}`);
  process.exit(1);
}
const db = new Database(dbPath);

/** Canonicalize any historical path form to the current convention. */
function canonicalizePath(p) {
  let s = p;
  // Strip absolute prefixes
  s = s.replace(/^.*?docs\//, "docs/");
  // Map "docs/..." -> "../../docs/..."
  if (!s.startsWith("../../") && s.startsWith("docs/")) {
    s = "../../" + s;
  }
  return s;
}

const all = db.prepare("SELECT id, path, title, ord, created_at FROM docs").all();
console.log(`Before: ${all.length} rows`);

// Group by title (same logical doc → same canonical path)
const byTitle = new Map();
for (const row of all) {
  if (!byTitle.has(row.title)) byTitle.set(row.title, []);
  byTitle.get(row.title).push(row);
}

let updated = 0;
let deleted = 0;

const tx = db.transaction(() => {
  for (const [title, rows] of byTitle) {
    if (rows.length === 1) {
      // Just canonicalize
      const r = rows[0];
      const want = canonicalizePath(r.path);
      if (want !== r.path) {
        // Check uniqueness before update
        const conflict = db
          .prepare("SELECT id FROM docs WHERE path = ? AND id != ?")
          .get(want, r.id);
        if (!conflict) {
          db.prepare("UPDATE docs SET path = ? WHERE id = ?").run(want, r.id);
          updated++;
        }
      }
      continue;
    }

    // Multiple rows for the same title — keep the most-recently-updated
    // one, canonicalize it, merge others into it, then delete the rest.
    const sorted = rows
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    const keeper = sorted[0];
    const dupes = sorted.slice(1);
    const want = canonicalizePath(keeper.path);

    // Move keeper to canonical path if needed
    if (want !== keeper.path) {
      const conflict = db
        .prepare("SELECT id FROM docs WHERE path = ? AND id != ?")
        .get(want, keeper.id);
      if (conflict) {
        // The canonical path is held by one of the dupes. Delete the keeper.
        db.prepare("DELETE FROM docs WHERE id = ?").run(keeper.id);
        deleted++;
        continue;
      }
      db.prepare("UPDATE docs SET path = ? WHERE id = ?").run(want, keeper.id);
      updated++;
    }

    // Delete the dupes
    for (const d of dupes) {
      if (d.id !== keeper.id) {
        db.prepare("DELETE FROM docs WHERE id = ?").run(d.id);
        deleted++;
      }
    }
  }

  // Renumber `ord` so it's dense 0..N-1, sorted by category then title.
  // This fixes the leftover ord collisions from earlier scripts.
  const remaining = db
    .prepare("SELECT id, category, title, ord FROM docs ORDER BY category, title")
    .all();
  for (let i = 0; i < remaining.length; i++) {
    db.prepare("UPDATE docs SET ord = ? WHERE id = ?").run(i, remaining[i].id);
  }
});
tx();

const after = db.prepare("SELECT COUNT(*) as n FROM docs").get();
console.log(`After: ${after.n} rows (updated ${updated}, deleted ${deleted}, renumbered)`);

// Show any remaining duplicates
const dupesAfter = db
  .prepare(
    `SELECT title, COUNT(*) as n FROM docs GROUP BY title HAVING n > 1`,
  )
  .all();
if (dupesAfter.length === 0) {
  console.log("✓ No remaining duplicates by title");
} else {
  console.log(`! ${dupesAfter.length} duplicate titles still remain:`);
  for (const d of dupesAfter) console.log(`  ${d.n}× ${d.title}`);
}
