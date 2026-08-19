const { Client } = require("pg");
const URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";

(async () => {
  const c = new Client({ connectionString: URL });
  await c.connect();

  const m = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%migration%' ORDER BY tablename"
  );
  console.log("Migration tables:", m.rows.map((r) => r.tablename));

  for (const tbl of [
    "__drizzle_migrations",
    "ann_migrations",
    "marketplace_migrations",
    "billing_migrations",
    "tissue_migrations",
  ]) {
    const exists = await c.query("SELECT to_regclass('public." + tbl + "') AS t");
    if (!exists.rows[0].t) {
      console.log("  " + tbl + ": MISSING");
      continue;
    }
    const rows = await c.query("SELECT hash, created_at FROM " + tbl + " ORDER BY created_at");
    console.log("  " + tbl + ": " + rows.rowCount + " rows");
    for (const r of rows.rows) {
      console.log("    " + r.created_at.toISOString() + "  " + r.hash.slice(0, 16));
    }
  }

  const app = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('__drizzle_migrations','ann_migrations','marketplace_migrations','billing_migrations','tissue_migrations') ORDER BY tablename"
  );
  console.log("App tables (" + app.rowCount + "): " + app.rows.map((r) => r.tablename).join(", "));

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
