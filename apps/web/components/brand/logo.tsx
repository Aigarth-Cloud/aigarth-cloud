/**
 * Aigarth brand marks.
 *
 * Three pieces, all in the same visual family:
 *   - LogoMark : the A alone. Use for favicons, small icon strips, social avatars.
 *   - Logo     : the A + "Aigarth" inline. Use for nav bars and headers.
 *   - LogoFull : the A + "Aigarth" + "Cloud" stacked. Use for splash, sign-in, brand.
 *
 * The A is a geometric letterform in a soft forest-to-mint gradient with a
 * small leaf accent above the crossbar (the "intelligent digital garden"
 * hook, carried over from the previous mark).
 *
 * The mark is rendered as inline SVG so it scales to any size and inherits
 * the `currentColor` from the surrounding text. The gradient is defined
 * once per component instance (use a stable id so multiple instances on
 * the same page do not collide).
 */

import * as React from "react";
import { cn } from "@aigarth/utils";

let _gradCounter = 0;
function nextGradId(): string {
  _gradCounter += 1;
  return `aigarthA-${_gradCounter}`;
}

export function Logo({
  className,
  showWordmark = true,
  showSubtitle = false,
  size = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  showSubtitle?: boolean;
  size?: "sm" | "default" | "lg";
}) {
  const iconSize = size === "sm" ? 22 : size === "lg" ? 36 : 28;
  const wordSize =
    size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";
  const subSize = "text-[9px]";

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={iconSize} />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-semibold tracking-tight",
              wordSize
            )}
          >
            Aigarth
          </span>
          {showSubtitle && (
            <span
              className={cn(
                "mt-0.5 font-semibold uppercase tracking-[0.22em] text-garden-700 dark:text-garden-400",
                subSize
              )}
            >
              Cloud
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  // Unique gradient id per instance so two LogoMarks on the same page
  // do not collide. We use React.useId() so the id is stable across
  // server render and client hydration (this is a server component, so
  // hooks like useState are illegal here). useId() returns a string
  // like ":r1:" — colons are valid in HTML id attributes and SVG
  // references (e.g. `url(#:r1:)`).
  const gradId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Aigarth"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5eaaa8" />
          <stop offset="100%" stopColor="#2E7D32" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradId})`}>
        {/* Left leg */}
        <polygon points="11,58 19,58 35,8 30,8" />
        {/* Right leg */}
        <polygon points="45,58 53,58 34,8 29,8" />
        {/* Crossbar as a leaf-shaped lens */}
        <ellipse cx="32" cy="40" rx="14" ry="3.2" />
        {/* Small leaf accent in the apex negative space */}
        <path d="M32 18 C 36 20 36 26 32 28 C 28 26 28 20 32 18 Z" opacity="0.85" />
      </g>
    </svg>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={36} />
      <div className="flex flex-col leading-none">
        <span className="font-semibold text-lg tracking-tight">Aigarth</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-garden-700 dark:text-garden-400">
          Cloud
        </span>
      </div>
    </div>
  );
}
