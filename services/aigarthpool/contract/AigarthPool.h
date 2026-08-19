// AigarthPool.h — Qubic smart contract for Aigard stake attribution.
//
// Phase 20.2 of Aigarth Cloud. Phase 22 adds the governance sub-state
// (M1+M2 from docs/aigarthpool/audit-checklist.md).
//
// This is the on-chain source of truth for the Aigard:
//   (user, ann, amount, lock_until_epoch, qearn_lock_id) tuples.
//
// Why this contract exists:
//   Qearn stakes are fungible. We can't tell whose yield was whose
//   without a side channel. AigarthPool IS that side channel — every
//   Aigard stake lands here first, gets tagged with the ANN it was
//   staked for, and is then forwarded to Qearn. On unlock, the yield
//   is split per the ANN's configured basis points and the principal
//   returns to the user.
//
// Phase 22 governance sub-state:
//   - signers[]: the multi-sig signer set (Qubic identities)
//   - signer_threshold: minimum approvals required
//   - treasury_wallet: the wallet that receives the treasury_bps share
//   - pending_treasury_transfer / pending_signer_change: the
//     two-out-of-N approval flow for mutating governance state.
//
// Build:  see contract.md and CMakeLists.txt
// Test:   AIO Qubic Dev Kit (Phase 20.6) — gtest harness in tests/
//
// The TypeScript simulator (packages/aigarthpool/src/simulator.ts)
// mirrors this spec for local dev. When the simulator and contract
// disagree, the simulator is wrong.

#pragma once

#include <array>
#include <cstdint>

// QPI includes — provided by the AIO Qubic Dev Kit's QPI headers.
// In a real build, the include path is set by the AIO toolchain.
// We keep the include guarded so the file is also readable as a
// reference spec without the AIO toolchain present.
#ifdef AIGARTHPOOL_AIO_BUILD
  #include <qubic/qpi.h>
#else
  // Stub types so the file compiles for review / static analysis
  // without the AIO SDK. These match the QPI 1.x surface.
  using m256i = long long;            // placeholder
  using id = std::array<unsigned char, 32>;
  using uint64 = unsigned long long;
  using sint64 = long long;
  namespace qpi {
    constexpr int MAX_INPUT_SIZE = 1024;
  }
#endif

// ---------- Configuration ----------

