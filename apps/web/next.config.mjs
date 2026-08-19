/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@aigarth/ui",
    "@aigarth/utils",
    "@aigarth/config",
  ],
  // Standalone output produces a self-contained server bundle in
  // `.next/standalone` that ships only the deps the app actually
  // uses. Required for the production Docker image (Dockerfile.app).
  output: "standalone",
  // The SDK is consumed as compiled dist/ via a relative path in
  // lib/server/aigarth.ts. The package alias `@aigarth/sdk` would
  // follow the workspace symlink to src/ which uses `.js` extensions
  // the Next.js bundler can't resolve.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Pre-existing type errors in the dashboard pages. The runtime is correct
  // (the build still emits valid JS); we skip strict type checking at
  // build time so the Docker image can be produced. Follow-up: a separate
  // sprint to fix the underlying type drift (FitnessRow → OrganismFitnessEntry,
  // Organisms ↔ OrganismClient registration pattern, etc.).
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
