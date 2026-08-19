/**
 * @/components/stake: shared staking UI for the marketing site.
 *
 * Public API:
 *   <StakeButton context={...} />        open-ended button + modal
 *   <StakeCTA context={...} />           button pre-configured with the
 *                                         Coin icon + "Stake" label
 *   <StakeModal open onOpenChange />     the dialog itself (advanced)
 *
 * Constants:
 *   QEARN_CONTRACT_ADDRESS                60-char A-Z Qearn contract
 *   MIN_LOCK_QUBIC / MAX_LOCK_QUBIC      lock range
 *   LOCK_PRESETS                         [4, 12, 26, 52] weeks
 *   apyPercent / weeklyReward / annualReward
 *   PENALTY_SCHEDULE                     early-unlock penalty table
 *   parseStakeString / formatQubic      "3M" ↔ 3_000_000 helpers
 *   type StakeContext                    the context the modal needs
 *
 * Apply when: any new "Stake" CTA on the marketing site. Don't
 * inline a `<Link href="/ipo">`: use <StakeButton> so the same
 * Qearn flow appears everywhere.
 */

export { StakeButton, StakeCTA } from "./StakeButton";
export { StakeModal } from "./StakeModal";
export {
  QEARN_CONTRACT_ADDRESS,
  MIN_LOCK_QUBIC,
  MAX_LOCK_QUBIC,
  WEEKS_PER_EPOCH,
  EPOCHS_PER_YEAR,
  ANNUAL_REWARD_RATE,
  LOCK_PRESETS,
  PENALTY_SCHEDULE,
  parseStakeString,
  formatQubic,
  weeklyReward,
  annualReward,
  apyPercent,
  earlyUnlockRewardKept,
  type StakeContext,
  type PenaltyRow,
} from "./stake-config";
