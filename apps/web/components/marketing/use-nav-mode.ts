"use client";

import * as React from "react";

export type NavMode = "simple" | "advanced";

const STORAGE_KEY = "aigarth:nav-mode";
const DEFAULT_MODE: NavMode = "simple";
const MODE_EVENT = "aigarth:nav-mode-change";

function readMode(): NavMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "advanced" || v === "simple" ? v : DEFAULT_MODE;
}

function writeMode(mode: NavMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent<NavMode>(MODE_EVENT, { detail: mode }));
}

/**
 * Single source of truth for the nav mode (Simple | Advanced).
 * Reads from localStorage on mount, syncs across tabs and within the
 * same tab via a custom event so the switcher and the nav stay in lockstep.
 */
export function useNavMode(): {
  mode: NavMode;
  mounted: boolean;
  setMode: (next: NavMode) => void;
} {
  const [mode, setMode] = React.useState<NavMode>(DEFAULT_MODE);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMode(readMode());
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMode(readMode());
    };
    const onCustom = (e: Event) => {
      const next = (e as CustomEvent<NavMode>).detail;
      if (next === "simple" || next === "advanced") setMode(next);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(MODE_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MODE_EVENT, onCustom as EventListener);
    };
  }, []);

  const update = React.useCallback((next: NavMode) => {
    setMode(next);
    writeMode(next);
  }, []);

  return { mode, mounted, setMode: update };
}

export const NAV_MODE_STORAGE_KEY = STORAGE_KEY;
