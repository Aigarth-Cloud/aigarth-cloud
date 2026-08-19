import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
await c.connect();
await c.query("DELETE FROM validators");
const r = await c.query("SELECT COUNT(*)::int AS n FROM validators");
console.log("validators remaining:", r.rows[0].n);
await c.end();
