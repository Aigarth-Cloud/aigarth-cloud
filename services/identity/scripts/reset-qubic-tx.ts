import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
await c.connect();
// Wipe transactional state so the new NOT NULL column can land
await c.query("TRUNCATE stakes, transactions, treasury_movements, qubic_balances, qubic_wallets, rewards, epoch_snapshots RESTART IDENTITY CASCADE");
await c.query("TRUNCATE qubic_audit_logs RESTART IDENTITY");
console.log("truncated Qubic state");
await c.end();
