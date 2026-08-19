"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Sun, Moon, Check, Sparkles, X } from "lucide-react";
import { Button } from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import {
  BRANDS,
  DEFAULT_BRAND,
  DEFAULT_MODE,
  STORAGE_KEY_BRAND,
  STORAGE_KEY_MODE,
  type BrandId,
  type ModeId,
} from "@aigarth/utils/theme";

const STORAGE_BRAND = STORAGE_KEY_BRAND;
const STORAGE_MODE = STORAGE_KEY_MODE;

export function ThemeSelector() {
  const [open, setOpen] = React.useState(false);
  const [brand, setBrand] = React.useState<BrandId>(DEFAULT_BRAND);
  const [mode, setMode] = React.useState<ModeId>(DEFAULT_MODE);
  const [mounted, setMounted] = React.useState(false);

  // Load preferences on mount
  React.useEffect(() => {
    setMounted(true);
    const savedBrand = (typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_BRAND)) as BrandId | null;
    const savedMode = (typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_MODE)) as ModeId | null;

    if (savedBrand && (savedBrand === "garden" || savedBrand === "qubic")) {
      setBrand(savedBrand);
    }
    if (savedMode && (savedMode === "light" || savedMode === "dark")) {
      setMode(savedMode);
    }
  }, []);

  // Apply preferences to <html>
  React.useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.dataset.brand = brand;
    root.classList.remove("light", "dark");
    root.classList.add(mode);
    root.style.colorScheme = mode;
    window.localStorage.setItem(STORAGE_BRAND, brand);
    window.localStorage.setItem(STORAGE_MODE, mode);
  }, [brand, mode, mounted]);

  const active = BRANDS.find((b) => b.id === brand)!;

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-24 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-2xl",
          "border border-border bg-card text-foreground transition-transform hover:scale-105",
          open && "scale-90 opacity-0 pointer-events-none"
        )}
        aria-label="Open theme selector"
        title="Theme"
      >
        <Palette className="h-5 w-5" />
        <span
          className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background"
          style={{ background: active.swatches[mode].from }}
          aria-hidden
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Palette className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Theme</div>
                  <div className="text-xs text-muted-foreground">
                    {active.name} · {mode}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close theme selector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Brand */}
              <div>
                <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Brand
                </div>
                <div className="space-y-2">
                  {BRANDS.map((b) => {
                    const isActive = brand === b.id;
                    const swatch = b.swatches[mode];
                    return (
                      <button
                        key={b.id}
                        onClick={() => setBrand(b.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-foreground/30 hover:bg-accent"
                        )}
                      >
                        <div
                          className="h-10 w-10 shrink-0 rounded-lg"
                          style={{
                            background: `linear-gradient(135deg, ${swatch.from} 0%, ${swatch.via} 50%, ${swatch.to} 100%)`,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{b.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {b.tagline}
                          </div>
                        </div>
                        {isActive && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode */}
              <div>
                <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mode
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ModeButton
                    icon={Sun}
                    label="Light"
                    active={mode === "light"}
                    onClick={() => setMode("light")}
                  />
                  <ModeButton
                    icon={Moon}
                    label="Dark"
                    active={mode === "dark"}
                    onClick={() => setMode("dark")}
                  />
                </div>
              </div>

              {/* Live preview swatch */}
              <div>
                <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Preview
                </div>
                <div
                  className="overflow-hidden rounded-xl border"
                  style={{
                    background: `linear-gradient(135deg, ${active.swatches[mode].from} 0%, ${active.swatches[mode].via} 50%, ${active.swatches[mode].to} 100%)`,
                  }}
                >
                  <div className="bg-card/90 m-2 rounded-lg p-3 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">Aigarth</span>
                    </div>
                    <div
                      className="mt-1 text-base font-medium leading-tight"
                      style={{
                        background: `linear-gradient(135deg, ${active.swatches[mode].from} 0%, ${active.swatches[mode].via} 50%, ${active.swatches[mode].to} 100%)`,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      The Garden of Compute
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      Stake. Reserve. Build. Earn.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
