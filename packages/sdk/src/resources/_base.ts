import type { Aigarth } from "../client.js";

/**
 * Base class for all SDK resources. Holds a reference to the client
 * and a service-specific baseURL so each resource can use the same
 * auth/retry/timeout logic while targeting its own service.
 */
export abstract class BaseResource {
  protected readonly client: Aigarth;
  protected readonly baseURL: string;
  constructor(client: Aigarth, baseURL: string) {
    this.client = client;
    this.baseURL = baseURL;
  }

  /** Make a request to this resource's service. */
  protected request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    return this.client.request<T>(path, init, this.baseURL);
  }
}

/** Helper to build a query string from a params object. */
export function toQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
