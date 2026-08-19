const { Client } = require("pg");
const c = new Client({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
(async () => {
  await c.connect();
  const anns = await c.query("SELECT slug, name, decision_protocol, status FROM anns WHERE slug LIKE '%sales%' OR slug LIKE '%risk%' OR slug LIKE '%finance%' OR name LIKE '%Sales%' OR name LIKE '%Risk%' OR name LIKE '%Finance%' ORDER BY slug");
  console.log("ANNs matching demo names:");
  for (const a of anns.rows) console.log("  " + a.slug.padEnd(30) + " " + a.name.padEnd(40) + " " + a.decision_protocol + " " + a.status);
  const mems = await c.query("SELECT tm.ann_slug, t.slug AS tissue_slug FROM tissue_members tm JOIN tissues t ON t.id = tm.tissue_id WHERE t.slug = 'tissue_executive_v1' ORDER BY tm.position");
  console.log("\nDemo tissue members:");
  for (const m of mems.rows) console.log("  tissue=" + m.tissue_slug + " ann_slug=" + m.ann_slug);
  await c.end();
})();