namespace aigarthpool {

// Hard cap on positions per user. 64 is plenty — a single user is
// unlikely to actively stake for more than ~20 ANNs at a time.
constexpr uint64 MAX_POSITIONS_PER_USER = 64;

// Hard cap on registered ANNs. 65,536 covers every realistic use case
// (the Aigard registry today has 16 ANNs, trending toward hundreds
// over the next 12 months).
constexpr uint64 MAX_ANNS = 65'536;

// Number of epochs in one Qubic year. 1 epoch ≈ 1 week. Qubic uses
// 52-week years; we mirror that.
constexpr uint64 EPOCHS_PER_YEAR = 52;

// Hard cap on governance signers. 16 is plenty for any realistic
// multi-sig (2-of-3 through 5-of-7, with headroom for emergency
// signers and historical entries). Larger sets would just dilute
// the value of the multi-sig.
constexpr uint64 MAX_SIGNERS = 16;

// Pending op TTL in epochs. 4 weeks gives signers time to review
// without leaving the change hanging forever. A pending op that
// hasn't reached threshold by `current_epoch + PENDING_OP_TTL_EPOCHS`
// is rejected by execute.
constexpr uint64 PENDING_OP_TTL_EPOCHS = 4;

// ---------- Phase 23.1 (M3) — Rate limits ----------
// Per-tx cap on `stakeForAnn`. 1,000,000 QUBIC = 10^12 Qu-bit.
// Blast-radius limit on a single call (e.g. a contract bug can't
// drain a user's whole balance in one transaction).
constexpr uint64 MAX_STAKE_PER_TX = 1'000'000ULL * 1'000'000ULL;  // 1,000,000 QUBIC in Qu-bit

// Per-user-per-epoch cap on `stakeForAnn`. 5x the per-tx cap.
// Reset on epoch boundary (O(1) per user — no global scan).
constexpr uint64 MAX_STAKE_PER_USER_PER_EPOCH = 5'000'000ULL * 1'000'000ULL;  // 5,000,000 QUBIC in Qu-bit

// ---------- Types ----------

// A position represents one (user, ann) lock. We index positions
// by user; the per-ann breakdown is derived from the positions map.
struct Position {
    uint64 ann_id;             // ANN registry id (matches services/ann.anns.id)
    uint64 amount;             // QUBIC locked (in Qu, 1 QU = 1,000,000 units)
    uint64 lock_until_epoch;    // epoch at which the Qearn lock matures
    id     qearn_lock_id;       // id of the underlying Qearn lock
    bool   active;             // false after unlock
};

// Splits configuration per ANN. Set by the ANN creator (or aigard
// governance on creator's behalf). The three bps fields must sum
// to 10,000; the contract rejects updates that don't.
struct AnnSplits {
    uint64 creator_bps;     // 0-10,000
    uint64 user_bps;        // 0-10,000
    uint64 treasury_bps;    // 0-10,000
    id     creator_wallet;  // 32-byte Qubic identity
    bool   active;
};

// Yield owed to a user for a given (user, ann) unlock. Set by the
// unlock procedure; cleared by claimRewards.
struct YieldOwed {
    uint64 principal;       // original QUBIC, returned to user
    uint64 yield_amount;    // accrued yield, to be split
    uint64 ann_id;          // which ANN
    bool   claimed;
};

// ---------- Contract state (single-instance singleton) ----------

// ---------- Phase 22: Governance sub-state ----------
//
// The multi-sig signer set, threshold, and treasury wallet live
// here. The audit checklist recommends a sibling contract for the
// multi-sig (M1+M2); for now the same QPI contract hosts both. When
// we split, this struct becomes the read/write surface to the
// sibling contract via QPI's inter-contract call.

// A pending op tracks the approval flow for a single governance
// mutation. Only one pending op per kind is allowed at a time
// (we don't queue them — signers re-submit if they want to
// amend). The `nonce` is caller-chosen; the contract rejects a
// second submission with the same `nonce` while the first is
// still pending.
struct PendingTreasuryTransfer {
    id     to;                 // new treasury wallet
    uint64 nonce;               // caller-chosen
    uint64 submitted_at_epoch;  // for TTL check
    std::array<bool, MAX_SIGNERS> approvals;  // approvals[signer_idx]
    uint64 approval_count;
    bool   active;
};

struct PendingSignerChange {
    std::array<id, MAX_SIGNERS> to_add;
    uint64 to_add_count;
    std::array<uint64, MAX_SIGNERS> to_remove_idx;  // indexes into state.signers
    uint64 to_remove_count;
    uint64 new_threshold;       // optional (NO_THRESHOLD_CHANGE = 0)
    uint64 nonce;
    uint64 submitted_at_epoch;
    std::array<bool, MAX_SIGNERS> approvals;
    uint64 approval_count;
    bool   active;
};

struct AigarthPoolState {
    // users[user_id] → vector of positions (capped at MAX_POSITIONS_PER_USER)
    std::array<std::array<Position, MAX_POSITIONS_PER_USER>, /*USERS*/ 1'000'000> users;
    std::array<uint64, /*USERS*/ 1'000'000> user_position_count;

    // ---------- Phase 23.1 (M3) — Per-user-per-epoch rate limit side channel ----------
    // Tracks how much each user has staked in their current epoch. Reset
    // when the user makes a stakeForAnn call in a new epoch. The contract
    // rejects stakeForAnn if (staked_this_epoch[user] + amount) >
    // MAX_STAKE_PER_USER_PER_EPOCH.
    std::array<uint64, /*USERS*/ 1'000'000> user_staked_this_epoch;
    std::array<uint64, /*USERS*/ 1'000'000> user_last_stake_epoch;

