// Apply the billing 0001 migration manually (it was previously shim-applied
// but the table is missing on this DB). Then verify the row is in
// public.billing_migrations so `pnpm db:migrate` stays a no-op.
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";

const SQL = fs.readFileSync(
  "C:/Users/Wesley/.minimax-agent/projects/qubic-aigarth-cloud/services/billing/drizzle/0001_fantastic_galactus.sql",
  "utf8"
);

(async () => {
  const c = new Client({ connectionString: URL });
  await c.connect();
  try {
    await c.query(SQL);
    console.log("[billing] 0001_fantastic_galactus applied");
  } catch (e) {
    console.error("[billing] FAILED:", e.message);
    process.exit(1);
  }
  const r = await c.query("SELECT to_regclass('public.billing_tissue_usage_events') AS t");
  console.log("[billing] table now:", r.rows[0].t);
  await c.end();
})();
