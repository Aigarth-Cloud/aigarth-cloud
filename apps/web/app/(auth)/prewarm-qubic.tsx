"use client";

import * as React from "react";
import { prewarmQubic } from "@/lib/wallet/qubic";

/**
 * Pre-warm the Qubic WASM module on first paint.
 *
 * `@qubic-lib/qubic-ts-library` ships an Emscripten-compiled WASM
 * binary that takes ~1-2s to initialise on a cold load. If we wait
 * until the user clicks "Sign in" before kicking it off, the first
 * interaction sits in a multi-second pause before the wallet
 * dialog even appears.
 *
 * Mounting this component (no UI, no children) at the top of the
 * auth layout means the WASM is already initialising while the
 * user reads the page. By the time they reach the wallet button,
 * the load is done and signing starts immediately.
 *
 * Safe to mount on every page render: `prewarmQubic` is a
 * single-flight no-op after the first call.
 */
export function PrewarmQubic() {
  React.useEffect(() => {
    prewarmQubic();
  }, []);
  return null;
}
