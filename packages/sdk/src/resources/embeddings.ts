import { BaseResource } from "./_base.js";
import type {
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "../types/embeddings.js";

/**
 * /v1/embeddings — generate vector embeddings.
 */
export class Embeddings extends BaseResource {
  async create(params: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    return this.request<CreateEmbeddingResponse>("/v1/embeddings", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }
}
