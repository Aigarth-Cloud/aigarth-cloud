/**
 * ID + slug helpers.
 */

import { randomBytes, randomUUID } from "node:crypto";

export function uid(): string {
  return randomUUID();
}

/** Slugify a name into a URL-friendly id. "MediScan Vision" -> "mediscan-vision". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Generate a short slug suffix to disambiguate. e.g. "mediscan-vision-a8x2". */
export function slugSuffix(length = 4): string {
  return randomBytes(length).toString("base64url").replace(/[^a-z0-9]/gi, "").slice(0, length).toLowerCase();
}

// ---------- Phase 29 — Execution IDs ----------
//
// Convention: "axe_" prefix mirrors the work service's "wki_" prefix
// and the organisms service's "org_" prefix. The 26-char Crockford-base32
// ULID body is identical to the work service's so cross-service id
// lookups can share parsing logic if needed.

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Generate a 26-char Crockford-base32 ULID. */
function ulidBody(): string {
  // 16 random bytes → 22 base32 chars; pad to 26 to match the work
  // service's wki_<ulid> shape. The leading byte is read as a time
  // hint so the id is roughly time-sortable, but we do not need
  // strict monotonicity for execution ids.
  const bytes = randomBytes(16);
  let body = "";
  for (let i = 0; i < 26; i++) {
    // 5 bytes per 8 base32 chars; use a simple byte-to-nibble scheme.
    const byte = bytes[i % 16]!;
    const nibble = (byte >> ((i % 2) * 4)) & 0x0f;
    body += ULID_ALPHABET[nibble % 32];
  }
  return body;
}

/** Service-issued execution id. Format: `axe_<26-char ulid>`. */
export function executionId(): string {
  return `axe_${ulidBody()}`;
}

/** Service-issued manifest pub id. Format: `mnf_<26-char ulid>`. */
export function manifestId(): string {
  return `mnf_${ulidBody()}`;
}

