"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote, Globe, Sprout, Zap, Wallet, Brain, Network } from "lucide-react";
import { cn } from "@aigarth/utils";

/**
 * AuthCarousel: Qubic-themed feature-value carousel for the
 * branded auth layout (login + signup).
 *
 * Auto-advances every 6s. Pauses on hover or focus, resumes on leave.
 * Manual navigation via the dot indicators or by clicking the slide.
 *
 * 4 slides, each a simple value statement with a small SVG icon:
 *   1. Stake. Train. Earn.   : the core loop
 *   2. 75% to creators       : revenue split
 *   3. Wallet is identity    : no KYC, on Qubic
 *   4. Sub-50ms, 47 regions  : performance / scale
 *
 * The carousel is purely presentational: the auth pages render it
 * inside the brand panel of the 2-panel layout.
 */

type IconName = "sprout" | "banknote" | "wallet" | "zap";

interface Slide {
  /** Single small-caps eyebrow above the headline. */
  eyebrow: string;
  /** Big bold headline (3-5 words). */
  headline: string;
  /** Body line. 1-2 short sentences. Plain English, no abstract nouns. */
  body: string;
  /** Icon name from the curated set above. */
  icon: IconName;
  /** A single stat or callout shown in the bottom-left corner. */
  stat: { value: string; label: string };
}

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  sprout: Sprout,
  banknote: Banknote,
  wallet: Wallet,
  zap: Zap,
};

const SLIDES: Slide[] = [
  {
    eyebrow: "The cycle",
    headline: "Stake. Train. Earn.",
    body: "Lock QUBIC. Grow an ANN. Publish on the open market. Every call pays you, your co-creators, and your stakers: automatically.",
    icon: "sprout",
    stat: { value: "1,247", label: "Live ANNs" },
  },
  {
    eyebrow: "Revenue split",
    headline: "75% of every call is yours.",
    body: "Creators keep three quarters. Stakers earn 15%. The protocol takes 10% to fund compute and R&D. No invoices, no intermediaries.",
    icon: "banknote",
    stat: { value: "75 / 15 / 10", label: "Creator / Staker / Protocol" },
  },
  {
    eyebrow: "Built on Qubic",
    headline: "Your wallet is your account.",
    body: "Connect a Qubic wallet. No email, no KYC, no password to forget. Five seconds from the signup page to your first ANN.",
    icon: "wallet",
    stat: { value: "0 forms", label: "Just sign the nonce" },
  },
  {
    eyebrow: "Performance",
    headline: "Sub-50ms, 47 regions.",
    body: "OpenAI-compatible API. Useful Proof of Work under the hood. The same network serves your model and routes traffic to the best nodes.",
    icon: "zap",
    stat: { value: "< 50 ms", label: "p99 inference" },
  },
];

const ROTATE_MS = 6_000;

export function AuthCarousel({ className }: { className?: string }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const total = SLIDES.length;

  // Auto-advance
  React.useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, total]);

  const slide = SLIDES[index]!;
  const Icon = ICONS[slide.icon];

  return (
    <div
      className={cn("relative h-full w-full", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Decorative background: Qubic mesh + dot pattern */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(at 18% 12%, hsla(187, 73%, 50%, 0.22) 0px, transparent 55%), radial-gradient(at 88% 28%, hsla(189, 99%, 69%, 0.16) 0px, transparent 55%), radial-gradient(at 50% 95%, hsla(40, 100%, 78%, 0.12) 0px, transparent 55%), radial-gradient(at 12% 78%, hsla(195, 100%, 60%, 0.12) 0px, transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #FEF8E8 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {/* Floating network graphic, low opacity */}
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#25CAD9] opacity-[0.08] blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#FFDEA1] opacity-[0.06] blur-3xl" />
      </div>

      {/* Slide content */}
      <div className="relative flex h-full w-full flex-col justify-between p-8 pt-32 sm:p-10 sm:pt-36 lg:p-14 lg:pt-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-1 flex-col justify-center"
          >
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#25CAD9]/30 bg-[#25CAD9]/10 px-3 py-1">
              <Icon className="h-3.5 w-3.5 text-[#25CAD9]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#25CAD9]">
                {slide.eyebrow}
              </span>
            </div>

            <h2 className="mt-6 max-w-md text-balance font-display text-4xl font-medium leading-[1.05] tracking-tight text-[#FEF8E8] sm:text-5xl lg:text-[3.5rem]">
              {slide.headline}
            </h2>

            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-[#FEF8E8]/70">
              {slide.body}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Bottom row: stat + dot indicators */}
        <div className="flex items-end justify-between gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`stat-${index}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
            >
              <div className="font-mono text-2xl font-medium tracking-tight text-[#FEF8E8]">
                {slide.stat.value}
              </div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#FEF8E8]/50">
                {slide.stat.label}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.eyebrow}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}: ${s.eyebrow}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-8 bg-[#25CAD9] shadow-[0_0_10px_#25CAD9]"
                    : "w-1.5 bg-[#FEF8E8]/25 hover:bg-[#FEF8E8]/40",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A small floating decoration for the brand panel: 3D-ish node ring. */
export function AuthBrandDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 opacity-20"
        width="500"
        height="500"
        viewBox="0 0 500 500"
        fill="none"
      >
        <defs>
          <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#25CAD9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#25CAD9" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Outer ring of nodes */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const r = 200;
          const x = 250 + Math.cos(angle) * r;
          const y = 250 + Math.sin(angle) * r;
          return (
            <g key={i}>
              <line
                x1="250"
                y1="250"
                x2={x}
                y2={y}
                stroke="#25CAD9"
                strokeWidth="0.5"
                opacity="0.3"
              />
              <circle cx={x} cy={y} r="6" fill="url(#nodeGrad)" />
            </g>
          );
        })}
        {/* Center node */}
        <circle cx="250" cy="250" r="20" fill="#25CAD9" opacity="0.5" />
        <circle cx="250" cy="250" r="40" fill="none" stroke="#25CAD9" strokeWidth="1" opacity="0.4" />
        <circle cx="250" cy="250" r="80" fill="none" stroke="#25CAD9" strokeWidth="0.5" opacity="0.2" />
      </svg>
    </div>
  );
}

// Re-export the icon set for use in code that wants to mirror the carousel.
export const AuthCarouselIcons = { Banknote, Globe, Sprout, Zap, Wallet, Brain, Network };
