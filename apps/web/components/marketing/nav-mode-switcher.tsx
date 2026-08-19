"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Sparkles } from "lucide-react";
import { cn } from "@aigarth/utils";
import { useNavMode, type NavMode } from "./use-nav-mode";

/**
 * Floating, dock-style nav mode switcher.
 * Sits at the bottom-left of the viewport and lets the user flip between
 * the simple OpenAI-style nav and the full advanced nav.
 *
 * Hidden on small viewports because the mobile hamburger already exposes
 * every link: no need to duplicate chrome on phones.
 */
export function NavModeSwitcher() {
  const { mode, mounted, setMode } = useNavMode();
  const [dismissed, setDismissed] = React.useState(false);

  // Auto-dismiss the "new" callout the first time a user sees the switcher.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("aigarth:nav-switcher-seen") === "1") {
      setDismissed(true);
    } else {
      window.sessionStorage.setItem("aigarth:nav-switcher-seen", "1");
    }
  }, []);

  if (!mounted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-5 left-5 z-40 hidden md:block"
      role="region"
      aria-label="Nav mode switcher"
    >
      <div
        className={cn(
          "flex items-center gap-1 rounded-full border bg-background/80 p-1 shadow-lg backdrop-blur-xl",
          "border-border/70"
        )}
      >
        <ModeButton
          active={mode === "simple"}
          onClick={() => setMode("simple")}
          label="Simple"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
        <ModeButton
          active={mode === "advanced"}
          onClick={() => setMode("advanced")}
          label="Advanced"
          icon={<LayoutGrid className="h-3.5 w-3.5" />}
        />
      </div>

      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2, duration: 0.3 }}
          className="absolute -top-9 left-0 whitespace-nowrap rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-md backdrop-blur"
        >
          New: simple nav
          <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-garden-500 align-middle" />
        </motion.div>
      )}
    </motion.div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-mode-pill"
          className="absolute inset-0 rounded-full bg-foreground/10"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

export { type NavMode };
