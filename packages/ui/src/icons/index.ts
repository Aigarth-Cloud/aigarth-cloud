/**
 * Re-export icons. We use lucide-react internally; this re-export
 * gives us a single import path for the design system.
 *
 * Apps can either import directly from "lucide-react" or from
 * "@aigarth/ui/icons". Use the latter when you want to be able to
 * swap icon libraries later.
 */

export * from "lucide-react";
