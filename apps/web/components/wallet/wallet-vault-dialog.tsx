"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
  AlertCircle,
  ArrowRight,
  Lock,
  Sparkles,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Switch,
} from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import { WalletVault, UnlockedSession, type VaultStorageMode } from "@/lib/wallet/vault";
import { exportAigarthVault, downloadAigarthVault } from "@/lib/wallet/file-import";

/**
 * WalletVaultDialog: the in-browser encrypted Qubic wallet vault.
 *
 * Mirrors the UX of wallet.qubic.org and the Qubic Web Wallet:
 *   - Password never leaves the device.
 *   - 55-char seed generated client-side, encrypted with AES-256-GCM
 *     (key from PBKDF2-SHA-256 200k iterations), stored in
 *     localStorage (Remember me) or sessionStorage.
 *   - Real Qubic SchnorrQ signatures, verified server-side via K12 +
 *     SchnorrQ_Verify.
 *
 * Three flows:
 *   1. "unlock" / existing vault → password only → session restored.
 *   2. "create" / no vault      → password + Remember me → seed
 *      shown once for backup → session active.
 *   3. Fallback to paste-address is offered at the bottom.
 *
 * The parent (ConnectQubicWallet) reads the unlocked session via
 * `WalletVault.active` and uses it to sign the auth nonce. The seed
 * is held in-memory only and zeroed on lock.
 */

type DialogMode = "unlock" | "create" | "seed-backup" | "error";

interface WalletVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * On successful unlock/create, called with the live session. Parent
   * is expected to use `WalletVault.active` to sign the auth nonce.
   */
  onSuccess?: (session: UnlockedSession) => void;
  /**
   * Show a "use a different method" affordance that opens the
   * paste-address flow instead. Default: true.
   */
  onUsePasteAddress?: () => void;
  /**
   * When the user cancels without unlocking, also clear the in-memory
   * session so the parent doesn't accidentally sign with a half-loaded
   * vault. Default: true.
   */
  clearOnCancel?: boolean;
  /**
   * Allow the user to skip the one-time seed backup screen (dev only).
   * Defaults to `process.env.NODE_ENV === "development"`. In production
   * the user is forced through the "I've saved it" gate so the seed
   * is the only time the plaintext is visible.
   */
  forceCloseable?: boolean;
}

function isDevMode(): boolean {
  // process.env.NODE_ENV is inlined at build time; this branch is
  // tree-shaken away in production builds.
  try {
    return process.env.NODE_ENV === "development";
  } catch {
    return false;
  }
}

