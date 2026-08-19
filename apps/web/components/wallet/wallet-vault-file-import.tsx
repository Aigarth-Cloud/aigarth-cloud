"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Upload,
  FileJson,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ArrowRight,
  Lock,
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
} from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import {
  detectVaultFileFormat,
  detectVaultStringFormat,
  importQubicVault,
  type DetectedFormat,
  type QubicSeedInfo,
  type ImportResult,
} from "@/lib/wallet/file-import";

/**
 * WalletVaultFileImportDialog: import a Qubic vault from a file.
 *
 * Accepts three on-disk formats (detected automatically):
 *   1. `.qubic-vault` exported from wallet.qubic.org (encrypted)
 *   2. `.qubic-vault.json` exported from Aigarth (encrypted)
 *   3. A 55-character plain seed (text file, no password)
 *
 * The flow:
 *   - Drop a file (or click to pick)
 *   - We detect the format
 *   - If password-protected, prompt
 *   - If multi-seed vault, ask the user to pick an address
 *   - On success, hand the seed + address back to the parent
 *
 * The seed is loaded into `WalletVault.active` as an in-memory
 * session only. Persistence is the user's choice (they can later
 * "save to my in-browser vault" if they want).
 */

type Mode =
  | "idle"
  | "detecting"
  | "needs-password"
  | "pick-seed"
  | "importing"
  | "success"
  | "error";

interface WalletVaultFileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the loaded seed + address when the import succeeds. */
  onSuccess?: (result: ImportResult) => void;
  /**
   * Open the "use a different method" flow instead. Default: hidden.
   */
  onUsePasteAddress?: () => void;
  /** Show a "Download my vault" affordance for plain-seed imports. */
  onRequestDownload?: (result: ImportResult) => void;
  /** Whether the dev escape hatch is available. Mirrors the vault dialog. */
  forceCloseable?: boolean;
  /**
   * When true, automatically open the native OS file picker the moment
   * the dialog opens. The idle view's drop zone is still available as
   * a fallback (drag-and-drop + click). Default: false.
   *
   * Used when the user clicks the "Load saved wallet file" entry in
   * the connect flow: they want a file dialog, not a modal with a
   * drop zone.
   */
  autoOpenFilePicker?: boolean;
}

const ACCEPT = ".qubic-vault,.qubic-vault.json,.json,.txt,application/json,text/plain";

