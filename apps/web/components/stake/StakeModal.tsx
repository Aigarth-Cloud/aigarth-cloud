"use client";

/**
 * StakeModal: shared modal that opens when "Stake QUBIC" is clicked
 * anywhere on the marketing site.
 *
 * Flow:
 *   1. idle     : user picks amount + lock duration
 *   2. preview  : shows the encoded Qearn `lock(amount, weeks)` tx
 *   3. success  : shows the resulting Qearn lock position
 *
 * All actions target the Qearn contract on Qubic mainnet. Phase 0
 * is a stub (no K12 signing yet); the modal shows the exact tx
 * params that would be sent and a "Connect wallet" note. Real
 * signing ships when K12 verification lands.
 *
 * See: apps/web/components/stake/stake-config.ts for the constants
 * (Qearn address, lock range, reward formula, penalty schedule).
 */

import * as React from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Coins,
  ExternalLink,
  Info,
  Lock,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Badge,
} from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import {
  formatQubic,
  parseStakeString,
  weeklyReward,
  apyPercent,
  QEARN_CONTRACT_ADDRESS,
  LOCK_PRESETS,
  MIN_LOCK_QUBIC,
  MAX_LOCK_QUBIC,
  type StakeContext,
} from "./stake-config";

// ============================================================================
//  Public component
// ============================================================================

type StakeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: StakeContext;
  /** Optional initial amount (parsed via parseStakeString). Default: context.minStakeQubic. */
  defaultAmount?: string;
};

