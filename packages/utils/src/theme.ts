/**
 * Theme helpers — brand identity and mode switching.
 *
 * The browser carries theme state in:
 *   - <html data-brand="garden" | "qubic">
 *   - <html class="dark"> for dark mode
 *
 * These helpers read/write that state safely (SSR-safe).
 */

export type BrandId = "garden" | "qubic";
export type ModeId = "light" | "dark";

export interface Brand {
  id: BrandId;
  name: string;
  tagline: string;
  swatches: {
    light: { from: string; via: string; to: string };
    dark: { from: string; via: string; to: string };
  };
}

export const BRANDS: readonly Brand[] = [
  {
    id: "garden",
    name: "Garden",
    tagline: "Botanical, warm, premium",
    swatches: {
      light: { from: "#2E7D32", via: "#3a9d40", to: "#1ba98e" },
      dark: { from: "#5fab71", via: "#74d18a", to: "#33a878" },
    },
  },
  {
    id: "qubic",
    name: "Qubic",
    tagline: "Cosmic, electric, technical",
    swatches: {
      light: { from: "#25CAD9", via: "#61F0FE", to: "#FFDEA1" },
      dark: { from: "#25CAD9", via: "#61F0FE", to: "#FFDEA1" },
    },
  },
] as const;

export const DEFAULT_BRAND: BrandId = "garden";
export const DEFAULT_MODE: ModeId = "dark";

export const STORAGE_KEY_BRAND = "aigarth-brand";
export const STORAGE_KEY_MODE = "aigarth-mode";

export function isBrandId(value: unknown): value is BrandId {
  return value === "garden" || value === "qubic";
}

export function isModeId(value: unknown): value is ModeId {
  return value === "light" || value === "dark";
}

export function getBrand(id: BrandId | undefined): Brand {
  const found = BRANDS.find((b) => b.id === id);
  if (found) return found;
  const fallback = BRANDS[0];
  if (!fallback) throw new Error("BRANDS array is empty — invariant violated");
  return fallback;
}

/**
 * Apply theme state to the document root. Safe to call after hydration.
 * For SSR use the defaults; for client-side, read storage first.
 */
export function applyTheme(brand: BrandId, mode: ModeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.brand = brand;
  root.classList.toggle("dark", mode === "dark");
}

export function readStoredBrand(): BrandId | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY_BRAND);
  return isBrandId(v) ? v : null;
}

export function readStoredMode(): ModeId | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY_MODE);
  return isModeId(v) ? v : null;
}

export function writeStoredBrand(brand: BrandId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_BRAND, brand);
}

export function writeStoredMode(mode: ModeId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_MODE, mode);
}
