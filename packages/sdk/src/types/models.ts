export interface Model {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  /** Aigarth extension. */
  modality?: "text" | "image" | "audio" | "embedding" | "multimodal";
  /** Aigarth extension. */
  context_window?: number;
  /** Aigarth extension. */
  input_cost_per_1k?: number;
  /** Aigarth extension. */
  output_cost_per_1k?: number;
  /** Aigarth extension. */
  serves_anns?: string[];
}

export interface ListModelsResponse {
  object: "list";
  data: Model[];
}
