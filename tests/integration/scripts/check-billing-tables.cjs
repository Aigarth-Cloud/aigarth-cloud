const { Client } = require("pg");
const c = new Client({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
(async () => {
  await c.connect();
  const r = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'billing%' ORDER BY tablename"
  );
  console.log("billing tables:", r.rows.map((x) => x.tablename));
  await c.end();
})();
