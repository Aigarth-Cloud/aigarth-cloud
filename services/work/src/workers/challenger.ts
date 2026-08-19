/**
 * Challenger worker (Task 9).
 *
 * Issues known-answer work items to random workers at a
 * configurable ratio (CHALLENGE_RATIO, default 0.01 = 1/100).
 * The PEP §15 V01-V02 adversarial test cases are the
 * acceptance bar; this module is the *issuance* side.
 *
 * The *outcome* (did the worker pass?) is recorded in
 * worker_challenges and decayed into reputation by the
 * verifier.
 *
 * For Phase 27, this is a stub: it logs the issuance rate and
 * is wired into the start() boot. The actual challenge-creation
 * flow (compute the known-answer, push a work item, grade the
 * worker's response) is Phase 27.C. The v1 issuance is a no-op
 * (rate tracking only) so the worker loop is alive for tests.
 */

import { loadConfig } from "../config/index.js";

let _interval: NodeJS.Timeout | null = null;
let _issued = 0;

export function startChallengerLoop(): void {
  if (_interval) return;
  const cfg = loadConfig();
  const tick = () => {
    // v1 stub: track the issuance rate, log periodically.
    _issued += 1;
    if (_issued % 12 === 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[work:challenger] issued ${_issued} challenges (ratio=${cfg.CHALLENGE_RATIO})`,
      );
    }
  };
  _interval = setInterval(tick, cfg.CHALLENGER_TICK_MS);
}

export function stopChallengerLoop(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}

export function getChallengerIssuedCount(): number {
  return _issued;
}

/** Test-only: reset challenger counters. */
export function _resetChallengerForTests(): void {
  _issued = 0;
}
