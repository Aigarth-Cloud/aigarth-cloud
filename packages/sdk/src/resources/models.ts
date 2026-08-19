import { BaseResource } from "./_base.js";
import type { ListModelsResponse, Model } from "../types/models.js";

/**
 * /v1/models — list available models.
 */
export class Models extends BaseResource {
  async list(): Promise<ListModelsResponse> {
    return this.request<ListModelsResponse>("/v1/models", { method: "GET" });
  }

  async retrieve(id: string): Promise<Model> {
    return this.request<Model>(`/v1/models/${encodeURIComponent(id)}`, { method: "GET" });
  }
}
