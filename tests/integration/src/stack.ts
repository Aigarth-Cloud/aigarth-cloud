/**
 * Stack helpers — service URLs, JWT secret, DB connection.
 *
 *   All service URLs default to the dev ports (7001-7008). Override
 *   with environment variables for CI or staging.
 *
 *   DATABASE_URL must match the one in each service's .env file so
 *   we can verify post-call state directly in the database.
 */

export interface StackEndpoints {
  identity: string;
  qubic: string;
  compute: string;
  gateway: string;
  billing: string;
  ann: string;
  marketplace: string;
  tissue: string;
}

export const STACK: StackEndpoints = {
  identity:    process.env["AIGARTH_IDENTITY_URL"]    ?? "http://localhost:7001",
  qubic:       process.env["AIGARTH_QUBIC_URL"]       ?? "http://localhost:7002",
  compute:     process.env["AIGARTH_COMPUTE_URL"]     ?? "http://localhost:7003",
  gateway:     process.env["AIGARTH_GATEWAY_URL"]     ?? "http://localhost:7004",
  billing:     process.env["AIGARTH_BILLING_URL"]     ?? "http://localhost:7005",
  ann:         process.env["AIGARTH_ANN_URL"]         ?? "http://localhost:7006",
  marketplace: process.env["AIGARTH_MARKETPLACE_URL"] ?? "http://localhost:7007",
  tissue:      process.env["AIGARTH_TISSUE_URL"]      ?? "http://localhost:7008",
};

export const DATABASE_URL =
  process.env["DATABASE_URL"] ?? "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";

export const STACK_PORTS = [7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008] as const;
export const APP_PORTS = [3003, 4000] as const;

export const JWT_SECRET =
  process.env["INTEGRATION_JWT_SECRET"] ??
  "24483bfb1fc98577aa908a891c115ef3df44e109283bad3ea72f157058d710cd";
