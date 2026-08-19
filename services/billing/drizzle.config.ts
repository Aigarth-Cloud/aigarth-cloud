import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://aigarth:aigarth_dev@localhost:5432/aigarth",
  },
  /** Per-service migrations table. See services/ann/drizzle.config.ts. */
  migrationsTable: "billing_migrations",
  strict: true,
  verbose: true,
} satisfies Config;
