import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware className merge. Strips conflicting Tailwind classes.
 *
 *   cn("px-2", condition && "py-2", "px-4")
 *   // -> "py-2 px-4" (px-2 wins because px-4 came later)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
