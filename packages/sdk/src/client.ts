import { ChatCompletions } from "./resources/chat.js";
import { Embeddings } from "./resources/embeddings.js";
import { Models } from "./resources/models.js";
import { Anns } from "./resources/anns.js";
import { Tissues } from "./resources/tissues.js";
import { Datasets } from "./resources/datasets.js";
import { UsageResource } from "./resources/usage.js";
import { IdentityResource } from "./resources/identity.js";
import { QubicResource } from "./resources/qubic.js";
import { ComputeResource } from "./resources/compute.js";
import { BillingResource } from "./resources/billing.js";
import { MarketplaceResource } from "./resources/marketplace.js";
import { KeysResource } from "./resources/keys.js";
import { Organisms } from "./resources/organisms.js";
import { AigarthError, APIConnectionError, APIUserAbortError, makeError } from "./errors.js";

export interface ServiceUrls {
  /** Identity service (port 7001 in dev). */
  identity?: string;
  /** Qubic service (port 7002 in dev). */
  qubic?: string;
  /** Compute service (port 7003 in dev). */
  compute?: string;
  /** Gateway (port 7004 in dev). */
  gateway?: string;
  /** Billing service (port 7005 in dev). */
  billing?: string;
  /** ANN service (port 7006 in dev). */
  ann?: string;
  /** Marketplace service (port 7007 in dev). */
  marketplace?: string;
  /** Tissue service (port 7008 in dev). */
  tissue?: string;
  /** Dataset service (port 7009 in dev). */
  dataset?: string;
}

export interface AigarthOptions {
  /** API key. Falls back to AIGARTH_API_KEY env var. */
  apiKey?: string;
  /** Gateway base URL. Defaults to https://api.aigarth.cloud. */
  gatewayURL?: string;
  /** Per-service URLs. Overrides the defaults. */
  services?: ServiceUrls;
  /** Organization id (for multi-org keys). */
  organization?: string;
  /** Project id. */
  project?: string;
  /** Custom fetch implementation (Node 18+ has global fetch). */
  fetch?: typeof fetch;
  /** Request timeout in ms. Defaults to 10 minutes. */
  timeout?: number;
  /** Max retries on 429/5xx. Defaults to 2. */
  maxRetries?: number;
  /** Default headers. */
  defaultHeaders?: Record<string, string>;
  /** AbortSignal for the entire client. */
  signal?: AbortSignal;
}

const DEFAULT_GATEWAY_URL = "https://api.aigarth.cloud";
const DEFAULT_SERVICE_PORTS = {
  identity: "http://localhost:7001",
  qubic: "http://localhost:7002",
  compute: "http://localhost:7003",
  gateway: "http://localhost:7004",
  billing: "http://localhost:7005",
  ann: "http://localhost:7006",
  marketplace: "http://localhost:7007",
  tissue: "http://localhost:7008",
  dataset: "http://localhost:7009",
};

/**
 * Main Aigarth SDK client.
 *
 *   const client = new Aigarth();
 *   const completion = await client.chat.completions.create({...});
 *
 *   // Multi-service
 *   const me = await client.identity.whoami();
 *   const myAnn = await client.anns.create({ name: "My ANN", ... });
 *   const listings = await client.marketplace.listings.list();
 *
 * The constructor is intentionally cheap; no network calls happen
 * until you make a request. Reuse one client across your app.
 */
export class Aigarth {
  readonly apiKey: string;
  readonly gatewayURL: string;
  readonly services: Required<ServiceUrls>;
  readonly organization?: string;
  readonly project?: string;
  readonly chat: ChatCompletions;
  readonly embeddings: Embeddings;
  readonly models: Models;
  readonly anns: Anns;
  readonly tissues: Tissues;
  readonly datasets: Datasets;
  readonly usage: UsageResource;
  readonly identity: IdentityResource;
  readonly qubic: QubicResource;
  readonly compute: ComputeResource;
  readonly billing: BillingResource;
  readonly marketplace: MarketplaceResource;
  readonly keys: KeysResource;
  readonly organisms: Organisms;
  private readonly fetchImpl: typeof fetch;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly signal?: AbortSignal;

