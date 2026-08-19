/**
 * Compact unique id generator. Format: `<timestamp36>-<random8>`.
 * Sufficient for ids that aren't exposed externally; not a UUID.
 */
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
