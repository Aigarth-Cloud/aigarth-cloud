"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Wallet,
  ChevronDown,
  ChevronUp,
  KeyRound,
  ShieldCheck,
  ExternalLink,
  Lock,
  Sparkles,
  Upload,
  Plus,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import { WalletVault, UnlockedSession } from "@/lib/wallet/vault";
import { signatureToBase64Url } from "@/lib/wallet/qubic";
import { WalletVaultDialog } from "@/components/wallet/wallet-vault-dialog";
import { WalletVaultFileImportDialog } from "@/components/wallet/wallet-vault-file-import";
import {
  detectQubicSnap,
  getQubicSnapAddress,
  installQubicSnap,
  signChallengeAsTransaction,
  type SnapDetection,
} from "@/lib/wallet/snap";
import {
  exportAigarthVault,
  downloadAigarthVault,
  type ImportResult,
} from "@/lib/wallet/file-import";

/**
 * ConnectQubicWallet: a Qubic-themed "Sign in with your Qubic wallet" CTA.
 *
 * Five peer options, in priority order. The first one whose preconditions
 * are met becomes the primary CTA. The rest are reachable via "More options".
 *
 *   1. **Browser wallet**: `window.qubic` is probed. If present, we
 *      call its `qubic_requestAccounts` + `qubic_signMessage` methods
 *      and use the returned signature directly. This is the path for
 *      the official Qubic Web Wallet extension and any future EIP-1193
 *      shim that follows the same shape.
 *
 *   2. **MetaMask + Qubic snap**: we probe `window.ethereum` for
 *      MetaMask and `wallet_getSnaps` for `npm:@qubic-lib/qubic-mm-snap`.
 *      The snap exposes `getPublicId` to discover the user's Qubic
 *      address. It does NOT yet expose a `signMessage` RPC, so for
 *      signing we hand off to the in-browser vault (or paste-address
 *      legacy stub if no vault exists for that address). The snap is
 *      effectively an address-discovery convenience today.
 *
 *   3. **In-browser vault**: when no provider is detected, we check
 *      for an encrypted Qubic seed stored locally
 *      (`aigarth:vault:v1` in localStorage, or
 *      `aigarth:vault:session:v1` in sessionStorage). If it exists,
 *      the user unlocks it with their password. If not, we create
 *      one: a fresh 55-char seed, AES-256-GCM-encrypted with a key
 *      derived from the password via PBKDF2-SHA-256 200k iterations.
 *      The unlocked seed is held in-memory only and used to produce
 *      a real 64-byte SchnorrQ signature, which the server verifies
 *      with the official K12 + SchnorrQ_Verify.
 *
 *   4. **Import .qubic-vault file**: the user uploads a vault file
 *      they exported from `wallet.qubic.org` (or from a previous
 *      Aigarth session). Detected formats: encrypted Qubic Web Wallet
 *      JSON, encrypted Aigarth JSON, or a plain 55-char seed. The
 *      seed is decrypted in memory only and not persisted; the user
 *      can later choose to save it as a local vault.
 *
 *   5. **Paste address**: last-resort fallback. The user pastes a
 *      60-char Qubic address. The signature is a deterministic
 *      SHA-256 dev stub, which the server's verifier accepts via
 *      its `stub_unverified` path. The real cryptographic check is
 *      skipped; this exists so the UI is usable while a real wallet
 *      is not yet available.
 *
 *   After either path, POST /api/auth/wallet/start → sign →
 *   POST /api/auth/wallet/finish → server finds-or-creates the user
 *   and sets the session cookie → router.push("/dashboard").
 *
 *   The button is also "link-only" friendly: if the user is already
 *   authenticated, the server's wallet-auth flow simply refreshes
 *   the link: no second account is created.
 */

type Phase =
  | "idle"
  | "detecting"
  | "needs_address"
  | "requesting_nonce"
  | "signing"
  | "verifying"
  | "done"
  | "error";

interface QubicProvider {
  isQubic?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    qubic?: QubicProvider;
  }
}

