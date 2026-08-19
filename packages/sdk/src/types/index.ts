/**
 * OpenAI-compatible + Aigarth-specific types.
 *
 * Where Aigarth diverges from OpenAI, we use intersection types so
 * existing OpenAI SDK code continues to work without changes.
 *
 * Example: Aigarth adds a `qubic_paid: boolean` field to chat requests.
 *   type AigarthChatCompletionCreate = ChatCompletionCreate & {
 *     qubic_paid?: boolean;
 *   };
 */

export * from "./chat.js";
export * from "./embeddings.js";
export * from "./models.js";
export * from "./common.js";
export * from "./aigarth.js";
export * from "./ann.js";
export * from "./organism.js";
export * from "./tissue.js";
export * from "./tissueListing.js";
export * from "./dataset.js";
export * from "./usage.js";
export * from "./qubic.js";
export * from "./compute.js";
export * from "./billing.js";
export * from "./marketplace.js";
export * from "./keys.js";
