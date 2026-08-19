/**
 * Server-side Aigarth client factory (no session).
 *
 * For public reads — the marketing catalog, the public dataset
 * browse, etc. — we don't need an authenticated user. We just need
 * a client pointed at the right services.
 *
 * Unlike `getAigarth()` in `./aigarth.ts`, this does NOT require
 * a session cookie. The marketing /datasets page uses this so
 * anonymous visitors can browse the catalog.
 *
 * If the API requires auth (it shouldn't for these reads), the
 * underlying fetch will 401 and the page renders an empty state.
 */

import { Aigarth, type ServiceUrls } from "../../../../packages/sdk/dist/index.js";

const services: ServiceUrls = {
  identity:    process.env.AIGARTH_IDENTITY_URL    ?? "http://localhost:7001",
  qubic:       process.env.AIGARTH_QUBIC_URL       ?? "http://localhost:7002",
  compute:     process.env.AIGARTH_COMPUTE_URL     ?? "http://localhost:7003",
  gateway:     process.env.AIGARTH_GATEWAY_URL     ?? "http://localhost:7004",
  billing:     process.env.AIGARTH_BILLING_URL     ?? "http://localhost:7005",
  ann:         process.env.AIGARTH_ANN_URL         ?? "http://localhost:7006",
  marketplace: process.env.AIGARTH_MARKETPLACE_URL ?? "http://localhost:7007",
  tissue:      process.env.AIGARTH_TISSUE_URL      ?? "http://localhost:7008",
  dataset:     process.env.AIGARTH_DATASET_URL     ?? "http://localhost:7009",
};

/**
 * Build a public Aigarth client. Uses a dummy API key (the public
 * reads don't validate it). If the services are missing the
 * `.env` config and not running, fetches will fail gracefully and
 * the page shows an empty state.
 */
export function getAigarthPublic(): Aigarth {
  return new Aigarth({
    apiKey: "public-no-auth",
    services,
  });
}
