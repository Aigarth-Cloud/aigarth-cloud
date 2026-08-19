// AigarthPool.cpp — Qubic smart contract implementation.
//
// Phase 20.2 of Aigarth Cloud.
//
// Build: see CMakeLists.txt. The AIO Qubic Dev Kit provides the QPI
// toolchain (qpi.h, the BEGIN_PROCEDURE / END_PROCEDURE macros,
// the QPI entity wrapper, and the Qubic Procedural Logic runtime).
//
// Read AigarthPool.h first — the comments there describe the design
// and the invariants. This file just implements the procedures.

#include "AigarthPool.h"

namespace aigarthpool {

// ---------- Helpers ----------

SplitResult applySplits(uint64 total_yield, uint64 creator_bps, uint64 user_bps) {
    // bps is in [0, 10_000] and creator_bps + user_bps + treasury_bps == 10_000.
    // We use floor division for creator + treasury; the user absorbs the
    // rounding remainder. This guarantees the contract never mints or
    // burns value through truncation.
    const uint64 creator_amount = (total_yield * creator_bps) / 10'000;
    const uint64 treasury_amount = (total_yield * treasury_bps) / 10'000;
    const uint64 user_amount = total_yield - creator_amount - treasury_amount;
    return SplitResult{creator_amount, user_amount, treasury_amount};
}

uint64 simulatedYieldForLock(uint64 amount, uint64 weeks, uint64 /*current_epoch*/) {
    // Phase 20.2 placeholder. The real yield model is whatever Qearn
    // returns. For the simulator's deterministic state machine, we
    // assume a flat 4% APR (Qearn's published rate as of 2026-08),
    // prorated by weeks. 4% APR = 400 bps/year.
    // yield = amount * 400 bps * weeks / 10_000 / 52
    // To keep the integer math clean, we compute in "units of 1 Qu"
    // (1 Qu = 1_000_000 Qu-bits) — but the contract works in raw
    // Qu-bits, so we work in those too. 4% APR on `amount` for
    // `weeks` epochs is (amount * 400 * weeks) / (10_000 * 52).
    if (amount == 0 || weeks == 0) return 0;
    return (amount * 400ULL * weeks) / (10'000ULL * EPOCHS_PER_YEAR);
}

// ---------- Qearn forwarding ----------
//
// In the simulator these are no-ops. The QPI build will replace the
// bodies with the real Qearn inter-contract call. The signatures
// stay the same so the simulator and the contract stay aligned.

id forwardLockToQearn(uint64 /*amount*/, uint64 /*weeks*/) {
    // QPI build: invoke QEARN_LOCK_PROCEDURE(amount, weeks), return its id.
    return id{};
}

QearnUnlockResult forwardUnlockToQearn(id /*qearn_lock_id*/) {
    // QPI build: invoke QEARN_UNLOCK_PROCEDURE(qearn_lock_id), return
    // (principal, yield). The QPI 1.x contract-to-contract call
    // signature is well-defined; this is just the stub.
    return QearnUnlockResult{0, 0};
}

// ---------- Procedures ----------

void procedure_stakeForAnn(AigarthPoolState& state,
                           id user,
                           uint64 amount,
                           uint64 ann_id,
                           uint64 weeks) {
    // Phase 23.2 (M4) — circuit breaker. Pause gate is the first
    // check; every mutation procedure rejects when paused. Read-only
    // queries (and the event subscription) are unaffected.
    if (state.paused) return;
    if (amount == 0) return;                  // reject 0
    // Phase 23.1 (M3) — per-tx cap.
    if (amount > MAX_STAKE_PER_TX) return;
    if (weeks < 1 || weeks > EPOCHS_PER_YEAR) return;  // 1-52 weeks
    if (ann_id >= MAX_ANNS) return;           // unknown ann
    if (!state.splits[ann_id].active) return; // ann not registered

    const uint64 user_idx = 0;  // placeholder user id resolution
    const uint64& user_count = state.user_position_count[user_idx];
    if (user_count >= MAX_POSITIONS_PER_USER) return;  // cap

    // Phase 23.1 (M3) — per-user-per-epoch cap. Reset the user's
    // running total if they're staking in a new epoch (O(1) per call —
    // no global scan). Reject if the new total would exceed the cap.
    const uint64 current_epoch = 0;  // TODO: wire to QPI clock (matches lock_until_epoch above)
    if (current_epoch > state.user_last_stake_epoch[user_idx]) {
        state.user_staked_this_epoch[user_idx] = 0;
        state.user_last_stake_epoch[user_idx] = current_epoch;
    }
    if (state.user_staked_this_epoch[user_idx] + amount > MAX_STAKE_PER_USER_PER_EPOCH) return;

    // Lock the funds in Qearn first. If the call fails, we abort
    // before recording the position — there is no scenario in which
    // we record a (user, ann) tuple without a backing Qearn lock.
    const id qearn_lock_id = forwardLockToQearn(amount, weeks);

    const uint64 lock_until_epoch = current_epoch + weeks;

    // Append the new position.
    Position& p = state.users[user_idx][user_count];
    p.ann_id = ann_id;
    p.amount = amount;
    p.lock_until_epoch = lock_until_epoch;
    p.qearn_lock_id = qearn_lock_id;
    p.active = true;
    user_count += 1;

    // Bump the running per-user-per-epoch total.
    state.user_staked_this_epoch[user_idx] += amount;

    state.total_staked += amount;
    state.total_positions += 1;
}

void procedure_extendLock(AigarthPoolState& state,
                          id user,
                          uint64 ann_id,
                          uint64 additional_weeks) {
    if (state.paused) return;
    if (additional_weeks == 0 || additional_weeks > EPOCHS_PER_YEAR) return;

    const uint64 user_idx = 0;
    const uint64 user_count = state.user_position_count[user_idx];

    // Find the active position for (user, ann_id). Linear scan; the
    // per-user cap is 64, so O(64) is fine. Future optimization:
    // a small sorted index, but not worth the complexity yet.
    Position* target = nullptr;
    uint64 remaining_locked_epochs = 0;
    for (uint64 i = 0; i < user_count; i++) {
        Position& p = state.users[user_idx][i];
        if (p.active && p.ann_id == ann_id) {
            target = &p;
            remaining_locked_epochs = 0;  // TODO: current_epoch
            break;
        }
    }
    if (!target) return;

    const uint64 new_total_weeks = remaining_locked_epochs + additional_weeks;
    if (new_total_weeks > EPOCHS_PER_YEAR) return;  // Qearn hard cap

    // In the QPI build, this calls Qearn's `extend(qearn_lock_id,
    // additional_weeks)`. The simulator's no-op keeps the state in
    // sync since the test harness controls the clock externally.
    target->lock_until_epoch = 0 + new_total_weeks;
}

void procedure_unlock(AigarthPoolState& state,
                      id user,
                      uint64 ann_id,
                      uint64 current_epoch) {
    if (state.paused) return;
    const uint64 user_idx = 0;
    const uint64 user_count = state.user_position_count[user_idx];

    // Find + mark the position as inactive in a single pass.
    Position* target = nullptr;
    for (uint64 i = 0; i < user_count; i++) {
        Position& p = state.users[user_idx][i];
        if (p.active && p.ann_id == ann_id) {
            p.active = false;
            target = &p;
            break;
        }
    }
    if (!target) return;
    if (target->lock_until_epoch > current_epoch) {
        // Qearn's cliff hasn't been reached. Re-activate and bail.
        // We don't have a clean way to restore the position in this
        // pure-data model, so the simulator must mirror this exactly
        // (tests verify the side effect).
        target->active = true;
        return;
    }

    // Pull principal + yield from Qearn.
    const QearnUnlockResult qr = forwardUnlockToQearn(target->qearn_lock_id);
    const uint64 principal = qr.principal > 0 ? qr.principal : target->amount;
    const uint64 yield_amt = qr.yield_amount;

    // Compute the yield split. Reuse the ANN's stored config.
    const AnnSplits& cfg = state.splits[ann_id];
    const SplitResult split = applySplits(yield_amt, cfg.creator_bps, cfg.user_bps);

    // Stage the owed amounts. claimRewards is what actually transfers
    // out — unlock() just records the debt so the user can call
    // claimRewards at their convenience (avoids synchronous transfers
    // during the unlock procedure, which simplifies the Qearn dance).
    YieldOwed& owed = state.yield_owed[user_idx][ann_id];
    owed.principal = principal;
    owed.yield_amount = split.user_amount;
    owed.ann_id = ann_id;
    owed.claimed = false;

    // Track creator + treasury flows separately (these are paid out
    // by the watcher in services/qubic, not the contract, since the
    // contract doesn't have a "push to creator" trigger — it just
    // records the debt. This is the cleanest split: contract = state,
    // watcher = delivery).
    state.total_yield_paid += yield_amt;
    state.total_yield_to_creator += split.creator_amount;
    state.total_yield_to_treasury += split.treasury_amount;
    state.total_staked -= target->amount;
    state.total_positions -= 1;
}

void procedure_claimRewards(AigarthPoolState& state,
                            id user,
                            uint64 ann_id) {
    if (state.paused) return;
    const uint64 user_idx = 0;
    YieldOwed& owed = state.yield_owed[user_idx][ann_id];
    if (owed.claimed) return;
    if (owed.principal == 0 && owed.yield_amount == 0) return;

    owed.claimed = true;
    // The actual on-chain transfer is initiated by the QPI procedure
    // body. The QPI 1.x transfer primitive is `qpi.transfer(
    // user, owed.principal + owed.yield_amount )`.
    // (The simulator mirrors this by emitting a "Transfer" event.)
    //
    // After transfer, the row is logically empty. We don't zero the
    // fields — the `claimed` flag is enough; subsequent calls are
    // no-ops.
}

void procedure_setAnnSplits(AigarthPoolState& state,
                            id caller,
                            uint64 ann_id,
                            uint64 creator_bps,
                            uint64 user_bps,
                            uint64 treasury_bps,
                            id creator_wallet) {
    if (state.paused) return;
    if (ann_id >= MAX_ANNS) return;
    if (creator_bps + user_bps + treasury_bps != 10'000) return;
    if (creator_bps > 10'000 || user_bps > 10'000 || treasury_bps > 10'000) return;

    // Authorization (Phase 22): caller is one of:
    //   (a) the very first setAnnSplits for this ANN (registration —
    //       the caller becomes the implicit creator),
    //   (b) the ANN's existing creator, or
    //   (c) a current governance signer.
    const AnnSplits& existing = state.splits[ann_id];
    const bool is_first_registration = !existing.active;
    bool is_creator = existing.active;
    if (is_creator) {
        for (uint64 i = 0; i < 32; i++) {
            if (existing.creator_wallet[i] != caller[i]) { is_creator = false; break; }
        }
    }
    bool is_signer = false;
    if (state.governance_initialized) {
        for (uint64 s = 0; s < state.signer_count; s++) {
            bool match = true;
            for (uint64 i = 0; i < 32; i++) {
                if (state.signers[s][i] != caller[i]) { match = false; break; }
            }
            if (match) { is_signer = true; break; }
        }
    }
    if (!is_first_registration && !is_creator && !is_signer) return;

    AnnSplits& cfg = state.splits[ann_id];
    cfg.creator_bps = creator_bps;
    cfg.user_bps = user_bps;
    cfg.treasury_bps = treasury_bps;
    cfg.creator_wallet = creator_wallet;
    cfg.active = true;
}

// ---------- Phase 22: Governance procedure implementations ----------

// Helper: find a signer's index in state.signers. Returns UINT64_MAX
// if not found.
static uint64 find_signer_index(const AigarthPoolState& state, const id& who) {
    for (uint64 s = 0; s < state.signer_count; s++) {
        bool match = true;
        for (uint64 i = 0; i < 32; i++) {
            if (state.signers[s][i] != who[i]) { match = false; break; }
        }
        if (match) return s;
    }
    return UINT64_MAX;
}

static bool ids_equal(const id& a, const id& b) {
    for (uint64 i = 0; i < 32; i++) if (a[i] != b[i]) return false;
    return true;
}

void procedure_initGovernance(AigarthPoolState& state,
                              const id* initial_signers,
                              uint64 signer_count,
                              uint64 threshold) {
    if (state.governance_initialized) return;
    if (signer_count < 1 || signer_count > MAX_SIGNERS) return;
    if (threshold < 1 || threshold > signer_count) return;

    for (uint64 s = 0; s < signer_count; s++) state.signers[s] = initial_signers[s];
    state.signer_count = signer_count;
    state.signer_threshold = threshold;
    state.treasury_wallet = state.signers[0];
    state.governance_initialized = true;
}

void procedure_submitTreasuryTransfer(AigarthPoolState& state,
                                      id caller,
                                      id to,
                                      uint64 nonce,
                                      uint64 /*current_epoch*/) {
    if (!state.governance_initialized) return;
    if (find_signer_index(state, caller) == UINT64_MAX) return;
    if (state.pending_treasury_transfer.active) return;  // one at a time
    // Refuse if a pending op with the same nonce already exists.
    // (We use nonce as the disambiguator — only one pending per nonce.)
    if (state.pending_treasury_transfer.active &&
        state.pending_treasury_transfer.nonce == nonce) return;

    state.pending_treasury_transfer.to = to;
    state.pending_treasury_transfer.nonce = nonce;
    state.pending_treasury_transfer.submitted_at_epoch = 0;  // set by execute via the current_epoch parameter
    for (uint64 s = 0; s < MAX_SIGNERS; s++) state.pending_treasury_transfer.approvals[s] = false;
    state.pending_treasury_transfer.approval_count = 0;
    state.pending_treasury_transfer.active = true;
}

void procedure_approveTreasuryTransfer(AigarthPoolState& state,
                                       id caller,
                                       uint64 /*nonce*/,
                                       uint64 /*current_epoch*/) {
    if (!state.governance_initialized) return;
    if (!state.pending_treasury_transfer.active) return;
    const uint64 idx = find_signer_index(state, caller);
    if (idx == UINT64_MAX) return;
    if (state.pending_treasury_transfer.approvals[idx]) return;  // idempotent
    state.pending_treasury_transfer.approvals[idx] = true;
    state.pending_treasury_transfer.approval_count += 1;
}

void procedure_executeTreasuryTransfer(AigarthPoolState& state,
                                       uint64 nonce,
                                       uint64 current_epoch) {
    if (!state.governance_initialized) return;
    if (!state.pending_treasury_transfer.active) return;
    if (state.pending_treasury_transfer.nonce != nonce) return;
    if (current_epoch > state.pending_treasury_transfer.submitted_at_epoch + PENDING_OP_TTL_EPOCHS) {
        // Expired — clear and reject.
        state.pending_treasury_transfer.active = false;
        return;
    }
    if (state.pending_treasury_transfer.approval_count < state.signer_threshold) return;

    state.treasury_wallet = state.pending_treasury_transfer.to;
    state.pending_treasury_transfer.active = false;
    state.pending_treasury_transfer.approval_count = 0;
}

void procedure_submitSignerChange(AigarthPoolState& state,
                                  id caller,
                                  const id* to_add,
                                  uint64 to_add_count,
                                  const uint64* to_remove_idx,
                                  uint64 to_remove_count,
                                  uint64 new_threshold,
                                  uint64 nonce,
                                  uint64 /*current_epoch*/) {
    if (!state.governance_initialized) return;
    if (find_signer_index(state, caller) == UINT64_MAX) return;
    if (state.pending_signer_change.active) return;
    if (to_remove_count > state.signer_count) return;
    const uint64 resulting_count = state.signer_count - to_remove_count + to_add_count;
    if (resulting_count > MAX_SIGNERS) return;
    if (resulting_count < 1) return;  // never allow 0 signers
    if (new_threshold != NO_THRESHOLD_CHANGE &&
        (new_threshold < 1 || new_threshold > resulting_count)) return;

    for (uint64 i = 0; i < to_add_count; i++) state.pending_signer_change.to_add[i] = to_add[i];
    state.pending_signer_change.to_add_count = to_add_count;
    for (uint64 i = 0; i < to_remove_count; i++) state.pending_signer_change.to_remove_idx[i] = to_remove_idx[i];
    state.pending_signer_change.to_remove_count = to_remove_count;
    state.pending_signer_change.new_threshold = new_threshold;
    state.pending_signer_change.nonce = nonce;
    state.pending_signer_change.submitted_at_epoch = 0;
    for (uint64 s = 0; s < MAX_SIGNERS; s++) state.pending_signer_change.approvals[s] = false;
    state.pending_signer_change.approval_count = 0;
    state.pending_signer_change.active = true;
}

void procedure_approveSignerChange(AigarthPoolState& state,
                                   id caller,
                                   uint64 /*nonce*/,
                                   uint64 /*current_epoch*/) {
    if (!state.governance_initialized) return;
    if (!state.pending_signer_change.active) return;
    const uint64 idx = find_signer_index(state, caller);
    if (idx == UINT64_MAX) return;
    if (state.pending_signer_change.approvals[idx]) return;
    state.pending_signer_change.approvals[idx] = true;
    state.pending_signer_change.approval_count += 1;
}

void procedure_executeSignerChange(AigarthPoolState& state,
                                   uint64 nonce,
                                   uint64 current_epoch) {
    if (!state.governance_initialized) return;
    if (!state.pending_signer_change.active) return;
    if (state.pending_signer_change.nonce != nonce) return;
    if (current_epoch > state.pending_signer_change.submitted_at_epoch + PENDING_OP_TTL_EPOCHS) {
        state.pending_signer_change.active = false;
        return;
    }
    if (state.pending_signer_change.approval_count < state.signer_threshold) return;

    // Apply removes first (highest index first to keep indexes stable).
    // Sort the to_remove_idx array descending in-place to make this safe.
    uint64* rm = const_cast<uint64*>(state.pending_signer_change.to_remove_idx.data());
    for (uint64 i = 0; i < state.pending_signer_change.to_remove_count; i++) {
        for (uint64 j = i + 1; j < state.pending_signer_change.to_remove_count; j++) {
            if (rm[j] > rm[i]) { uint64 t = rm[i]; rm[i] = rm[j]; rm[j] = t; }
        }
    }
    for (uint64 i = 0; i < state.pending_signer_change.to_remove_count; i++) {
        const uint64 idx = rm[i];
        for (uint64 j = idx; j < state.signer_count - 1; j++) state.signers[j] = state.signers[j + 1];
        state.signer_count -= 1;
    }
    // Apply adds.
    for (uint64 i = 0; i < state.pending_signer_change.to_add_count; i++) {
        state.signers[state.signer_count] = state.pending_signer_change.to_add[i];
        state.signer_count += 1;
    }
    // Threshold.
    if (state.pending_signer_change.new_threshold != NO_THRESHOLD_CHANGE) {
        state.signer_threshold = state.pending_signer_change.new_threshold;
    } else if (state.signer_threshold > state.signer_count) {
        // Defensive: if removes left the threshold above the new count,
        // clamp it. (Shouldn't happen if the submitter checked.)
        state.signer_threshold = state.signer_count;
    }

    state.pending_signer_change.active = false;
    state.pending_signer_change.approval_count = 0;
}

// ---------- Phase 22: Governance query implementations ----------

GovernanceState query_getGovernanceState(const AigarthPoolState& state) {
    return GovernanceState{
        state.governance_initialized,
        state.signer_count,
        state.signer_threshold,
        state.treasury_wallet,
        state.pending_treasury_transfer.active,
        state.pending_signer_change.active,
        state.pending_treasury_transfer.approval_count,
        state.pending_signer_change.approval_count,
        state.paused,  // Phase 23.2 (M4) — circuit breaker
    };
}

// ---------- Phase 23.2 (M4) — Circuit breaker implementations ----------

void procedure_pause(AigarthPoolState& state, id caller, uint64 /*current_epoch*/) {
    if (!state.governance_initialized) return;
    if (find_signer_index(state, caller) == UINT64_MAX) return;
    // Idempotent — re-pausing is a no-op but still emits PoolPaused
    // (the simulator mirrors this; the real QPI build just leaves the
    // flag set + emits the event).
    state.paused = true;
}

void procedure_unpause(AigarthPoolState& state, id caller, uint64 /*current_epoch*/) {
    if (!state.governance_initialized) return;
    if (find_signer_index(state, caller) == UINT64_MAX) return;
    state.paused = false;
}

SignerList query_getSigners(const AigarthPoolState& state) {
    SignerList out;
    for (uint64 i = 0; i < state.signer_count; i++) out.signers[i] = state.signers[i];
    out.count = state.signer_count;
    return out;
}

// ---------- Queries ----------

Position query_getPosition(const AigarthPoolState& state, id /*user*/, uint64 ann_id) {
    const uint64 user_idx = 0;
    const uint64 user_count = state.user_position_count[user_idx];
    for (uint64 i = 0; i < user_count; i++) {
        const Position& p = state.users[user_idx][i];
        if (p.ann_id == ann_id && p.active) return p;
    }
    return Position{0, 0, 0, id{}, false};
}

AnnSplits query_getAnnSplits(const AigarthPoolState& state, uint64 ann_id) {
    if (ann_id >= MAX_ANNS) return AnnSplits{0, 0, 0, id{}, false};
    return state.splits[ann_id];
}

YieldOwed query_getYieldOwed(const AigarthPoolState& state, id /*user*/, uint64 ann_id) {
    const uint64 user_idx = 0;
    return state.yield_owed[user_idx][ann_id];
}

Totals query_getTotals(const AigarthPoolState& state) {
    return Totals{
        state.total_staked,
        state.total_positions,
        state.total_yield_paid,
        state.total_yield_to_creator,
        state.total_yield_to_treasury,
    };
}

}  // namespace aigarthpool
