/**
 * Generic database type for service-local helpers.
 *
 * The actual type is `NodePgDatabase<typeof schema>` from drizzle,
 * but expressing it here would require importing the schema (a
 * cycle). The `Database` alias is loose but matches the pattern
 * used by the ANN service.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