export function WalletVaultFileImportDialog({
  open,
  onOpenChange,
  onSuccess,
  onUsePasteAddress,
  onRequestDownload,
  forceCloseable,
  autoOpenFilePicker = false,
}: WalletVaultFileImportDialogProps) {
  const [mode, setMode] = React.useState<Mode>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [format, setFormat] = React.useState<DetectedFormat | null>(null);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [seeds, setSeeds] = React.useState<QubicSeedInfo[] | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset on every open
  React.useEffect(() => {
    if (!open) return;
    setMode("idle");
    setFile(null);
    setFormat(null);
    setPassword("");
    setShowPassword(false);
    setBusy(false);
    setError(null);
    setSeeds(null);
    setResult(null);
    setDragOver(false);
  }, [open]);

  // Auto-trigger the native file picker on open, when requested. We
  // do this in a microtask so the dialog has time to mount first  
  // some browsers ignore programmatic click() on inputs that aren't
  // yet in the DOM.
  React.useEffect(() => {
    if (!open || !autoOpenFilePicker) return;
    const t = window.setTimeout(() => {
      inputRef.current?.click();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, autoOpenFilePicker]);

  async function onFile(f: File) {
    setFile(f);
    setError(null);
    setMode("detecting");
    try {
      const det = await detectVaultFileFormat(f);
      setFormat(det);
      if (det.kind === "unknown") {
        setError(
          "Couldn't read this file. Expected a .qubic-vault export, an aigarth vault, or a 55-character seed.",
        );
        setMode("error");
        return;
      }
      if (det.kind === "plain-seed") {
        // No password: go straight to import.
        await doImport(f, det);
        return;
      }
      setMode("needs-password");
    } catch (e) {
      setError((e as Error).message);
      setMode("error");
    }
  }

  async function doImport(
    f: File,
    det?: DetectedFormat | null,
    pickPublicId?: string,
  ) {
    const useFormat = det ?? format;
    if (!useFormat) return;
    setBusy(true);
    setError(null);
    try {
      // For Qubic Web Wallet format with multiple seeds, first read the
      // file to know how many seeds there are. We do a single import
      // call (revealSeed pulls the seed) so we don't double-decrypt.
      // For a multi-seed vault, the first call without pickPublicId
      // throws a seeds list: we then ask the user to pick.
      try {
        setMode("importing");
        const res = await importQubicVault(f, {
          password: useFormat.needsPassword ? password : undefined,
          pickPublicId,
        });
        setResult(res);
        setMode("success");
      } catch (err) {
        // Multi-seed path: detect the seeds we should let the user pick
        const e = err as Error & { seeds?: QubicSeedInfo[] };
        if (e.seeds && e.seeds.length > 1 && !pickPublicId) {
          setSeeds(e.seeds);
          setMode("pick-seed");
          return;
        }
        throw err;
      }
    } catch (e) {
      setError((e as Error).message);
      setMode("error");
    } finally {
      setBusy(false);
    }
  }

  function onPickSeed(publicId: string) {
    if (!file) return;
    void doImport(file, format, publicId);
  }

  function onContinue() {
    if (!result) return;
    onOpenChange(false);
    onSuccess?.(result);
  }

  function onDownload() {
    if (!result) return;
    onRequestDownload?.(result);
  }

  function reset() {
    setFile(null);
    setFormat(null);
    setPassword("");
    setError(null);
    setSeeds(null);
    setResult(null);
    setMode("idle");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "idle" && (
            <IdleView
              key="idle"
              dragOver={dragOver}
              setDragOver={setDragOver}
              onPickFile={() => inputRef.current?.click()}
              onFile={onFile}
              inputRef={inputRef}
              onUsePaste={onUsePasteAddress}
            />
          )}
          {mode === "detecting" && <LoaderView key="detecting" label="Reading file…" />}
          {mode === "needs-password" && file && format && (
            <PasswordView
              key="password"
              file={file}
              format={format}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              busy={busy}
              error={error}
              onSubmit={(e) => {
                e.preventDefault();
                void doImport(file, format);
              }}
              onBack={reset}
              onUsePaste={onUsePasteAddress}
            />
          )}
          {mode === "pick-seed" && seeds && (
            <PickSeedView
              key="pick"
              seeds={seeds}
              onPick={onPickSeed}
              onBack={reset}
            />
          )}
          {mode === "importing" && <LoaderView key="importing" label="Unlocking vault…" />}
          {mode === "success" && result && (
            <SuccessView
              key="success"
              result={result}
              onContinue={onContinue}
              onDownload={onRequestDownload ? onDownload : undefined}
            />
          )}
          {mode === "error" && (
            <ErrorView
              key="error"
              error={error}
              onRetry={reset}
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

function IdleView({
  dragOver,
  setDragOver,
  onPickFile,
  onFile,
  inputRef,
  onUsePaste,
}: {
  dragOver: boolean;
  setDragOver: (b: boolean) => void;
  onPickFile: () => void;
  onFile: (f: File) => void;
  inputRef: React.RefObject<HTMLInputElement>;
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
          <Upload className="h-3.5 w-3.5" />
          Import vault
        </div>
        <DialogTitle>Import a Qubic vault</DialogTitle>
        <DialogDescription>
          Drop a <code>.qubic-vault</code> file exported from
          wallet.qubic.org, an aigarth vault, or a 55-character seed.
        </DialogDescription>
      </DialogHeader>

      {/* Primary action: explicit "Browse files" button. The native
          file picker opens the OS dialog filtered to .qubic-vault,
          aigarth JSON, or plain-seed text. */}
      <div className="mt-5 flex flex-col gap-3">
        <Button
          type="button"
          onClick={onPickFile}
          className="w-full gap-2"
        >
          <Upload className="h-4 w-4" />
          Browse files
        </Button>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={cn(
            "cursor-pointer rounded-lg border border-dashed p-4 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/60 hover:border-primary/40 hover:bg-muted/20",
          )}
          onClick={onPickFile}
        >
          <p className="text-[11px] text-muted-foreground">
            …or drop the file here
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Accepts <code>.qubic-vault</code> (Qubic Web Wallet export),{" "}
        <code>.qubic-vault.json</code> (aigarth export), or a 55-character
        seed file. Your file is read locally. The seed is decrypted in
        memory only and is never sent to a server until you sign the
        auth nonce.
      </p>

      {onUsePaste && (
        <button
          type="button"
          onClick={onUsePaste}
          className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-primary"
        >
          Use a different method
        </button>
      )}
    </motion.div>
  );
}

function PasswordView({
  file,
  format,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  busy,
  error,
  onSubmit,
  onBack,
  onUsePaste,
}: {
  file: File;
  format: DetectedFormat;
  password: string;
  setPassword: (s: string) => void;
  showPassword: boolean;
  setShowPassword: (b: boolean) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onUsePaste?: () => void;
}) {
  const kindLabel =
    format.kind === "qubic-web-vault" ? "Qubic Web Wallet export" : "aigarth vault";
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
        <DialogTitle>Unlock the file</DialogTitle>
        <DialogDescription>
          Detected: <span className="font-medium text-foreground">{kindLabel}</span> ({file.name}).
          Enter the password you used to encrypt it.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="vault-import-password"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Password
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="vault-import-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
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
        {error && <ErrorBanner message={error} />}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            type="submit"
            className="flex-1 gap-2"
            disabled={busy || password.length === 0}
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
        </div>
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

function PickSeedView({
  seeds,
  onPick,
  onBack,
}: {
  seeds: QubicSeedInfo[];
  onPick: (publicId: string) => void;
  onBack: () => void;
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
          <FileJson className="h-3.5 w-3.5" />
          Pick a wallet
        </div>
        <DialogTitle>This vault has multiple wallets</DialogTitle>
        <DialogDescription>
          Pick the one you want to sign in with. The other seeds are not
          loaded and stay encrypted.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
        {seeds.map((s) => (
          <button
            key={s.publicId}
            type="button"
            onClick={() => onPick(s.publicId)}
            className="block w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            <div className="text-sm font-medium text-foreground">{s.alias || "Wallet"}</div>
            <div className="mt-0.5 break-all font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {s.publicId}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
      </div>
    </motion.div>
  );
}

function LoaderView({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-3 py-12"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
}

function SuccessView({
  result,
  onContinue,
  onDownload,
}: {
  result: ImportResult;
  onContinue: () => void;
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
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-500">
          <Check className="h-3.5 w-3.5" />
          Vault unlocked
        </div>
        <DialogTitle>Ready to sign in</DialogTitle>
        <DialogDescription>
          Imported from{" "}
          <span className="font-medium text-foreground">
            {result.source === "plain-seed"
              ? "plain seed"
              : result.source === "aigarth-vault"
                ? "aigarth vault"
                : "Qubic Web Wallet"}
          </span>
          {result.pickedAlias ? (
            <>
              {" "}
              · <span className="font-medium text-foreground">{result.pickedAlias}</span>
            </>
          ) : null}
          .
        </DialogDescription>
      </DialogHeader>

      <div className="mt-5 space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-foreground">
            Qubic address
          </div>
          <div className="break-all rounded-lg border border-border bg-muted/30 p-2.5 font-mono text-[11px] uppercase tracking-wider text-foreground">
            {result.address || "(deriving…)"}
          </div>
        </div>

        {result.source === "plain-seed" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            <strong>Heads up.</strong> A plain seed has no password. For
            day-to-day use, save it as an in-browser vault with a
            password. The seed in this file isn't encrypted.
          </div>
        )}

        <Button type="button" onClick={onContinue} className="w-full gap-2">
          Sign in with this address
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
          Import failed
        </div>
        <DialogTitle>Couldn't import the file</DialogTitle>
        <DialogDescription>{error ?? "Unknown error."}</DialogDescription>
      </DialogHeader>
      <div className="mt-5 flex flex-col gap-2">
        <Button type="button" onClick={onRetry} className="w-full">
          Try a different file
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
