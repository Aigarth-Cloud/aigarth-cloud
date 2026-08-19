import { BaseResource, toQueryString } from "./_base.js";

/**
 * /v1/auth + /v1/users — Identity service.
 *
 *   const session = await client.identity.signup({ email, password, name });
 *   const me = await client.identity.whoami();
 */
export class IdentityResource extends BaseResource {
  async signup(params: { email: string; password: string; name: string }): Promise<SignupResponse> {
    return this.request<SignupResponse>("/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async login(params: { email: string; password: string }): Promise<LoginResponse> {
    return this.request<LoginResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async logout(): Promise<void> {
    await this.request("/v1/auth/logout", { method: "POST" });
  }

  async whoami(): Promise<User> {
    return this.request<User>("/v1/me", { method: "GET" });
  }

  async listApiKeys(): Promise<{ data: ApiKey[] }> {
    return this.request<{ data: ApiKey[] }>("/v1/api-keys", { method: "GET" });
  }

  async createApiKey(params: { name: string; scopes: string[] }): Promise<ApiKey> {
    return this.request<ApiKey>("/v1/api-keys", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * List the current user's linked Qubic wallets.
   * (Aliases: `wallets.list()` reads more naturally from the caller.)
   */
  async listWallets(): Promise<{ data: WalletLink[] }> {
    return this.request<{ data: WalletLink[] }>("/v1/wallets", { method: "GET" });
  }

  /** Unlink (revoke) a Qubic wallet from the current user. */
  async unlinkWallet(id: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(`/v1/wallets/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  /**
   * Start a wallet-link flow. Returns a nonce + canonical message
   * the user must sign with the new wallet's private key.
   */
  async startLinkWallet(
    params: { address?: string } = {},
  ): Promise<{ nonce: string; address: string | null; message: string; expiresInSeconds: number }> {
    return this.request<{ nonce: string; address: string | null; message: string; expiresInSeconds: number }>(
      "/v1/wallets/link/start",
      { method: "POST", body: JSON.stringify(params) },
    );
  }

  /**
   * Finish a wallet-link flow by submitting the signed nonce.
   * Returns the new linked wallet.
   */
  async finishLinkWallet(params: {
    address: string;
    signature: string;
    nonce: string;
    label?: string;
  }): Promise<{ id: string; address: string; verified_at: string | null; verification: { reason: string } }> {
    return this.request<{ id: string; address: string; verified_at: string | null; verification: { reason: string } }>(
      "/v1/wallets/link/finish",
      { method: "POST", body: JSON.stringify(params) },
    );
  }
}

export interface SignupResponse {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  status?: string;
  email_verified?: boolean;
  locale?: string;
  timezone?: string;
  created_at: string;
  last_seen_at?: string | null;
  is_admin?: boolean;
  is_active?: boolean;
  email_verified_at?: string | null;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  full_key?: string; // only on creation
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface WalletLink {
  id: string;
  /** 60-character uppercase Qubic address. */
  address: string;
  /** Optional human label. */
  alias?: string | null;
  verified_at: string | null;
  created_at: string;
  /** True when this wallet was used for the current session. */
  is_active?: boolean;
}
