/**
 * Adapter registry — single-flight in-process map from
 * `manifest.architecture` to `AnnAdapter`.
 *
 * Mirrors the `getTrinaryBackend()` factory pattern in
 * `services/ann/src/backends/index.ts`. Adapters are registered
 * once at startup (or lazily) and consulted by the local executor.
 */

import type { AnnAdapter } from "./types.js";

const REGISTRY = new Map<string, AnnAdapter>();

/** Register an adapter. Overwrites any prior registration for the same id. */
export function registerAnnAdapter(adapter: AnnAdapter): void {
  REGISTRY.set(adapter.id, adapter);
}

/** Look up an adapter by architecture. Returns undefined if not registered. */
export function getAnnAdapter(architecture: string): AnnAdapter | undefined {
  return REGISTRY.get(architecture);
}

/** List all registered adapter ids. */
export function listAnnAdapterIds(): string[] {
  return Array.from(REGISTRY.keys());
}

/** Test-only: clear the registry. */
export function __resetAnnAdapterRegistryForTests(): void {
  REGISTRY.clear();
}
