import type { Usage } from "./common.js";

export interface EmbeddingCreateParams {
  /** Model id, e.g. "aigarth-embed-1" or "text-embedding-3-small". */
  model: string;
  /** Text(s) to embed. */
  input: string | string[] | number[][];
  /** User identifier. */
  user?: string;
  /** Aigarth extension: output dimension (for Matryoshka-style models). */
  dimensions?: number;
  /** Aigarth extension: encoding format. */
  encoding_format?: "float" | "base64";
}

export interface Embedding {
  index: number;
  object: "embedding";
  embedding: number[];
}

export interface CreateEmbeddingResponse {
  object: "list";
  data: Embedding[];
  model: string;
  usage: Usage;
}
