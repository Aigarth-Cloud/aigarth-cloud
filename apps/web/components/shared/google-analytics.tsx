import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js) loader.
 *
 * Renders the standard GA4 install snippet as two `next/script` tags with
 * `strategy="afterInteractive"`, which is Google's recommended pattern for
 * App Router sites. The library script is loaded async, and the config
 * block initialises `window.dataLayer` + `gtag` on the client.
 *
 * The measurement ID is read from the `NEXT_PUBLIC_GA_ID` env var at build
 * time (Next.js inlines `NEXT_PUBLIC_*` values into the client bundle). If
 * the env var is unset or empty, the component renders nothing — so
 * builds without analytics configured stay clean.
 *
 * Add `<GoogleAnalytics />` to any layout or page where GA tracking is
 * wanted. The current call site is `apps/web/app/(marketing)/layout.tsx`,
 * which scopes tracking to the public marketing surface and excludes the
 * authenticated dashboard.
 *
 * Production build:
 *   docker buildx build --build-arg APP=web --build-arg NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX ...
 * The ID must be supplied at build time. The actual measurement ID is
 * documented in `.env.aigarth.example` and lives in the VPS
 * `/opt/aigarth/.env.production` (gitignored).
 */
export function GoogleAnalytics() {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!GA_ID) return null;

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
