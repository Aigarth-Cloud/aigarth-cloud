/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@aigarth/ui",
    "@aigarth/utils",
    "@aigarth/config",
    "@aigarth/sdk",
  ],
  // Standalone output for the production Docker image.
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // See apps/web/next.config.mjs for the rationale.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
