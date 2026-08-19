import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
await c.connect();
const r = await c.query<{ tablename: string }>(
  "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
);
console.log(r.rows.map((x) => x.tablename).join("\n"));
await c.end();