    // splits[ann_id] → AnnSplits
    std::array<AnnSplits, MAX_ANNS> splits;

    // yield_owed[user_id][ann_id] → YieldOwed
    std::array<std::array<YieldOwed, MAX_ANNS>, /*USERS*/ 1'000'000> yield_owed;

    // aggregate stats
    uint64 total_staked;        // sum of active position amounts
    uint64 total_positions;     // count of active positions
    uint64 total_yield_paid;    // cumulative yield distributed
    uint64 total_yield_to_creator;
    uint64 total_yield_to_treasury;

    // ---------- Phase 22: Governance sub-state ----------
    std::array<id, MAX_SIGNERS> signers;
    uint64 signer_count;
    uint64 signer_threshold;            // 1..signer_count
    id     treasury_wallet;             // the wallet that receives treasury_bps
    bool   governance_initialized;      // false until initGovernance is called once
    PendingTreasuryTransfer pending_treasury_transfer;
    PendingSignerChange    pending_signer_change;

    // ---------- Phase 23.2 (M4) — Circuit breaker ----------
    // When true, every mutation procedure (stake, extend, unlock,
    // claim, setAnnSplits) rejects. Read-only queries and the event
    // subscription are unaffected. Toggled by governance signers via
    // procedure_pause / procedure_unpause.
    bool   paused;
};

// ---------- Procedures (public API) ----------

// stakeForAnn(amount, ann_id, weeks) — user locks `amount` QUBIC for
// `weeks` epochs, attributed to `ann_id`. The contract forwards the
// amount to Qearn and records the (user, ann, lock_until_epoch,
// qearn_lock_id) tuple. Rejects:
//   - amount == 0
//   - amount > MAX_STAKE_PER_TX (Phase 23.1 / M3)
//   - weeks < 1 or weeks > 52
//   - ann_id not registered
//   - user already at MAX_POSITIONS_PER_USER
//   - user's stake-this-epoch running total + amount > MAX_STAKE_PER_USER_PER_EPOCH (Phase 23.1 / M3)
//   - insufficient user balance
void procedure_stakeForAnn(AigarthPoolState& state,
                           id user,
                           uint64 amount,
                           uint64 ann_id,
                           uint64 weeks);

// extendLock(ann_id, additional_weeks) — user adds more weeks to an
// existing position. The Qearn lock is extended in place; principal
// is unchanged. Rejects:
//   - no active position for (user, ann_id)
//   - additional_weeks + current_lock_remaining > 52
//   - total weeks > 52 (Qearn's hard cap)
void procedure_extendLock(AigarthPoolState& state,
                          id user,
                          uint64 ann_id,
                          uint64 additional_weeks);

// unlock(ann_id) — user starts the unlock for a single position.
// The Qearn unlock is initiated; the contract marks the position as
// inactive. Yield is computed and split per the ANN's bps config.
// The principal + user_bps share of the yield are owed to the user;
// creator_bps goes to the creator; treasury_bps stays in the
// contract. Rejects:
//   - no active position
//   - lock_until_epoch > current_epoch (Qearn's cliff — wait)
void procedure_unlock(AigarthPoolState& state,
                      id user,
                      uint64 ann_id,
                      uint64 current_epoch);

// claimRewards(ann_id) — user collects principal + yield for a
// previously unlocked position. Idempotent (returns 0 on second call).
// After this call, the YieldOwed row is cleared.
void procedure_claimRewards(AigarthPoolState& state,
                            id user,
                            uint64 ann_id);

// setAnnSplits(ann_id, creator_bps, user_bps, treasury_bps, creator_wallet)
// — sets the splits for an ANN. Callable by either:
//   (a) the ANN's creator (the contract verifies identity match), or
//   (b) a current governance signer (the multi-sig fallback — Phase 22).
// Rejects:
//   - creator_bps + user_bps + treasury_bps != 10,000
//   - caller is not the ANN creator AND not a current signer
void procedure_setAnnSplits(AigarthPoolState& state,
                            id caller,
                            uint64 ann_id,
                            uint64 creator_bps,
                            uint64 user_bps,
                            uint64 treasury_bps,
                            id creator_wallet);

// ---------- Phase 22: Governance procedures ----------

// initGovernance(initial_signers, signer_count, threshold) — called
// once at deploy time. Sets the multi-sig signer set and threshold.
// The treasury wallet defaults to the first signer. Rejects:
//   - governance already initialized
//   - signer_count < 1 or > MAX_SIGNERS
//   - threshold < 1 or > signer_count
void procedure_initGovernance(AigarthPoolState& state,
                              const id* initial_signers,
                              uint64 signer_count,
                              uint64 threshold);

// submitTreasuryTransfer(to, nonce, current_epoch) — any current
// signer can submit a transfer. The op is queued; signers call
// approveTreasuryTransfer until threshold is met, then
// executeTreasuryTransfer. Rejects:
//   - caller is not a current signer
//   - a pending transfer already exists (one at a time)
//   - threshold == 0 (governance not initialized)
void procedure_submitTreasuryTransfer(AigarthPoolState& state,
                                      id caller,
                                      id to,
                                      uint64 nonce,
                                      uint64 current_epoch);

// approveTreasuryTransfer(nonce) — caller (a current signer) records
// their approval. Idempotent (re-approving is a no-op). Rejects:
//   - no pending transfer with the given nonce
//   - caller is not a current signer
//   - pending op expired (current_epoch > submitted_at + TTL)
void procedure_approveTreasuryTransfer(AigarthPoolState& state,
                                       id caller,
                                       uint64 nonce,
                                       uint64 current_epoch);

// executeTreasuryTransfer(nonce, current_epoch) — anyone can call
// once the pending op has reached threshold. Updates treasury_wallet
// and clears the pending op. Rejects:
//   - no pending transfer with the given nonce
//   - approval_count < threshold
//   - pending op expired
void procedure_executeTreasuryTransfer(AigarthPoolState& state,
                                       uint64 nonce,
                                       uint64 current_epoch);

// submitSignerChange(to_add, to_add_count, to_remove_idx, to_remove_count,
//                   new_threshold, nonce, current_epoch) — same flow
// as the treasury transfer, but mutates the signer set + threshold.
// Pass NO_THRESHOLD_CHANGE to leave the threshold alone. Rejects:
//   - caller is not a current signer
//   - to_add_count + signer_count - to_remove_count > MAX_SIGNERS
//   - to_remove_count > signer_count
//   - new_threshold != NO_THRESHOLD_CHANGE and (new_threshold < 1 or
//     > (signer_count + to_add_count - to_remove_count))
void procedure_submitSignerChange(AigarthPoolState& state,
                                  id caller,
                                  const id* to_add,
                                  uint64 to_add_count,
                                  const uint64* to_remove_idx,
                                  uint64 to_remove_count,
                                  uint64 new_threshold,
                                  uint64 nonce,
                                  uint64 current_epoch);

// approveSignerChange(nonce, current_epoch) — same as
// approveTreasuryTransfer but for the pending signer change.
void procedure_approveSignerChange(AigarthPoolState& state,
                                   id caller,
                                   uint64 nonce,
                                   uint64 current_epoch);

// executeSignerChange(nonce, current_epoch) — applies the pending
// signer change. Removes are applied first (decreasing the set),
// then adds, then threshold update. Rejects:
//   - no pending change with the given nonce
//   - approval_count < threshold
//   - pending op expired
//   - resulting signer set is empty (we never allow 0 signers)
void procedure_executeSignerChange(AigarthPoolState& state,
                                   uint64 nonce,
                                   uint64 current_epoch);

// ---------- Phase 23.2 (M4) — Circuit breaker procedures ----------

// procedure_pause(caller, current_epoch) — pauses the pool. All
// subsequent mutation procedures reject until procedure_unpause is
// called. Caller must be a current governance signer. Idempotent
// (re-pausing is a no-op but emits PoolPaused). Rejects:
//   - governance not initialized
//   - caller is not a current signer
void procedure_pause(AigarthPoolState& state, id caller, uint64 current_epoch);

// procedure_unpause(caller, current_epoch) — resumes the pool.
// Same authorization as pause. Idempotent.
void procedure_unpause(AigarthPoolState& state, id caller, uint64 current_epoch);

constexpr uint64 NO_THRESHOLD_CHANGE = 0;

// ---------- Query (read-only) ----------

// getPosition(user, ann_id) → Position
Position query_getPosition(const AigarthPoolState& state,
                          id user,
                          uint64 ann_id);

// getAnnSplits(ann_id) → AnnSplits
AnnSplits query_getAnnSplits(const AigarthPoolState& state,
                             uint64 ann_id);

// getYieldOwed(user, ann_id) → YieldOwed
YieldOwed query_getYieldOwed(const AigarthPoolState& state,
                             id user,
                             uint64 ann_id);

// getTotals() → { total_staked, total_positions, total_yield_paid, ... }
struct Totals {
    uint64 total_staked;
    uint64 total_positions;
    uint64 total_yield_paid;
    uint64 total_yield_to_creator;
    uint64 total_yield_to_treasury;
};
Totals query_getTotals(const AigarthPoolState& state);

// ---------- Phase 22: Governance queries ----------

struct GovernanceState {
    bool   initialized;
    uint64 signer_count;
    uint64 signer_threshold;
    id     treasury_wallet;
    bool   has_pending_treasury_transfer;
    bool   has_pending_signer_change;
    uint64 pending_treasury_transfer_approvals;
    uint64 pending_signer_change_approvals;
    // Phase 23.2 (M4) — circuit breaker flag.
    bool   paused;
};
GovernanceState query_getGovernanceState(const AigarthPoolState& state);

// getSigners() → { signers[0..signer_count-1] }
// Returned as a fixed-size array + length; the simulator + service
// layer zip them together.
struct SignerList {
    std::array<id, MAX_SIGNERS> signers;
    uint64 count;
};
SignerList query_getSigners(const AigarthPoolState& state);

// ---------- Internal helpers (declared here, defined in .cpp) ----------

// Apply the splits to a yield amount, returning (creator_amount,
// user_amount, treasury_amount). Pure function. Truncation goes to
// the user (they get the rounding remainder); the contract never
// over-allocates.
struct SplitResult {
    uint64 creator_amount;
    uint64 user_amount;
    uint64 treasury_amount;
};
SplitResult applySplits(uint64 total_yield,
                        uint64 creator_bps,
                        uint64 user_bps);

// Forward to Qearn. In the simulator this is a no-op; on-chain it
// calls Qearn's `lock(amount, weeks)` procedure. Returns the
// qearn_lock_id assigned by Qearn.
id forwardLockToQearn(uint64 amount, uint64 weeks);

// Forward to Qearn. Simulator: no-op. On-chain: calls Qearn's
// `unlock(qearn_lock_id)` procedure. Returns the (principal, yield)
// pair observed on-chain.
struct QearnUnlockResult {
    uint64 principal;
    uint64 yield_amount;
};
QearnUnlockResult forwardUnlockToQearn(id qearn_lock_id);

// Hash helper (placeholder — the real contract uses QPI's built-in
// sha256). Kept here so the simulator and the contract can be
// cross-checked against the same algorithm.
uint64 simulatedYieldForLock(uint64 amount, uint64 weeks, uint64 current_epoch);

}  // namespace aigarthpool
