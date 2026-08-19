import type { Metadata, Viewport } from "next";
// Phase 28 production deploy: `next/font/google` fetches at build time from
// fonts.googleapis.com, which the buildkit network namespace cannot reach
// reliably (socket hangs, TLS failures). We rely on the system font stacks
// defined in globals.css under the same `--font-*` variables. See globals.css
// for the rationale and follow-up to restore the Google fonts.
//
// `force-dynamic` opts every route under this layout out of static
// prerender. The pre-existing prerender pipeline throws
// `useState is not a function` on at least /_not-found, /signup, /, and
// every marketing page (a client-component / motion / wagmi interaction
// graph that needs investigation). Until that is fixed, dynamic SSR is
// the only way the production build ships. Trade-off: no static HTML
// cache, every request hits the Node server. Acceptable for the halving
// launch; revisit in Phase 29.
export const dynamic = "force-dynamic";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aigarth.cloud"),
  title: {
    default: "Aigarth Cloud: Stake Intelligence. Own the Future of Compute.",
    template: "%s: Aigarth Cloud",
  },
  description:
    "The decentralized AI cloud. Stake QUBIC to reserve intelligent compute, launch AI products, and monetize infrastructure through Useful Proof of Work.",
  applicationName: "Aigarth Cloud",
  keywords: [
    "decentralized compute",
    "AI cloud",
    "Qubic",
    "staking",
    "AI inference",
    "GPU marketplace",
    "Useful Proof of Work",
    "ANN",
    "Artificial Neural Networks",
  ],
  authors: [{ name: "Aigarth Cloud" }],
  creator: "Aigarth Cloud",
  publisher: "Aigarth Cloud",
  category: "technology",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aigarth.cloud",
    siteName: "Aigarth Cloud",
    title: "Aigarth Cloud: Stake Intelligence. Own the Future of Compute.",
    description:
      "The decentralized AI cloud. Stake QUBIC, reserve compute, build products, earn revenue.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aigarth Cloud",
    description: "The decentralized AI cloud powered by Qubic.",
  },
  robots: { index: true, follow: true },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0D121C" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-brand="garden"
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
