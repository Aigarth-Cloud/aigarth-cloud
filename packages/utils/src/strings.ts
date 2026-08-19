/**
 * String utilities — slugify, truncate, initials, pluralize.
 */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function truncate(input: string, maxLength: number, ellipsis = "…"): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, Math.max(0, maxLength - ellipsis.length)) + ellipsis;
}

export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * Format with thousands separators without using Intl.
 * Useful for IDs, counters, and places where locale-specific separators
 * would be wrong (e.g. "1,000,000" always).
 */
export function formatCount(n: number, separator = ","): string {
  const negative = n < 0;
  const digits = Math.abs(Math.trunc(n)).toString();
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return negative ? `-${withSep}` : withSep;
}
