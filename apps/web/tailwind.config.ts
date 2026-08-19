import type { Config } from "tailwindcss";
import preset from "@aigarth/config/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    // Pull in the design system source so its classes are emitted.
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/utils/src/**/*.{ts,tsx}",
  ],
  theme: {
    // Extend (do not override) the preset theme.
    extend: {
      // App-level overrides go here.
    },
  },
};

export default config;
