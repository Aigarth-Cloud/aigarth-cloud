import { Pool } from "pg";

const pool = new Pool({ connectionString: "postgres://aigarth:aigarth_dev@localhost:5432/aigarth" });
const r = await pool.query<{ action: string; count: string }>(
  "SELECT action, COUNT(*)::int as count FROM audit_logs GROUP BY action ORDER BY count DESC",
);
console.log("Audit log events:");
for (const row of r.rows) {
  console.log(`  ${row.action.padEnd(30)} ${row.count}`);
}

const users = await pool.query<{ count: string }>("SELECT COUNT(*)::int as count FROM users");
console.log(`\nUsers: ${users.rows[0]?.count}`);

const orgs = await pool.query<{ count: string }>("SELECT COUNT(*)::int as count FROM organizations");
console.log(`Organizations: ${orgs.rows[0]?.count}`);

const sessions = await pool.query<{ count: string }>("SELECT COUNT(*)::int as count FROM sessions");
console.log(`Sessions: ${sessions.rows[0]?.count}`);

const sessionsRevoked = await pool.query<{ count: string }>(
  "SELECT COUNT(*)::int as count FROM sessions WHERE revoked_at IS NOT NULL",
);
console.log(`Revoked sessions: ${sessionsRevoked.rows[0]?.count}`);

await pool.end();
