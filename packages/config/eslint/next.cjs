/**
 * Next.js-flavored ESLint config.
 * Use in apps/web, apps/dashboard, etc.
 */

module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "next/typescript",
  ],
  ignorePatterns: [
    "dist",
    "build",
    ".next",
    ".turbo",
    "node_modules",
  ],
};