  constructor(options: AigarthOptions = {}) {
    const apiKey = options.apiKey ?? process.env["AIGARTH_API_KEY"];
    if (!apiKey) {
      throw new AigarthError(
        "Missing API key. Pass `apiKey` or set the AIGARTH_API_KEY environment variable.",
      );
    }
    this.apiKey = apiKey;
    this.gatewayURL = (options.gatewayURL ?? DEFAULT_GATEWAY_URL).replace(/\/$/, "");
    this.services = {
      identity: (options.services?.identity ?? DEFAULT_SERVICE_PORTS.identity).replace(/\/$/, ""),
      qubic: (options.services?.qubic ?? DEFAULT_SERVICE_PORTS.qubic).replace(/\/$/, ""),
      compute: (options.services?.compute ?? DEFAULT_SERVICE_PORTS.compute).replace(/\/$/, ""),
      gateway: (options.services?.gateway ?? options.gatewayURL ?? DEFAULT_SERVICE_PORTS.gateway).replace(/\/$/, ""),
      billing: (options.services?.billing ?? DEFAULT_SERVICE_PORTS.billing).replace(/\/$/, ""),
      ann: (options.services?.ann ?? DEFAULT_SERVICE_PORTS.ann).replace(/\/$/, ""),
      marketplace: (options.services?.marketplace ?? DEFAULT_SERVICE_PORTS.marketplace).replace(/\/$/, ""),
      tissue: (options.services?.tissue ?? DEFAULT_SERVICE_PORTS.tissue).replace(/\/$/, ""),
      dataset: (options.services?.dataset ?? DEFAULT_SERVICE_PORTS.dataset).replace(/\/$/, ""),
    };
    this.organization = options.organization;
    this.project = options.project;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new AigarthError(
        "No fetch implementation available. Pass `fetch` in options or run on Node 18+.",
      );
    }
    this.timeout = options.timeout ?? 10 * 60 * 1000;
    this.maxRetries = options.maxRetries ?? 2;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.signal = options.signal;

    // Gateway resources (use gatewayURL)
    this.chat = new ChatCompletions(this, this.services.gateway);
    this.embeddings = new Embeddings(this, this.services.gateway);
    this.models = new Models(this, this.services.gateway);
    this.usage = new UsageResource(this, this.services.gateway);
    this.keys = new KeysResource(this, this.services.gateway);

    // Per-service resources
    this.identity = new IdentityResource(this, this.services.identity);
    this.qubic = new QubicResource(this, this.services.qubic);
    this.compute = new ComputeResource(this, this.services.compute);
    this.billing = new BillingResource(this, this.services.billing);
    this.anns = new Anns(this, this.services.ann);
    this.tissues = new Tissues(this, this.services.tissue);
    this.datasets = new Datasets(this, this.services.dataset);
    this.marketplace = new MarketplaceResource(this, this.services.marketplace);
    this.organisms = new Organisms(this, this.services.ann);
  }

  /**
   * Make a request to a service. Handles auth, retries, timeouts,
   * and error mapping. Public so custom resources can use the same
   * transport.
   */
  async request<T = unknown>(path: string, init: RequestInit = {}, baseURL?: string): Promise<T> {
    const url = `${baseURL ?? this.gatewayURL}${path}`;
    const headers = this.buildHeaders(init.headers);

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const combinedSignal = combineSignals([controller.signal, this.signal, init.signal ?? null]);

      try {
        const response = await this.fetchImpl(url, {
          ...init,
          headers,
          signal: combinedSignal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          if (response.status === 204) return undefined as T;
          return (await response.json()) as T;
        }

        const requestId = response.headers.get("x-request-id");
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          /* not JSON */
        }
        const error = makeError(response.status, body as never, requestId, response.statusText);

        const shouldRetry =
          attempt < this.maxRetries &&
          (response.status === 429 || response.status >= 500);
        if (shouldRetry) {
          attempt++;
          await sleep(backoffMs(attempt, response.headers.get("retry-after")));
          continue;
        }
        throw error;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;

        if (err instanceof APIUserAbortError) throw err;
        if (err instanceof AigarthError) throw err;
        if ((err as { name?: string })?.name === "AbortError") {
          throw new APIUserAbortError(undefined, { cause: err });
        }
        if (attempt < this.maxRetries) {
          attempt++;
          await sleep(backoffMs(attempt, null));
          continue;
        }
        throw new APIConnectionError(
          err instanceof Error ? err.message : "Network request failed",
          { cause: err },
        );
      }
    }

    throw lastError instanceof AigarthError
      ? lastError
      : new AigarthError("Request failed after retries");
  }

  private buildHeaders(input: HeadersInit | undefined): Headers {
    const headers = new Headers(input);
    headers.set("authorization", `Bearer ${this.apiKey}`);
    headers.set("content-type", "application/json");
    headers.set("accept", "application/json");
    headers.set("user-agent", "@aigarth/sdk/0.2.0");
    if (this.organization) headers.set("aigarth-organization", this.organization);
    if (this.project) headers.set("aigarth-project", this.project);
    for (const [k, v] of Object.entries(this.defaultHeaders)) {
      headers.set(k, v);
    }
    return headers;
  }
}

function combineSignals(signals: (AbortSignal | null | undefined)[]): AbortSignal {
  const filtered = signals.filter((s): s is AbortSignal => s != null);
  if (filtered.length === 0) return new AbortController().signal;
  if (filtered.length === 1) return filtered[0]!;
  return AbortSignal.any(filtered);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  const ceiling = Math.min(30_000, 2 ** attempt * 250);
  return Math.floor(Math.random() * ceiling);
}
