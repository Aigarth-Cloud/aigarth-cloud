/**
 * @aigarth/sdk
 *
 * A typed, multi-service client for the Aigarth AI Cloud.
 *
 *   import { Aigarth } from "@aigarth/sdk";
 *
 *   const client = new Aigarth({
 *     apiKey: process.env.AIGARTH_API_KEY!,
 *     services: { gateway: "http://localhost:7004" },
 *   });
 *
 *   // OpenAI-compatible gateway
 *   const completion = await client.chat.completions.create({ model: "...", messages: [...] });
 *
 *   // Per-service: identity, qubic, compute, gateway, billing, ann, marketplace
 *   const me = await client.identity.whoami();
 *   const listings = await client.marketplace.listings.list();
 *   const credit = await client.compute.credit();
 *
 * Compatible with the existing OpenAI JS SDK surface so existing
 * integrations keep working. Aigarth-specific extras (ANN routing,
 * Qubic-paid compute, capacity marketplace) live in the per-service
 * resources: `client.anns`, `client.billing`, `client.compute`, etc.
 */

export { Aigarth } from "./client.js";
export type { AigarthOptions, ServiceUrls } from "./client.js";
export * from "./errors.js";
export * from "./resources/index.js";
export * from "./types/index.js";
