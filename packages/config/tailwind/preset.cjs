/**
 * Shared Tailwind preset for the Aigarth monorepo.
 * Extends Tailwind with our color palette, fonts, animations, and design tokens.
 *
 *   // tailwind.config.cjs
 *   const preset = require('@aigarth/config/tailwind-preset');
 *   module.exports = { presets: [preset], content: [...] };
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        garden: {
          50: "#f1f8f3",
          100: "#dcefe0",
          200: "#bbdfc3",
          300: "#8fc89d",
          400: "#5fab71",
          500: "#2E7D32",
          600: "#266129",
          700: "#1f4d22",
          800: "#1a3d1c",
          900: "#142f16",
          950: "#0a1a0b",
        },
        forest: {
          50: "#f3f6f4",
          100: "#e3ebe5",
          200: "#c7d7cb",
          300: "#9fbaa6",
          400: "#74987e",
          500: "#557b60",
          600: "#41624b",
          700: "#344e3c",
          800: "#2b3f31",
          900: "#1f2c23",
        },
        sage: {
          50: "#f6f7f4",
          100: "#e9ece2",
          200: "#d3d9c6",
          300: "#b3bda1",
          400: "#94a17f",
          500: "#788565",
          600: "#5e6a4f",
          700: "#4a5440",
          800: "#3d4536",
          900: "#2d3427",
        },
        moss: {
          50: "#f5f6f1",
          100: "#e6ead7",
          200: "#cdd4af",
          300: "#aebc83",
          400: "#94a662",
          500: "#7c8c4c",
          600: "#5f6c39",
          700: "#4a542e",
          800: "#3c4427",
          900: "#2b301c",
        },
        mint: {
          50: "#effaf5",
          100: "#d8f3e4",
          200: "#b3e7cd",
          300: "#82d4b0",
          400: "#52be91",
          500: "#33a878",
          600: "#238662",
          700: "#1e6a4f",
          800: "#1c5440",
          900: "#174533",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        teal: {
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
        },
        // Neutrals — warm and refined
        stone: {
          50: "#FAFAF9",
          100: "#F5F5F4",
          200: "#E7E5E4",
          300: "#D6D3D1",
          400: "#A8A29E",
          500: "#78716C",
          600: "#57534E",
          700: "#44403C",
          800: "#292524",
          900: "#1C1917",
          950: "#0C0A09",
        },
        graphite: {
          50: "#F6F6F7",
          100: "#E2E3E5",
          200: "#C4C6CA",
          300: "#9DA0A6",
          400: "#76797F",
          500: "#5C5F64",
          600: "#48494E",
          700: "#3A3B3E",
          800: "#2A2B2D",
          900: "#1A1B1C",
        },
        // Surfaces (resolved from CSS variables)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "garden-glow": "radial-gradient(ellipse at top, rgba(46,125,50,0.15), transparent 60%)",
        "mesh-garden":
          "radial-gradient(at 27% 37%, hsla(140, 60%, 50%, 0.18) 0px, transparent 50%), radial-gradient(at 97% 21%, hsla(160, 70%, 60%, 0.12) 0px, transparent 50%), radial-gradient(at 52% 99%, hsla(180, 50%, 55%, 0.10) 0px, transparent 50%), radial-gradient(at 10% 29%, hsla(120, 60%, 50%, 0.10) 0px, transparent 50%), radial-gradient(at 97% 96%, hsla(150, 60%, 50%, 0.10) 0px, transparent 50%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        drift: {
          "0%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(20px, -20px)" },
          "100%": { transform: "translate(0, 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "fade-in-up": "fade-in-up 0.8s ease-out forwards",
        shimmer: "shimmer 8s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "spin-slow": "spin-slow 30s linear infinite",
        float: "float 6s ease-in-out infinite",
        drift: "drift 12s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
