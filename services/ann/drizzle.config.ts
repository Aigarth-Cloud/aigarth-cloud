import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://aigarth:aigarth_dev@localhost:5432/aigarth",
  },
  /**
   * Per-service migrations table.
   *
   *   Without this, every service shares the same `drizzle.__drizzle_migrations`
   *   table. The shared table records hashes from every service, which causes
   *   service A's migrate to think service B's migrations are "already applied"
   *   and silently skip them. The result: schema changes appear to "apply" but
   *   the SQL never runs.
   *
   *   With a per-service `migrationsTable`, each service tracks its own applied
   *   migrations independently and runs cleanly.
   */
  migrationsTable: "ann_migrations",
  strict: true,
  verbose: true,
} satisfies Config;
