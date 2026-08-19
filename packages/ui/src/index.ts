/**
 * @aigarth/ui
 *
 * Shared design system. Three layers:
 *   1. Primitives — button, card, dialog, etc. (shadcn-style over Radix)
 *   2. Composites — bundles of primitives for common patterns
 *   3. Icons — re-exported lucide-react
 *
 * Brand and mode are controlled via CSS variables on <html>:
 *   <html data-brand="garden | qubic" class="dark">
 *
 * Consumers must import the globals.css once at the app root:
 *   import "@aigarth/ui/styles.css";
 */

export * from "./primitives";
export * from "./composites";
