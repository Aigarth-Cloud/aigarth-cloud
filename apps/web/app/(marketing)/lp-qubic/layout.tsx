"use client";

import * as React from "react";

/**
 * Layout wrapper for the Qubic-themed landing page.
 *
 * Forces `data-brand="qubic"` on the <html> element so the Qubic palette
 * is rendered for this route. Preserves the user's light/dark preference
 * (from next-themes / the floating theme selector): does NOT force dark.
 *
 * On unmount we restore whatever brand was active before so leaving this
 * route doesn't clobber the user's saved preference.
 */
export default function QubicLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const root = document.documentElement;
    const prevBrand = root.dataset.brand;

    root.dataset.brand = "qubic";

    return () => {
      if (prevBrand) root.dataset.brand = prevBrand;
      else delete root.dataset.brand;
    };
  }, []);

  return <>{children}</>;
}
