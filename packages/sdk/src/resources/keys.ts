import { BaseResource } from "./_base.js";
import type {
  GatewayApiKey,
  GatewayApiKeyWithSecret,
  KeyScope,
  KeyStatus,
} from "../types/keys.js";

/**
 * /v1/keys — manage gateway API keys.
 *
 *   const { full_key, ...key } = await client.keys.create({ name: "ci", scopes: ["chat:write"] });
 *   // store full_key somewhere safe — never sent again
 *   const list = await client.keys.list();
 *   await client.keys.revoke(key.id);
 *
 * These are gateway-issued keys (`ak_live_<prefix>.<secret>`) used to
 * authenticate against the OpenAI-compatible /chat/completions,
 * /embeddings, /images, /models endpoints. They are independent
 * from the identity-service API keys (which authenticate against
 * the user/identity/management APIs).
 */
export class KeysResource extends BaseResource {
  /** Issue a new gateway API key. `full_key` is returned ONCE. */
  create(params: {
    name: string;
    scopes: KeyScope[];
    rate_limit_rpm?: number;
    rate_limit_tpm?: number;
    expires_in_days?: number;
  }): Promise<GatewayApiKeyWithSecret> {
    return this.request<GatewayApiKeyWithSecret>("/v1/keys", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /** List the caller's keys. `full_key` is never returned here. */
  list(): Promise<{ data: GatewayApiKey[] }> {
    return this.request<{ data: GatewayApiKey[] }>("/v1/keys", { method: "GET" });
  }

  /** Revoke a key. Idempotent. */
  revoke(id: string): Promise<{ ok: true }> {
    return this.request(`/v1/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

export type { GatewayApiKey, GatewayApiKeyWithSecret, KeyScope, KeyStatus };
