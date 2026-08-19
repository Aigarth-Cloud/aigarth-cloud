import * as React from "react";
import { cn } from "@aigarth/utils";

/**
 * Official Qubic mark, sourced from the Bit2Me crypto-icon set.
 * Rendered as a plain <img> so it doesn't require a Next.js
 * `remotePatterns` entry: the asset is already a tiny SVG and
 * browsers cache it across pages.
 */
const QUBIC_LOGO_SRC =
  "https://assets.bit2me.com/crypto-icons/v8/svg/qubic-circle-solid-default.svg";

export function QubicLogo({
  className,
  size,
  alt = "Qubic",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={QUBIC_LOGO_SRC}
      alt={alt}
      width={size ?? 14}
      height={size ?? 14}
      loading="lazy"
      decoding="async"
      className={cn("inline-block shrink-0", className)}
    />
  );
}
