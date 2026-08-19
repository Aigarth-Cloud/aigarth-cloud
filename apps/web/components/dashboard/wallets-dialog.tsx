"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Plus,
  Loader2,
  Check,
  Copy,
  Trash2,
  AlertCircle,
  X,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import { prewarmQubic, deriveQubicAddress, signQubicMessage } from "@/lib/wallet/qubic";

/**
 * WalletsDialog: manage the user's linked Qubic wallets.
 *
 * - Lists all currently linked wallets
 * - Highlights the active wallet (the one that signed in this session)
 * - "Link another wallet": paste the new address + 55-char seed,
 *   we sign a nonce server-issued, submit to /v1/wallets/link/finish.
 *   The new wallet is now linked to the same account.
 * - "Remove" unlinks a wallet (only the non-active ones are removable
 *   from this dialog: the active one is the user's identity).
 */

interface LinkedWallet {
  id: string;
  address: string;
  verified_at: string | null;
  created_at: string;
}

interface WalletsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 12-character prefix of the wallet address that signed in this
   * session. The wallet in the list whose address starts with this
   * prefix is marked as active.
   */
  activeAddressPrefix?: string | null;
}

type Mode = "list" | "link" | "linking" | "linked";

const SEED_REGEX = /^[a-z]{55}$/;
const ADDRESS_REGEX = /^[A-Z]{60}$/;

function abbreviate(addr: string): string {
  if (addr.length < 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export function WalletsDialog({ open, onOpenChange, activeAddressPrefix }: WalletsDialogProps) {
  const [mode, setMode] = React.useState<Mode>("list");
  const [wallets, setWallets] = React.useState<LinkedWallet[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  // Link-another-wallet form state
  const [newAddress, setNewAddress] = React.useState("");
  const [newSeed, setNewSeed] = React.useState("");
  const [showSeed, setShowSeed] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/wallets", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load wallets (${res.status})`);
      }
      const data = (await res.json()) as { data: LinkedWallet[] };
      setWallets(data.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Pre-warm the Qubic WASM so the first link attempt is fast
  React.useEffect(() => {
    prewarmQubic();
  }, []);

  React.useEffect(() => {
    if (open) {
      setMode("list");
      setNewAddress("");
      setNewSeed("");
      setShowSeed(false);
      void refresh();
    }
  }, [open, refresh]);

  async function onUnlink(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Unlink failed (${res.status})`);
      }
      setConfirming(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onLink() {
    setError(null);
    const addr = newAddress.trim().toUpperCase();
    if (!ADDRESS_REGEX.test(addr)) {
      setError("Address must be exactly 60 uppercase A–Z letters.");
      return;
    }
    if (!SEED_REGEX.test(newSeed.trim())) {
      setError("Seed must be exactly 55 lowercase a–z letters.");
      return;
    }
    setBusy(true);
    setMode("linking");
    try {
      // 1. Ask the server for a nonce + canonical message to sign
      const startRes = await fetch("/api/wallets/link/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!startRes.ok) {
        const body = (await startRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Could not request a nonce (${startRes.status})`);
      }
      const { message } = (await startRes.json()) as { nonce: string; message: string };

      // 2. Sign the message with the new wallet's seed (real 64-byte SchnorrQ)
      const sigBytes = await signQubicMessage(newSeed.trim(), message);
      const signature = bytesToBase64Url(sigBytes);

      // 3. Submit
      const finishRes = await fetch("/api/wallets/link/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr, signature, label: "Imported" }),
      });
      if (!finishRes.ok) {
        const body = (await finishRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Link failed (${finishRes.status})`);
      }

      // 4. Refresh the list and show success
      await refresh();
      setMode("linked");
      setNewAddress("");
      setNewSeed("");
    } catch (e) {
      setError((e as Error).message);
      setMode("link");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
                  <Wallet className="h-3.5 w-3.5" />
                  Linked wallets
                </div>
                <DialogTitle>Your Qubic wallets</DialogTitle>
                <DialogDescription>
                  Wallets linked to this account. Sign in or pay with
                  any of them. The one you used this session is the
                  active wallet.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
                {wallets.length === 0 && !error && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No wallets linked yet.
                  </div>
                )}
                {wallets.map((w) => {
                  const isActive = Boolean(
                    activeAddressPrefix &&
                      w.address
                        .toUpperCase()
                        .startsWith(activeAddressPrefix.toUpperCase()),
                  );
                  return (
                    <div
                      key={w.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        isActive
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-background",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onCopy(w.address)}
                          className="group flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-mono text-sm">
                              {abbreviate(w.address)}
                            </span>
                            {copied === w.address ? (
                              <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            {isActive && (
                              <span className="font-mono uppercase tracking-wider text-primary">
                                Active · this session
                              </span>
                            )}
                            <span>
                              Linked{" "}
                              {new Date(w.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </button>
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => setConfirming(w.id)}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Unlink wallet"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {confirming === w.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 flex items-center gap-2 overflow-hidden rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs"
                          >
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                            <span className="flex-1 text-destructive">
                              Unlink this wallet? You'll need its seed to sign in again.
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => onUnlink(w.id)}
                              className="h-7"
                            >
                              {busy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Unlink"
                              )}
                            </Button>
                            <button
                              type="button"
                              onClick={() => setConfirming(null)}
                              className="rounded p-1 text-muted-foreground hover:text-foreground"
                              aria-label="Cancel"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setMode("link");
                    setError(null);
                  }}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Link another wallet
                </Button>
              </div>
            </motion.div>
          )}

          {mode === "link" && (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Link wallet
                </div>
                <DialogTitle>Link another wallet</DialogTitle>
                <DialogDescription>
                  Paste the new wallet's 60-character address and its
                  55-character seed. We sign a nonce to prove ownership
                  and link it to this account.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="new-wallet-address"
                    className="mb-1.5 block text-xs font-medium text-foreground"
                  >
                    New wallet address
                  </label>
                  <Input
                    id="new-wallet-address"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFG"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={60}
                    className="font-mono text-xs uppercase tracking-wider"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-wallet-seed"
                    className="mb-1.5 block text-xs font-medium text-foreground"
                  >
                    55-character seed
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-wallet-seed"
                      type={showSeed ? "text" : "password"}
                      value={newSeed}
                      onChange={(e) => setNewSeed(e.target.value)}
                      placeholder="abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabc"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={55}
                      className="pl-10 pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSeed(!showSeed)}
                      tabIndex={-1}
                      aria-label={showSeed ? "Hide seed" : "Show seed"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showSeed ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMode("list");
                      setError(null);
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      newAddress.length !== 60 ||
                      newSeed.length !== 55
                    }
                    onClick={onLink}
                    className="flex-1 gap-2"
                  >
                    Link wallet
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "linking" && (
            <motion.div
              key="linking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-12"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Signing with the new wallet…
              </p>
            </motion.div>
          )}

          {mode === "linked" && (
            <motion.div
              key="linked"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-500">
                  <Check className="h-3.5 w-3.5" />
                  Linked
                </div>
                <DialogTitle>New wallet linked</DialogTitle>
                <DialogDescription>
                  The wallet is now linked to this account. Sign in
                  with it from the connect flow and the server will
                  recognize you as the same user.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-5 flex">
                <Button
                  type="button"
                  onClick={() => setMode("list")}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  const b64 = typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function ArrowRight({ className }: { className?: string }) {
  // Tiny local re-export to avoid an extra lucide-react import dance.
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