export function WalletVaultDialog({
  open,
  onOpenChange,
  onSuccess,
  onUsePasteAddress,
  clearOnCancel = true,
  forceCloseable,
}: WalletVaultDialogProps) {
  const allowSkip = forceCloseable ?? isDevMode();
  // Detect at first open whether a vault already exists, and pick the
  // initial mode accordingly. Recomputed every time the dialog opens.
  const [mode, setMode] = React.useState<DialogMode>("create");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState<VaultStorageMode>("remember");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<UnlockedSession | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Reset state on every open. Without this, a previous failed attempt
  // would leak its password + error into the next attempt.
  React.useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setBusy(false);
    setError(null);
    setCopied(false);
    const exists = WalletVault.exists();
    setMode(exists ? "unlock" : "create");
  }, [open]);

  // Lock the vault on close so a half-session doesn't linger in the
  // parent's signer pool.
  React.useEffect(() => {
    if (open) return;
    if (clearOnCancel && mode !== "seed-backup") {
      // If we never reached seed-backup, no vault was created: but
      // if the user unlocked + then cancelled, the in-memory session
      // is theirs; we only clear if we explicitly want that.
      if (mode === "error") WalletVault.lock();
    }
  }, [open, clearOnCancel, mode]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setBusy(true);
      if (mode === "create") {
        if (password !== confirm) {
          throw new Error("Passwords don't match.");
        }
        const created = await WalletVault.create({ password, mode: remember });
        setSession(created);
        // Show the seed backup screen before closing.
        setMode("seed-backup");
      } else {
        const unlocked = await WalletVault.unlock({ password });
        setSession(unlocked);
        // Close the dialog and let the parent drive the auth flow.
        onOpenChange(false);
        onSuccess?.(unlocked);
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      setMode(msg === "Wrong password" ? "unlock" : "error");
    } finally {
      setBusy(false);
    }
  }

  function handleContinueAfterBackup() {
    onOpenChange(false);
    if (session) onSuccess?.(session);
  }

  async function handleDownloadVault() {
    if (!session) return;
    const seed = session.getSecretSeed();
    const password =
      typeof window !== "undefined"
        ? window.prompt(
            "Choose a password to encrypt your .qubic-vault file (min 8 chars):",
            "",
          )
        : "";
    if (!password || password.length < 8) {
      // No native toast here: the prompt cancel / short value is the
      // signal. We could surface a non-blocking error if needed.
      return;
    }
    try {
      const vault = await exportAigarthVault({
        seed,
        password,
        address: session.publicAddress,
      });
      downloadAigarthVault(vault);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copySeed() {
    if (!session) return;
    try {
      const seed = session.getSecretSeed();
      await navigator.clipboard.writeText(seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to clipboard. Please copy the seed manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          "border-border bg-card text-foreground",
        )}
        onPointerDownOutside={(e) => {
          // Don't allow the user to dismiss mid-create without seeing the
          // seed backup. Force them through the "I've saved it" button.
          // Dev mode is exempt so the escape hatch is usable.
          if (mode === "seed-backup" && !allowSkip) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (mode === "seed-backup" && !allowSkip) e.preventDefault();
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mode === "unlock" && (
            <UnlockView
              key="unlock"
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              busy={busy}
              error={error}
              onSubmit={handleSubmit}
              onUsePaste={onUsePasteAddress}
            />
          )}
          {mode === "create" && (
            <CreateView
              key="create"
              password={password}
              setPassword={setPassword}
              confirm={confirm}
              setConfirm={setConfirm}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              remember={remember}
              setRemember={setRemember}
              busy={busy}
              error={error}
              onSubmit={handleSubmit}
              onUsePaste={onUsePasteAddress}
            />
          )}
          {mode === "seed-backup" && session && (
            <SeedBackupView
              key="seed-backup"
              seed={session.getSecretSeed()}
              address={session.publicAddress}
              copied={copied}
              onCopy={copySeed}
              onContinue={handleContinueAfterBackup}
              onDownload={handleDownloadVault}
              onSkipBackup={
                allowSkip
                  ? () => {
                      // Loud warning so the dev sees what they did.
                      // eslint-disable-next-line no-console
                      console.warn(
                        "[WalletVault] Seed backup skipped (dev mode). The seed has been generated and is encrypted on this device, but was not shown to the user. If you need it, open the browser console and call `WalletVault.active?.getSecretSeed()` while the vault is unlocked.",
                      );
                      handleContinueAfterBackup();
                    }
                  : undefined
              }
            />
          )}
          {mode === "error" && (
            <ErrorView
              key="error"
              error={error}
              onRetry={() => {
                setError(null);
                setMode(WalletVault.exists() ? "unlock" : "create");
              }}
              onUsePaste={onUsePasteAddress}
            />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================
// Sub-views
// =================================================================

function UnlockView({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  busy,
  error,
  onSubmit,
  onUsePaste,
}: {
  password: string;
  setPassword: (s: string) => void;
  showPassword: boolean;
  setShowPassword: (b: boolean) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onUsePaste?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <DialogHeader>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
          <Lock className="h-3.5 w-3.5" />
          Vault · unlock
        </div>
        <DialogTitle>Unlock your Qubic wallet</DialogTitle>
        <DialogDescription>
          Enter the password you used when you created this vault. Your
          seed never leaves this device, decrypted in memory only.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <PasswordField
          id="vault-password"
          label="Password"
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword(!showPassword)}
          autoFocus
        />
        {error && <ErrorBanner message={error} />}
        <Button
          type="submit"
          className="w-full gap-2"
          disabled={busy || password.length < 8}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Unlock
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {onUsePaste && (
          <button
            type="button"
            onClick={onUsePaste}
            className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
          >
            Use a different method
          </button>
        )}
      </form>
    </motion.div>
  );
}

function CreateView({
  password,
  setPassword,
  confirm,
  setConfirm,
  showPassword,
  setShowPassword,
  remember,
  setRemember,
  busy,
  error,
  onSubmit,
  onUsePaste,
}: {
  password: string;
  setPassword: (s: string) => void;
  confirm: string;
  setConfirm: (s: string) => void;
  showPassword: boolean;
  setShowPassword: (b: boolean) => void;
  remember: VaultStorageMode;
  setRemember: (m: VaultStorageMode) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onUsePaste?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <DialogHeader>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Vault · create
        </div>
        <DialogTitle>Create your Qubic wallet</DialogTitle>
        <DialogDescription>
          A new 55-character seed is generated on this device, encrypted
          with your password, and stored in your browser. Lose the password
          and the seed is gone. There is no recovery.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <PasswordField
          id="vault-password"
          label="New password"
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword(!showPassword)}
          autoFocus
        />
        <PasswordField
          id="vault-confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          showPassword={showPassword}
          onToggleShow={() => setShowPassword(!showPassword)}
        />
        <RememberToggle value={remember} onChange={setRemember} />
        {error && <ErrorBanner message={error} />}
        <Button
          type="submit"
          className="w-full gap-2"
          disabled={busy || password.length < 8 || password !== confirm}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Create wallet
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {onUsePaste && (
          <button
            type="button"
            onClick={onUsePaste}
            className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
          >
            Use a different method
          </button>
        )}
      </form>
    </motion.div>
  );
}

function SeedBackupView({
  seed,
  address,
  copied,
  onCopy,
  onContinue,
  onSkipBackup,
  onDownload,
}: {
  seed: string;
  address: string;
  copied: boolean;
  onCopy: () => void;
  onContinue: () => void;
  /**
   * Dev-only escape hatch: when provided, render a small "Skip
   * (dev only)" button below the primary CTA. Not rendered in
   * production: the gate is `forceCloseable ?? NODE_ENV==="development"`.
   */
  onSkipBackup?: () => void;
  /**
   * Optional: when provided, render a "Download .qubic-vault" button
   * that saves the seed in the aigarth vault file format. Prompts
   * for an encryption password.
   */
  onDownload?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <DialogHeader>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-amber-500">
          <Shield className="h-3.5 w-3.5" />
          One-time backup
        </div>
        <DialogTitle>Save your seed</DialogTitle>
        <DialogDescription>
          This is the only time you'll see this seed. Write it down or
          store it in a password manager. Without it, this vault cannot
          be recovered.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-5 space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">
              Seed (55 characters)
            </label>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="break-all rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 font-mono text-xs leading-relaxed text-foreground">
            {seed}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            Your Qubic address
          </label>
          <div className="break-all rounded-lg border border-border bg-muted/30 p-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {address}
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
          <strong className="block">Don't skip this.</strong>
          Aigarth cannot recover your seed. If you lose your password or
          this device, the wallet, and any account tied to it: is gone.
        </div>

        <Button
          type="button"
          onClick={onContinue}
          className="w-full gap-2"
        >
          I've saved it: continue
          <ArrowRight className="h-4 w-4" />
        </Button>

        {onDownload && (
          <Button
            type="button"
            variant="outline"
            onClick={onDownload}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Download as .qubic-vault
          </Button>
        )}

        {onSkipBackup && (
          <div className="rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 p-2.5 text-center">
            <button
              type="button"
              onClick={onSkipBackup}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700 underline-offset-2 hover:text-amber-800 hover:underline dark:text-amber-300 dark:hover:text-amber-200"
            >
              Skip backup · dev only
            </button>
            <p className="mt-1 text-[10px] leading-snug text-amber-700/80 dark:text-amber-300/80">
              The seed was generated and encrypted on this device, but you
              didn't save it. For testing flows only: never use in
              production.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ErrorView({
  error,
  onRetry,
  onUsePaste,
}: {
  error: string | null;
  onRetry: () => void;
  onUsePaste?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <DialogHeader>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-red-500">
          <AlertCircle className="h-3.5 w-3.5" />
          Vault · error
        </div>
        <DialogTitle>Something went wrong</DialogTitle>
        <DialogDescription>
          {error ?? "An unexpected error occurred. Please try again."}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-5 flex flex-col gap-2">
        <Button type="button" onClick={onRetry} className="w-full">
          Try again
        </Button>
        {onUsePaste && (
          <button
            type="button"
            onClick={onUsePaste}
            className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
          >
            Use a different method
          </button>
        )}
      </div>
    </motion.div>
  );
}

// =================================================================
// Atoms
// =================================================================

function PasswordField({
  id,
  label,
  value,
  onChange,
  showPassword,
  onToggleShow,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (s: string) => void;
  showPassword: boolean;
  onToggleShow: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between text-xs font-medium text-foreground"
      >
        <span>{label}</span>
      </label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          autoFocus={autoFocus}
          required
          minLength={8}
          className="pl-10 pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function RememberToggle({
  value,
  onChange,
}: {
  value: VaultStorageMode;
  onChange: (m: VaultStorageMode) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div>
        <div className="text-xs font-medium text-foreground">
          Remember me on this device
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {value === "remember"
            ? "Vault stays in localStorage. You only need your password on new devices."
            : "Vault is wiped when you close the tab. Use this on shared computers."}
        </p>
      </div>
      <Switch
        checked={value === "remember"}
        onCheckedChange={(c) => onChange(c ? "remember" : "session")}
        className="mt-0.5"
      />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