const QUBIC_ADDRESS_REGEX = /^[A-Z]{60}$/;
const REDIRECT_DEFAULT = "/dashboard";

interface ConnectQubicWalletProps {
  className?: string;
  /** Override default destination after sign-in. */
  redirectTo?: string;
  /** Variant: hero (big, gradient) or compact (secondary button). */
  variant?: "hero" | "compact";
  /** Where to send the user if they prefer email. Empty string hides the link. */
  emailHref?: string;
  /** Optional inline label override. */
  label?: string;
  /** Show the "or" pill + email link next to the wallet button. Default true. */
  showEmailLink?: boolean;
  /**
   * Visual theme.
   *   - "qubic"   : dark Qubic palette (cyan/cream), used on the marketing LP.
   *   - "default" : light/auto, used on the auth pages (signup/login).
   * Default: "qubic" for backwards compatibility.
   */
  theme?: "qubic" | "default";
}

export function ConnectQubicWallet({
  className,
  redirectTo = REDIRECT_DEFAULT,
  variant = "hero",
  emailHref = "/login",
  label,
  showEmailLink = true,
  theme = "qubic",
}: ConnectQubicWalletProps) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [providerDetected, setProviderDetected] = React.useState<boolean | null>(null);
  const [snap, setSnap] = React.useState<SnapDetection | null>(null);
  const [snapAddress, setSnapAddress] = React.useState<string | null>(null);
  const [vaultExists, setVaultExists] = React.useState<boolean | null>(null);
  const [vaultDialogOpen, setVaultDialogOpen] = React.useState(false);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = React.useState(false);
  const [address, setAddress] = React.useState("");
  const [showPaste, setShowPaste] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<boolean | null>(null);

  // Probe for providers + an existing vault on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const detected = Boolean(window.qubic && typeof window.qubic.request === "function");
    setProviderDetected(detected);
    setVaultExists(WalletVault.exists());
    void detectQubicSnap().then(setSnap).catch(() => setSnap({ hasMetaMask: false, hasQubicSnap: false }));
  }, []);

  const primaryLabel = React.useMemo(() => {
    if (label) return label;
    if (providerDetected === true) return "Connect Qubic Wallet";
    if (snap?.hasQubicSnap) return "Connect with Qubic (MetaMask snap)";
    if (vaultExists === true) return "Unlock my Qubic wallet";
    if (vaultExists === false) return "Create a Qubic wallet";
    if (phase === "needs_address") return "Sign in with this address";
    return "Connect Qubic Wallet";
  }, [label, providerDetected, snap, vaultExists, phase]);

  // What the primary button should show as a leading icon, given state
  const primaryIcon = React.useMemo(() => {
    if (providerDetected === true) return Wallet;
    if (snap?.hasQubicSnap) return Sparkles; // we'll use it for the snap too
    if (vaultExists === true) return Lock;
    if (vaultExists === false) return Sparkles;
    return Wallet;
  }, [providerDetected, snap, vaultExists]);

  async function signAndSubmit(addr: string, opts: { forceKind?: "message" | "transaction" } = {}) {
    setError(null);
    try {
      // 1. Get a nonce + canonical message from the server
      setPhase("requesting_nonce");
      const startRes = await fetch("/api/auth/wallet/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!startRes.ok) {
        const body = (await startRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Could not request a nonce (${startRes.status})`);
      }
      const { nonce, message } = (await startRes.json()) as { nonce: string; message: string };

      // 2. Sign the message. Four paths, in priority order:
      //    a. window.qubic browser wallet (real SchnorrQ via extension)
      //    b. MetaMask Qubic snap (kind: "transaction" — Option B)
      //    c. in-browser vault (real SchnorrQ via decrypted seed)
      //    d. paste-address dev stub (format-only on the server)
      setPhase("signing");

      // (a) Browser wallet (window.qubic)
      if (
        !opts.forceKind &&
        typeof window !== "undefined" &&
        window.qubic &&
        typeof window.qubic.request === "function"
      ) {
        try {
          const sigHex = (await window.qubic.request({
            method: "qubic_signMessage",
            params: [addr, message],
          })) as string;
          // The provider returns hex; we need base64url. Convert.
          const signature = hexToBase64Url(sigHex);
          await submitFinish({ address: addr, signature, nonce, kind: "message" });
          return;
        } catch (e) {
          throw new Error(
            `Wallet signing was rejected: ${(e as Error).message ?? "unknown error"}`,
          );
        }
      }

      // (b) MetaMask Qubic snap — Option B. Build a Qubic self-transfer
      // whose input field IS the canonical message, sign via the snap's
      // signTransaction RPC, post kind: "transaction".
      if (
        !opts.forceKind &&
        snap?.hasQubicSnap &&
        typeof window !== "undefined" &&
        window.ethereum?.isMetaMask
      ) {
        const { signedTx, address: snapAddr } = await signChallengeAsTransaction({
          challenge: message,
        });
        // Sanity: the snap-derived address must match what we asked for.
        if (snapAddr !== addr) {
          throw new Error(
            `Snap returned a different address (${snapAddr}) than expected (${addr}). ` +
              "Make sure you're signed in to the right MetaMask account.",
          );
        }
        await submitFinish({ address: addr, signedTx, nonce, kind: "transaction" });
        return;
      }

      // (c) In-browser vault
      const session = WalletVault.active;
      if (session && session.publicAddress === addr) {
        const sigBytes = await session.signMessage(message);
        const signature = signatureToBase64Url(sigBytes);
        await submitFinish({ address: addr, signature, nonce, kind: "message" });
        return;
      }

      // (d) Paste-address dev stub
      const signature = await devStubSign(message);
      await submitFinish({ address: addr, signature, nonce, kind: "message" });
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function submitFinish(body: {
    address: string;
    nonce: string;
    kind: "message" | "transaction";
    signature?: string;
    signedTx?: string;
  }) {
    setPhase("verifying");
    const payload: Record<string, unknown> = {
      address: body.address,
      kind: body.kind,
      nonce: body.nonce,
      label: "Primary",
    };
    if (body.kind === "message") payload.signature = body.signature;
    else payload.signedTx = body.signedTx;
    const finishRes = await fetch("/api/auth/wallet/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!finishRes.ok) {
      const errBody = (await finishRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error ?? `Sign-in failed (${finishRes.status})`);
    }
    const data = (await finishRes.json()) as {
      ok: boolean;
      created: boolean;
      user: { id: string; name: string };
    };
    setCreated(data.created);
    setPhase("done");
    router.push(redirectTo);
    router.refresh();
  }

  async function onPrimaryClick() {
    if (providerDetected === true) {
      // Real wallet path: get the address from the provider, then sign+submit.
      try {
        setPhase("signing");
        const accounts = (await window.qubic!.request({
          method: "qubic_requestAccounts",
        })) as string[];
        const addr = accounts?.[0];
        if (!addr || !QUBIC_ADDRESS_REGEX.test(addr)) {
          setShowPaste(true);
          setPhase("needs_address");
          setError(
            "Your Qubic wallet did not return a valid 60-character address. Paste it below to continue.",
          );
          return;
        }
        await signAndSubmit(addr);
      } catch (e) {
        setShowPaste(true);
        setPhase("needs_address");
        setError(
          `Could not reach your Qubic wallet: ${(e as Error).message ?? "unknown error"}. Paste your address below to continue.`,
        );
      }
      return;
    }
    if (snap?.hasQubicSnap) {
      // Snap path (Phase 21 — Option B): the snap doesn't expose
      // signMessage, so we use signTransaction as a workaround. The
      // client builds a Qubic self-transfer with the auth message
      // embedded in the `input` field, asks the snap to sign it,
      // and submits to /v1/auth/wallet/finish with kind:"transaction".
      // The server's verifyQubicTransactionSignature checks the
      // signature against the embedded challenge.
      try {
        setPhase("signing");
        // signChallengeAsTransaction calls getPublicId internally
        // (which triggers a MetaMask confirm), so we don't pre-fetch
        // the address. We pass the address from the snap callback
        // through signAndSubmit's snap branch.
        const addr = await getQubicSnapAddress(0);
        setSnapAddress(addr);
        await signAndSubmit(addr);
        return;
      } catch (e) {
        const msg = (e as Error).message;
        // If the snap permission is missing, try installing it.
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("not installed")) {
          const installed = await installQubicSnap();
          if (installed) {
            setSnap({ hasMetaMask: true, hasQubicSnap: true });
            setError(null);
            // Re-attempt the click.
            await onPrimaryClick();
            return;
          }
        }
        setError(`Could not reach the Qubic MetaMask snap: ${msg}`);
        setPhase("error");
      }
      return;
    }
    // No browser provider, no snap. Open the vault dialog, which
    // handles both the "vault exists" unlock flow and the "no
    // vault" create flow.
    setVaultDialogOpen(true);
  }

  /**
   * Called by the vault dialog after a successful unlock or create.
   * The vault's decrypted session is now in `WalletVault.active`, so
   * we can drive the auth flow using its public address.
   */
  async function onVaultSuccess(session: UnlockedSession) {
    setVaultExists(true);
    setError(null);
    await signAndSubmit(session.publicAddress);
  }

  /** Switch to the paste-address fallback (used by dialog's "use a different method"). */
  function onUsePasteAddress() {
    setVaultDialogOpen(false);
    setImportDialogOpen(false);
    setShowPaste(true);
    setPhase("needs_address");
  }

  /**
   * Called by the file-import dialog after a successful import.
   * The seed is loaded into a fresh in-memory `UnlockedSession`
   * (no localStorage write). The user can later choose to persist
   * it via the vault dialog if they want.
   */
  async function onImportSuccess(result: ImportResult) {
    try {
      setError(null);
      setPhase("signing");
      // Plain-seed imports don't return an address; derive it now.
      const address = result.address || (await deriveAddressFromSeed(result.seed));
      await WalletVault.loadFromSeed({ seed: result.seed });
      setVaultExists(true);
      await signAndSubmit(address);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  /**
   * Triggered by the import dialog when the user wants to save
   * their just-imported (plain) seed as an encrypted aigarth
   * vault file. Downloads the .qubic-vault.json blob.
   */
  async function onImportRequestDownload(result: ImportResult) {
    try {
      const address =
        result.address || (await deriveAddressFromSeed(result.seed));
      const vault = await exportAigarthVault({
        seed: result.seed,
        password: promptForDownloadPassword(),
        address,
      });
      downloadAigarthVault(vault);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Helper: ask the user for a password (used when exporting a
  // downloaded vault file from a plain-seed import).
  function promptForDownloadPassword(): string {
    // We use a native prompt to keep the flow self-contained in the
    // import dialog. A polished alternative would be a small modal.
    const pwd = typeof window !== "undefined"
      ? window.prompt("Choose a password to encrypt your .qubic-vault file (min 8 chars):", "")
      : "";
    if (!pwd || pwd.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    return pwd;
  }

  async function deriveAddressFromSeed(seed: string): Promise<string> {
    const { deriveQubicAddress } = await import("@/lib/wallet/qubic");
    return deriveQubicAddress(seed);
  }

  function onSubmitAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = address.trim().toUpperCase();
    if (!QUBIC_ADDRESS_REGEX.test(trimmed)) {
      setError("Qubic addresses are 60 uppercase letters (A–Z).");
      return;
    }
    signAndSubmit(trimmed);
  }

  const busy = phase === "requesting_nonce" || phase === "signing" || phase === "verifying";
  const compact = variant === "compact";
  const isQubic = theme === "qubic";

  // Theme-aware color tokens. Centralised so the Qubic palette stays
  // locked to the marketing side, and the default (auto/light/dark)
  // palette uses the standard shadcn tokens.
  const t = {
    primary: isQubic ? "#25CAD9" : "hsl(var(--primary))",
    primaryHover: isQubic ? "#6FE7F2" : "hsl(var(--primary) / 0.9)",
    onPrimary: isQubic ? "#0D121C" : "hsl(var(--primary-foreground))",
    border: isQubic ? "border-[#25CAD9]/30" : "border-border",
    surface: isQubic ? "bg-black/40 backdrop-blur" : "bg-muted/40",
    input:
      isQubic
        ? "border-white/10 bg-black/50 text-[#FEF8E8] placeholder:text-[#FEF8E8]/30 focus:border-[#25CAD9]/60"
        : "border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-primary",
    body: isQubic ? "text-[#FEF8E8]/45" : "text-muted-foreground",
    bodyDim: isQubic ? "text-[#FEF8E8]/40" : "text-muted-foreground/80",
    link: isQubic ? "text-[#25CAD9]" : "text-primary",
    error: "text-red-500 dark:text-red-400",
    outlineBtn: isQubic
      ? "border-[#FEF8E8]/15 bg-transparent text-[#FEF8E8]/80 hover:bg-[#FEF8E8]/10"
      : "border-border bg-transparent text-foreground hover:bg-muted",
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex flex-wrap items-stretch gap-2",
          compact ? "w-full" : "w-full",
        )}
      >
        <Button
          type="button"
          size={compact ? "default" : "lg"}
          disabled={busy}
          onClick={onPrimaryClick}
          className={cn(
            "group relative flex-1 gap-2 overflow-hidden font-medium",
            compact
              ? cn("border bg-transparent hover:bg-primary/10", t.border, t.link)
              : isQubic
                ? "text-[#0D121C]"
                : "text-primary-foreground",
          )}
          style={
            compact
              ? undefined
              : isQubic
                ? {
                    background: t.primary,
                    boxShadow:
                      "0 0 0 1px rgba(37,202,217,0.4), 0 12px 32px -8px rgba(37,202,217,0.55)",
                  }
                : undefined
          }
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>{(() => {
              const Icon = primaryIcon;
              return <Icon className="h-4 w-4" />;
            })()}</>
          )}
          {primaryLabel}
        </Button>

        {showEmailLink && emailHref && (
          <a
            href={emailHref}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md text-sm transition-colors",
              compact ? "h-10 px-3" : "h-12 px-4",
              t.outlineBtn,
            )}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Sign in with email
          </a>
        )}
      </div>

      <AnimatePresence>
        {showPaste && providerDetected === false && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-3 overflow-hidden"
          >
            <form
              onSubmit={onSubmitAddress}
              className={cn("rounded-xl border p-3", t.border, t.surface)}
            >
              <label
                htmlFor="qubic-address"
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em]",
                  t.link,
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                Paste your Qubic address
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="qubic-address"
                  name="address"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFG"
                  maxLength={60}
                  disabled={busy}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 font-mono text-xs uppercase tracking-wider outline-none",
                    t.input,
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || address.length === 0}
                  className="gap-1.5"
                  style={
                    isQubic
                      ? { background: t.primary, color: t.onPrimary }
                      : undefined
                  }
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign in"}
                </Button>
              </div>
              <p className={cn("mt-2 text-[10px]", t.body)}>
                60 uppercase letters (A–Z). No email, no KYC. The wallet is your identity.
                <a
                  href="https://docs.qubic.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("ml-1 inline-flex items-center gap-0.5 hover:underline", t.link)}
                >
                  What is a Qubic address?
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("mt-2 text-xs", t.error)}
        >
          {error}
        </motion.p>
      )}

      {providerDetected === false && phase === "idle" && !showPaste && (
        <div className="mt-2 space-y-1">
          <p className={cn("text-[10px]", t.bodyDim)}>
            {vaultExists
              ? "Vault detected on this device. Unlock with your password to continue."
              : snap?.hasQubicSnap
                ? `Qubic MetaMask snap detected. Click the button above to use it.`
                : "No Qubic browser wallet detected. Create a vault on this device, or use a different method."}
          </p>
        </div>
      )}

      {/* More options: secondary peer connections. Hidden behind a
          disclosure so the primary CTA stays prominent. */}
      {!busy && phase === "idle" && !showPaste && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMoreOptionsOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em]",
              t.bodyDim,
              "hover:opacity-100",
            )}
            aria-expanded={moreOptionsOpen}
          >
            More options
            {moreOptionsOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          <AnimatePresence>
            {moreOptionsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="mt-2 grid grid-cols-1 gap-2 overflow-hidden sm:grid-cols-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMoreOptionsOpen(false);
                    setImportDialogOpen(true);
                  }}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                    t.border,
                    t.surface,
                    "hover:border-primary/60",
                  )}
                >
                  <Upload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div>
                    <div className="text-[11px] font-medium text-foreground">
                      Load saved wallet file
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      Opens a file picker: .qubic-vault (Qubic Web
                      Wallet), aigarth export, or a 55-char seed.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOptionsOpen(false);
                    setShowPaste(true);
                    setPhase("needs_address");
                  }}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                    t.border,
                    t.surface,
                    "hover:border-primary/60",
                  )}
                >
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div>
                    <div className="text-[11px] font-medium text-foreground">
                      Use a different address
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      Paste a 60-char Qubic address. Dev-stub signing.
                    </div>
                  </div>
                </button>
                {snap && !snap.hasQubicSnap && (
                  <button
                    type="button"
                    onClick={async () => {
                      setMoreOptionsOpen(false);
                      const ok = await installQubicSnap();
                      if (ok) {
                        setSnap({ hasMetaMask: snap.hasMetaMask, hasQubicSnap: true });
                        setError(null);
                      } else {
                        setError("Snap install was rejected or MetaMask Flask is not installed.");
                      }
                    }}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors sm:col-span-2",
                      t.border,
                      t.surface,
                      "hover:border-primary/60",
                    )}
                  >
                    <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div>
                      <div className="text-[11px] font-medium text-foreground">
                        Install the Qubic MetaMask snap
                      </div>
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                        For users with MetaMask Flask. The snap exposes
                        your Qubic address; signing still needs a vault.
                      </div>
                    </div>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {created === true && phase === "done" && (
        <p className={cn("mt-2 text-[10px]", t.link)}>
          New account created: welcome aboard.
        </p>
      )}

      {/* The encrypted in-browser vault. Opens on primary click when
          no `window.qubic` provider is present. Hands off to signAndSubmit
          via the onVaultSuccess callback once the user has unlocked or
          created their vault. */}
      <WalletVaultDialog
        open={vaultDialogOpen}
        onOpenChange={setVaultDialogOpen}
        onSuccess={onVaultSuccess}
        onUsePasteAddress={onUsePasteAddress}
      />

      {/* File import dialog. The `autoOpenFilePicker` flag triggers
          the native OS file dialog the moment the dialog opens, so
          the user gets a file picker rather than a modal with a drop
          zone first. Drag-and-drop and click-to-pick are still
          available inside the dialog. */}
      <WalletVaultFileImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={onImportSuccess}
        onUsePasteAddress={onUsePasteAddress}
        onRequestDownload={onImportRequestDownload}
        autoOpenFilePicker
      />
    </div>
  );
}

// ---------- Helpers ----------

/**
 * Dev-stub signature: deterministic SHA-256 of the message, encoded as
 * base64url. The server's verifyQubicSignature() is a format-validated
 * stub today; this gives a well-formed blob of the right shape so the
 * verify step accepts it. Swap for real K12-based signing once a Qubic
 * wallet provider is integrated.
 */
async function devStubSign(message: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(message));
  return bytesToBase64Url(new Uint8Array(buf));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hexToBase64Url(hex: string): string {
  // strip 0x prefix if present
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error("Invalid hex signature length");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytesToBase64Url(bytes);
}
