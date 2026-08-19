/**
 * ID + slug helpers.
 */

import { randomBytes, randomUUID } from "node:crypto";

export function uid(): string {
  return randomUUID();
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
