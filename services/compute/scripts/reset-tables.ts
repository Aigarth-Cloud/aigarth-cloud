import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
await c.connect();
await c.query(
  "TRUNCATE compute_jobs, compute_reservations, compute_cluster_members, compute_clusters, compute_regions, compute_audit_logs RESTART IDENTITY CASCADE",
);
console.log("truncated compute state");
await c.end();
