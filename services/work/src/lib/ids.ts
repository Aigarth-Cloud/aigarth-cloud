/**
 * ID + ULID helpers.
 *
 *   uid()       — UUID v4
 *   workId()    — ULID-shaped string prefixed with `wki_`
 *   workerId()  — ULID-shaped string prefixed with `wrk_`
 *
 * The work / worker prefixes match the regex in ADR 006 §3
 * (`wki_[0-9A-HJKMNP-TV-Z]{26}`) and §4 (`wrk_<ulid>`).
 *
 *   slugify()   — kebab-case slug for names
 *   slugSuffix()— short random hex for slug uniqueness
 */

import { randomBytes, randomUUID } from "node:crypto";

export function uid(): string {
  return randomUUID();
}

/**
 * Crockford's Base32 alphabet for ULIDs (excludes I, L, O, U).
 * 26 chars encode 130 bits, which we get from 17 random bytes.
 */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function ulidLike(): string {
  // 17 random bytes -> 26 base32 chars (16.25 bytes encoded).
  const bytes = randomBytes(17);
  let out = "";
  // Read 5 bits at a time across the byte array; pad if needed.
  let bitBuf = 0;
  let bitCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    bitBuf = (bitBuf << 8) | bytes[i]!;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      out += CROCKFORD[(bitBuf >> bitCount) & 0x1f];
    }
  }
  // Drain remaining bits (last 7 bits: top 5 go in, bottom 2 discarded).
  if (bitCount > 0) {
    out += CROCKFORD[(bitBuf << (5 - bitCount)) & 0x1f];
  }
  return out.slice(0, 26);
}

export function workId(): string {
  return `wki_${ulidLike()}`;
}

export function workerId(): string {
  return `wrk_${ulidLike()}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugSuffix(length = 4): string {
  return randomBytes(length)
    .toString("base64url")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, length)
    .toLowerCase();
}