export function StakeModal({ open, onOpenChange, context, defaultAmount }: StakeModalProps) {
  const minStake = context.minStakeQubic ?? MIN_LOCK_QUBIC;

  // ----- Form state -----
  const [amountInput, setAmountInput] = React.useState<string>(
    defaultAmount ?? formatInitialAmount(minStake),
  );
  const [weeks, setWeeks] = React.useState<number>(52);
  const [stage, setStage] = React.useState<"idle" | "preview" | "success">("idle");
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  // Reset state when the modal opens
  React.useEffect(() => {
    if (open) {
      setAmountInput(defaultAmount ?? formatInitialAmount(minStake));
      setWeeks(52);
      setStage("idle");
      setSubmitting(false);
    }
  }, [open, defaultAmount, minStake]);

  const parsedAmount = parseStakeString(amountInput) ?? 0;
  const validAmount = parsedAmount >= Math.max(MIN_LOCK_QUBIC, minStake) && parsedAmount <= MAX_LOCK_QUBIC;
  const unlockDate = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [weeks]);

  const weekly = validAmount ? weeklyReward(parsedAmount) : 0;
  const annual = validAmount ? parsedAmount * 0.08 : 0;

  // ----- Actions -----

  function handleSubmit() {
    setStage("preview");
  }

  function handleSign() {
    setSubmitting(true);
    // Simulated submit. Real K12 signing ships when services/qubic
    // implements full K12 verification. For now we surface a clear
    // "preview" success state.
    setTimeout(() => {
      setSubmitting(false);
      setStage("success");
    }, 600);
  }

  function handleClose() {
    if (submitting) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        {stage === "idle" && (
          <IdleStage
            context={context}
            amountInput={amountInput}
            setAmountInput={setAmountInput}
            parsedAmount={parsedAmount}
            validAmount={validAmount}
            minStake={minStake}
            weeks={weeks}
            setWeeks={setWeeks}
            unlockDate={unlockDate}
            weekly={weekly}
            annual={annual}
            onSubmit={handleSubmit}
            onClose={handleClose}
          />
        )}
        {stage === "preview" && (
          <PreviewStage
            context={context}
            amount={parsedAmount}
            weeks={weeks}
            unlockDate={unlockDate}
            weekly={weekly}
            onSign={handleSign}
            onBack={() => setStage("idle")}
            onClose={handleClose}
            submitting={submitting}
          />
        )}
        {stage === "success" && (
          <SuccessStage
            context={context}
            amount={parsedAmount}
            weeks={weeks}
            unlockDate={unlockDate}
            weekly={weekly}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
//  Stage 1: Idle (form)
// ============================================================================

type IdleProps = {
  context: StakeContext;
  amountInput: string;
  setAmountInput: (s: string) => void;
  parsedAmount: number;
  validAmount: boolean;
  minStake: number;
  weeks: number;
  setWeeks: (n: number) => void;
  unlockDate: string;
  weekly: number;
  annual: number;
  onSubmit: () => void;
  onClose: () => void;
};

function IdleStage({
  context,
  amountInput,
  setAmountInput,
  parsedAmount,
  validAmount,
  minStake,
  weeks,
  setWeeks,
  unlockDate,
  weekly,
  annual,
  onSubmit,
  onClose,
}: IdleProps) {
  const minDisplay = formatQubic(minStake, true);
  const tooLow = parsedAmount > 0 && parsedAmount < minStake;

  return (
    <>
      <div className="border-b p-6">
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-garden-500/30 bg-garden-500/10 p-1.5">
            <Coins className="h-4 w-4 text-garden-600 dark:text-garden-400" />
          </div>
          <div>
            <DialogTitle className="text-base">Stake QUBIC in Qearn</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              Flow: <span className="font-mono text-foreground/70">Qubic → Qearn.lock({parsedAmount ? formatQubic(parsedAmount) : " "}, {weeks}w)</span>
            </DialogDescription>
          </div>
        </div>
        <div className="mt-4 rounded-md border bg-muted/30 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Unlocking
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-semibold">{context.label}</span>
            <Badge variant="outline" className="text-[10px]">Live</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{context.purpose}</p>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {/* Amount */}
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="stake-amount" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Amount
            </label>
            <span className="text-[10px] text-muted-foreground">
              Min {minDisplay} · Max {formatQubic(MAX_LOCK_QUBIC, true)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="stake-amount"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="e.g. 3M or 1500000"
              className="font-mono text-base"
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmountInput(formatInitialAmount(minStake))}
            >
              Use min
            </Button>
          </div>
          {tooLow && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <Info className="h-3 w-3" />
              Below the {minDisplay} minimum for this target.
            </p>
          )}
          {!validAmount && !tooLow && parsedAmount > 0 && (
            <p className="mt-1.5 text-xs text-destructive">Enter a value between {minDisplay} and {formatQubic(MAX_LOCK_QUBIC, true)}.</p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Lock duration
          </label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {LOCK_PRESETS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeeks(w)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm transition-colors",
                  weeks === w
                    ? "border-garden-500/40 bg-garden-500/10 text-garden-700 dark:text-garden-300"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                <div className="font-medium">{w}w</div>
                <div className="text-[10px] text-muted-foreground">
                  {w === 4 ? "Min term" : w === 12 ? "Quarter" : w === 26 ? "Half year" : "Full term"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            You will receive
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Weekly reward"
              value={validAmount ? `${formatQubic(weekly)}` : " "}
              unit="QUBIC"
            />
            <Stat
              label="APY"
              value={apyPercent()}
              note="illustrative"
            />
            <Stat
              label="Unlock"
              value={unlockDate}
              note={`${weeks} weeks`}
            />
            <Stat
              label="Annual"
              value={validAmount ? formatQubic(annual) : " "}
              unit="QUBIC"
            />
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Principal is always returned. Early unlock reduces the accrued{" "}
            <em>reward</em> per the Qearn schedule: never your principal.
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!validAmount}
          className="gap-1.5"
        >
          <Lock className="h-3.5 w-3.5" />
          Lock in Qearn
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </>
  );
}

// ============================================================================
//  Stage 2: Preview (tx encoded)
// ============================================================================

type PreviewProps = {
  context: StakeContext;
  amount: number;
  weeks: number;
  unlockDate: string;
  weekly: number;
  submitting: boolean;
  onSign: () => void;
  onBack: () => void;
  onClose: () => void;
};

function PreviewStage({
  context,
  amount,
  weeks,
  unlockDate,
  weekly,
  submitting,
  onSign,
  onBack,
  onClose,
}: PreviewProps) {
  return (
    <>
      <div className="border-b p-6">
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-garden-500/30 bg-garden-500/10 p-1.5">
            <Lock className="h-4 w-4 text-garden-600 dark:text-garden-400" />
          </div>
          <div>
            <DialogTitle className="text-base">Confirm your Qearn lock</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              One transaction. Signed with your Qubic wallet. Goes to the Qearn contract.
            </DialogDescription>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Transaction preview
          </div>
          <div className="mt-3 space-y-2 text-xs font-mono">
            <TxRow label="contract" value={QEARN_CONTRACT_ADDRESS} mono />
            <TxRow label="procedure" value="lock" mono />
            <TxRow label="amount" value={`${formatQubic(amount, true)}`} />
            <TxRow label="weeks" value={String(weeks)} />
            <TxRow label="unlock" value={unlockDate} />
            <TxRow label="weekly_reward" value={`~${formatQubic(weekly)} QUBIC`} />
            <TxRow label="destination" value="Qearn staking contract" />
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <div className="text-xs text-foreground/80">
              <strong className="font-medium">Phase 0 note.</strong> This will
              prepare a signed Qearn <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">lock</code> transaction. Real K12
              signature verification ships when services/qubic lands it  
              until then the modal is a preview. The {context.label} unlock
              will be applied off-chain in Phase 1.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
          <Shield className="mt-0.5 h-3 w-3" />
          <span>
            Principal is held by the Qearn contract. You can unlock at any
            time; early unlock reduces the accrued reward per the official
            schedule. Principal is never touched.
          </span>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" onClick={onSign} disabled={submitting} className="gap-1.5">
          {submitting ? (
            <>
              <CircleDot className="h-3.5 w-3.5 animate-pulse" />
              Preparing tx…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Sign &amp; submit to Qearn
            </>
          )}
        </Button>
      </div>
    </>
  );
}

// ============================================================================
//  Stage 3: Success
// ============================================================================

type SuccessProps = {
  context: StakeContext;
  amount: number;
  weeks: number;
  unlockDate: string;
  weekly: number;
  onClose: () => void;
};

function SuccessStage({
  context,
  amount,
  weeks,
  unlockDate,
  weekly,
  onClose,
}: SuccessProps) {
  return (
    <>
      <div className="border-b p-6">
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <DialogTitle className="text-base">Lock prepared</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              Your Qearn lock is ready to submit. Connect your Qubic wallet to broadcast.
            </DialogDescription>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {context.label} unlocked
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Once the tx is signed and broadcast, {context.label} will be
            available in the marketplace for you. The dashboard will show
            the lock position under <em>Stake</em>.
          </p>
        </div>

        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Lock summary
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Amount" value={formatQubic(amount)} unit="QUBIC" />
            <Stat label="Lock" value={`${weeks}w`} note={unlockDate} />
            <Stat label="Weekly" value={formatQubic(weekly)} unit="QUBIC" />
            <Stat label="APY" value={apyPercent()} note="illustrative" />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button asChild type="button" className="gap-1.5">
          <a
            href={context.successHref ?? "/dashboard"}
            target="_self"
            rel="noreferrer"
          >
            View in dashboard
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </>
  );
}

// ============================================================================
//  Shared bits
// ============================================================================

function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {note && <div className="text-[10px] text-muted-foreground">{note}</div>}
    </div>
  );
}

function TxRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right", mono && "text-[10px]")}>
        {value}
      </span>
    </div>
  );
}

function formatInitialAmount(minStake: number): string {
  // Default to the minimum stake, formatted with the same M/K logic
  // the rest of the app uses. "3M" for 3,000,000; "300K" for 300,000;
  // otherwise the raw number.
  if (minStake >= 1_000_000) {
    return `${(minStake / 1_000_000).toFixed(minStake >= 10_000_000 ? 0 : 1)}M`;
  }
  if (minStake >= 1_000) {
    return `${Math.round(minStake / 1_000)}K`;
  }
  return String(minStake);
}
