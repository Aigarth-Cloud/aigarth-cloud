/**
 * Shared Aigarth types for the SDK.
 *
 * The SDK re-declares a minimal subset of the `@aigarth/trinary`
 * envelope shape so SDK consumers don't need to install the
 * trinary package directly. The runtime types are a structural
 * subset — they are compatible with the trinary package's
 * `IntentEnvelope` (a full envelope is a valid
 * `IntentEnvelopeLike`).
 *
 * If a consumer wants the full typed surface (signing, hashing,
 * consensus algebra), they should install `@aigarth/trinary`
 * directly. The SDK is a wire-shape client, not a protocol client.
 */

/** Minimal IntentEnvelope shape the SDK exposes in chat responses. */
export interface IntentEnvelopeLike {
  schema_version: 1;
  ann_id: string;
  ann_version: string;
  state: -1 | 0 | 1;
  confidence: number;
  authority: number;
  reasoning: string;
  recommended_action?: string;
  supporting_signals: Array<{
    source: string;
    id: string;
    content_hash?: string;
    label?: string;
  }>;
  required_future_signals: Array<{
    source: string;
    id: string;
    content_hash?: string;
    label?: string;
  }>;
  reversibility: "irreversible" | "soft" | "advisory";
  time_horizon: "immediate" | "session" | "persistent";
  signature: string;
  issued_at: string;
  expires_at?: string;
}
