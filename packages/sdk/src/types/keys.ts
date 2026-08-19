/**
 * Gateway API key types — manage keys for the AI Gateway.
 *
 *   const { full_key, ...key } = await client.keys.create({ name: "ci", scopes: ["chat:write"] });
 *   // store full_key somewhere safe — never sent again
 *   const list = await client.keys.list();
 *   await client.keys.revoke(key.id);
 */

export type KeyStatus = "active" | "revoked";
export type KeyScope =
  | "chat:read"
  | "chat:write"
  | "embeddings:read"
  | "embeddings:write"
  | "images:read"
  | "images:write"
  | "models:read"
  | "usage:read"
  | "anns:read"
  | "anns:write";

export interface GatewayApiKey {
  id: string;
  name: string;
  prefix: string;
  secret_last4: string;
  scopes: KeyScope[];
  status: KeyStatus;
  rate_limit_rpm: number | null;
  rate_limit_tpm: number | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

export interface GatewayApiKeyWithSecret extends GatewayApiKey {
  /** Returned ONCE on creation. Never stored, never sent again. */
  full_key: string;
}
