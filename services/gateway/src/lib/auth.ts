/**
 * Unified auth: accepts either a JWT (Bearer) or a gateway API key (Bearer).
 *
 * Returns:
 *   { kind: "jwt", userId }                       — for first-party / dashboard clients
 *   { kind: "api_key", userId, key: GatewayApiKey } — for SDK / external clients
 *
 * The Fastify `app.authenticate` decorator only handles JWT. This
 * function is for routes that support both (chat, embeddings, images).
 */

import type { FastifyRequest } from "fastify";
import { verifyApiKey, type GatewayApiKey } from "../services/api-keys.js";
import { loadConfig } from "../config/index.js";
import { createHash, createHmac } from "node:crypto";

export type AuthContext =
  | { kind: "jwt"; userId: string }
  | { kind: "api_key"; userId: string; key: GatewayApiKey };

export async function authenticateRequest(req: FastifyRequest): Promise<AuthContext | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  // API key? (starts with "ak_live_")
  if (token.startsWith("ak_live_")) {
    const key = await verifyApiKey(token);
    if (!key) return null;
    return { kind: "api_key", userId: key.userId, key };
  }

  // Otherwise try JWT
  return await verifyJwt(token);
}

async function verifyJwt(token: string): Promise<AuthContext | null> {
  // Use the same secret as the identity service. Fastify's jwt plugin
  // does this for us via the app.authenticate decorator, but we need
  // a standalone path here. Verify manually with HMAC-SHA256.
  try {
    const cfg = loadConfig();
    const [header, payload, sig] = token.split(".");
    if (!header || !payload || !sig) return null;

    // We only support HS256 here (matching @fastify/jwt's default).
    const headerJson = Buffer.from(header, "base64url").toString("utf8");
    const headerData = JSON.parse(headerJson) as { alg: string; typ: string };
    if (headerData.alg !== "HS256") return null;

    const expected = createHmac("sha256", cfg.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    // timing-safe compare
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!createHash("sha256").update(a).digest().equals(createHash("sha256").update(b).digest())) {
      return null;
    }

    const payloadJson = Buffer.from(payload, "base64url").toString("utf8");
    const data = JSON.parse(payloadJson) as { sub?: string; exp?: number };
    if (!data.sub) return null;
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return { kind: "jwt", userId: data.sub };
  } catch {
    return null;
  }
}
