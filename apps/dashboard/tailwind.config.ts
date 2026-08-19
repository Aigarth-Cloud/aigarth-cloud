import type { Config } from "tailwindcss";
import preset from "@aigarth/config/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx}",
    // Pull in the design system source so its classes are emitted.
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/utils/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
};

export default config;
