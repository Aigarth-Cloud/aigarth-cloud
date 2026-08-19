/**
 * Shared ESLint config for Aigarth monorepo.
 * Usage in any package's .eslintrc.cjs:
 *
 *   module.exports = require('@aigarth/config/eslint');
 *
 * Or for Next.js:
 *
 *   module.exports = require('@aigarth/config/eslint/next');
 */

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
  },
  ignorePatterns: [
    "dist",
    "build",
    ".next",
    ".turbo",
    "node_modules",
    "*.config.js",
    "*.config.cjs",
    "*.config.mjs",
  ],
};
