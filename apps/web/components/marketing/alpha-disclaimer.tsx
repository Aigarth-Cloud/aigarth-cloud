"use client";

/**
 * Floating Alpha disclaimer banner.
 *
 * Pinned to the bottom-center of every marketing page. Subtle, low-elevation,
 * dismissible (per-session via sessionStorage). Eloquently frames the
 * project as a preview so visitors understand that names, numbers, and
 * screenshots are placeholders to demonstrate the experience, while the
 * underlying Qubic halving on August 19, 2026 (Epoch 227) is real.
 */

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@aigarth/utils";

const STORAGE_KEY = "aigarth.alpha-disclaimer.dismissed";

export function AlphaDisclaimer() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const dismissed = window.sessionStorage.getItem(STORAGE_KEY) === "1";
      if (!dismissed) setOpen(true);
    } catch {
      // sessionStorage can throw in private mode or sandboxed iframes;
      // default to showing the banner rather than crash the page.
      setOpen(true);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* best-effort */
    }
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6"
          role="region"
          aria-label="Alpha preview notice"
        >
          <div
            className={cn(
              "pointer-events-auto flex max-w-2xl items-start gap-3 rounded-full",
              "border border-border/60 bg-background/85 px-4 py-2.5 shadow-lg backdrop-blur-xl",
              "sm:gap-4 sm:px-5"
            )}
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              <span className="font-medium text-foreground">Alpha preview.</span>{" "}
              Aigarth Cloud is in active development. Every name, number and
              screenshot on this site is illustrative, designed to show what
              the experience will feel like. The Epoch 227 halving on{" "}
              <span className="font-medium text-foreground">August 19, 2026</span>{" "}
              is the one thing on the page that is real.
            </p>
            <button
              onClick={dismiss}
              aria-label="Dismiss alpha preview notice"
              className="ml-1 -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
