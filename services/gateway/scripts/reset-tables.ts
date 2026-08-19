import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
await c.connect();
await c.query(
  "TRUNCATE gateway_requests, gateway_rate_limits, gateway_api_keys, gateway_deployments, gateway_models, gateway_audit_logs RESTART IDENTITY CASCADE",
);
console.log("truncated gateway state");
await c.end();
