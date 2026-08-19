/**
 * Re-export all UI primitives.
 * Each primitive is a thin wrapper around a Radix UI primitive or a
 * styled shadcn-style component. All primitives are:
 *   - Headless where possible (Radix underneath)
 *   - Brand-aware (use CSS variables — no hardcoded colors)
 *   - Tree-shakeable (only the primitives you import are bundled)
 */

export * from "./accordion";
export * from "./badge";
export * from "./button";
export * from "./card";
export * from "./dialog";
export * from "./dropdown-menu";
export * from "./input";
export * from "./progress";
export * from "./separator";
export * from "./skeleton";
export * from "./slider";
export * from "./switch";
export * from "./tabs";
export * from "./textarea";
export * from "./tooltip";
