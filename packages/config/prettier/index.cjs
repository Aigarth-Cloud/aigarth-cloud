/**
 * Shared Prettier config for the Aigarth monorepo.
 *
 *   // .prettierrc.cjs
 *   module.exports = require('@aigarth/config/prettier');
 */

module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  // Tailwind plugin is optional; install separately if you want it.
  plugins: [],
};
