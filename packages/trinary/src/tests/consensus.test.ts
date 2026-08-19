import { describe, it, expect } from "vitest";
import {
  combine,
  EMPTY_DECISION,
  ConsensusPolicySchema,
  type ScoredEnvelope,
  type TissueMember,
  type ConsensusPolicy,
} from "../consensus";
import { blankEnvelope, type IntentEnvelope } from "../envelope";

function env(
  input: Partial<IntentEnvelope> & { state: -1 | 0 | 1; ann_id?: string; ann_version?: string },
): IntentEnvelope {
  return blankEnvelope({
    ann_id: input.ann_id ?? "ann_test",
    ann_version: input.ann_version ?? "1.0.0",
    state: input.state,
    confidence: input.confidence ?? 0.9,
    authority: input.authority ?? 0.5,
    reasoning: input.reasoning ?? "ok",
  });
}

function scored(e: IntentEnvelope, member: Partial<TissueMember> = {}): ScoredEnvelope {
  return {
    envelope: e,
    member: { ann_id: e.ann_id, role: "voting", ...member },
  };
}

describe("consensus", () => {
  describe("EMPTY_DECISION", () => {
    it("is the tissue-0 fallback for empty input", () => {
      expect(EMPTY_DECISION.state).toBe(0);
      expect(EMPTY_DECISION.confidence).toBe(0);
    });
  });

  describe("combine on empty input", () => {
    it("returns EMPTY_DECISION regardless of policy kind", () => {
      const policies: ConsensusPolicy[] = [
        { kind: "weighted_majority", threshold: 0.5 },
        { kind: "veto_aware", threshold: 0.5 },
        { kind: "unanimous" },
        { kind: "short_circuit" },
      ];
      for (const p of policies) {
        const d = combine(p, []);
        expect(d.state).toBe(0);
        expect(d.confidence).toBe(0);
        expect(d.contributors).toEqual([]);
        expect(d.ignored).toEqual([]);
        expect(d.policy).toBe(p.kind);
      }
    });
  });

  describe("weighted_majority", () => {
    const policy: ConsensusPolicy = { kind: "weighted_majority", threshold: 0.5 };

    it("single +1 with authority >= threshold → +1", () => {
      const d = combine(policy, [scored(env({ state: 1 }), { authority: 0.5 })]);
      expect(d.state).toBe(1);
    });

    it("single -1 with authority >= threshold → -1", () => {
      const d = combine(policy, [scored(env({ state: -1 }), { authority: 0.5 })]);
      expect(d.state).toBe(-1);
    });

    it("single envelope below threshold → 0", () => {
      const d = combine(policy, [scored(env({ state: 1 }), { authority: 0.4 })]);
      expect(d.state).toBe(0);
    });

    it("majority weight by sign wins", () => {
      // 0.6 * +1 + 0.3 * -1 + 0.3 * -1 = 0 (boundary)
      // 0.6 * +1 + 0.2 * -1 + 0.2 * -1 = 0.2 (still 0)
      // 0.6 * +1 + 0.1 * -1 + 0.1 * -1 = 0.4 (still 0)
      // 0.6 * +1 + 0.1 * -1 + 0.1 * -1 + 0.5 * +1 = 1.0 (1)
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" }), { authority: 0.6 }),
        scored(env({ state: 1, ann_id: "b" }), { authority: 0.5 }),
        scored(env({ state: -1, ann_id: "c" }), { authority: 0.1 }),
        scored(env({ state: -1, ann_id: "d" }), { authority: 0.1 }),
      ]);
      expect(d.state).toBe(1);
    });

    it("falls to 0 on tie", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" }), { authority: 0.5 }),
        scored(env({ state: -1, ann_id: "b" }), { authority: 0.5 }),
      ]);
      expect(d.state).toBe(0);
    });

    it("uses envelope.authority when member has no override", () => {
      const d = combine(policy, [
        scored({ ...env({ state: 1, ann_id: "a" }), authority: 0.8 }),
      ]);
      expect(d.state).toBe(1);
    });

    it("confidence is the authority-weighted average of inputs", () => {
      const d = combine(policy, [
        scored({ ...env({ state: 1, ann_id: "a", confidence: 1.0 }), authority: 1.0 }),
        scored({ ...env({ state: 1, ann_id: "b", confidence: 0.0 }), authority: 1.0 }),
      ]);
      expect(d.confidence).toBeCloseTo(0.5, 5);
    });

    it("contributors list contains every input", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" })),
        scored(env({ state: 1, ann_id: "b" })),
      ]);
      expect(d.contributors.length).toBe(2);
      expect(d.ignored.length).toBe(0);
    });

    it("rejects non-positive threshold", () => {
      const one = [scored(env({ state: 1 }))];
      expect(() => combine({ kind: "weighted_majority", threshold: 0 }, one)).toThrow();
      expect(() => combine({ kind: "weighted_majority", threshold: -1 }, one)).toThrow();
      expect(() => combine({ kind: "weighted_majority", threshold: NaN }, one)).toThrow();
    });

    it("confidence is 0 when total authority is 0 (every member silenced)", () => {
      const d = combine(policy, [
        scored(env({ state: 1, confidence: 0.9 }), { authority: 0 }),
        scored(env({ state: 1, ann_id: "b", confidence: 0.9 }), { authority: 0 }),
      ]);
      expect(d.state).toBe(0);
      expect(d.confidence).toBe(0);
    });
  });

  describe("veto_aware", () => {
    const policy: ConsensusPolicy = { kind: "veto_aware", threshold: 0.5 };

    it("a veto-role -1 short-circuits to -1", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" }), { authority: 0.9 }),
        scored(env({ state: -1, ann_id: "b" }), { role: "veto", authority: 0.1 }),
      ]);
      expect(d.state).toBe(-1);
    });

    it("a veto-role +1 does NOT short-circuit (veto is one-directional)", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" }), { role: "veto" }),
        scored(env({ state: -1, ann_id: "b" }), { authority: 0.1 }),
      ]);
      // Falls through to weighted_majority: 0.5 * 1 + 0.1 * -1 = 0.4 → 0
      expect(d.state).toBe(0);
    });

    it("ignores the contributing envelopes when a veto fires", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" })),
        scored(env({ state: 1, ann_id: "b" })),
        scored(env({ state: -1, ann_id: "c" }), { role: "veto" }),
      ]);
      // Veto path: 1 contributor (the veto itself), the other 2 are ignored.
      expect(d.contributors.length).toBe(1);
      expect(d.ignored.length).toBe(2);
      expect(d.contributors[0]).toMatch(/^c@1\.0\.0:/);
      for (const ignored of d.ignored) {
        expect(ignored).toMatch(/^[ab]@1\.0\.0:/);
      }
    });

    it("without a veto, behaves like weighted_majority", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" }), { authority: 0.9 }),
        scored(env({ state: -1, ann_id: "b" }), { authority: 0.1 }),
      ]);
      expect(d.state).toBe(1);
    });

    it("a veto with empty reasoning falls back to (no reasoning) in the summary", () => {
      const d = combine(policy, [
        scored({ ...env({ state: -1, ann_id: "veto_ann" }), reasoning: "" }, { role: "veto" }),
      ]);
      expect(d.state).toBe(-1);
      expect(d.reasoning).toContain("(no reasoning)");
    });
  });

  describe("unanimous", () => {
    const policy: ConsensusPolicy = { kind: "unanimous" };

    it("all +1 → +1", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" })),
        scored(env({ state: 1, ann_id: "b" })),
        scored(env({ state: 1, ann_id: "c" })),
      ]);
      expect(d.state).toBe(1);
    });

    it("all 0 → 0", () => {
      const d = combine(policy, [
        scored(env({ state: 0, ann_id: "a" })),
        scored(env({ state: 0, ann_id: "b" })),
      ]);
      expect(d.state).toBe(0);
    });

    it("any disagreement → 0 with no contributors", () => {
      const d = combine(policy, [
        scored(env({ state: 1, ann_id: "a" })),
        scored(env({ state: -1, ann_id: "b" })),
      ]);
      expect(d.state).toBe(0);
      expect(d.contributors).toEqual([]);
      expect(d.ignored.length).toBe(2);
    });
  });

  describe("short_circuit", () => {
    const policy: ConsensusPolicy = { kind: "short_circuit" };

    it("first non-zero state wins, in input order", () => {
      const d = combine(policy, [
        scored(env({ state: 0, ann_id: "a" })),
        scored(env({ state: 1, ann_id: "b" })),
        scored(env({ state: -1, ann_id: "c" })),
      ]);
      expect(d.state).toBe(1);
      expect(d.contributors).toHaveLength(1);
    });

    it("a -1 before any +1 wins", () => {
      const d = combine(policy, [
        scored(env({ state: -1, ann_id: "a" })),
        scored(env({ state: 1, ann_id: "b" })),
      ]);
      expect(d.state).toBe(-1);
    });

    it("all 0 → 0 with all as contributors", () => {
      const d = combine(policy, [
        scored(env({ state: 0, ann_id: "a" })),
        scored(env({ state: 0, ann_id: "b" })),
      ]);
      expect(d.state).toBe(0);
      expect(d.contributors.length).toBe(2);
    });

    it("empty reasoning on the short-circuiting envelope falls back to (no reasoning)", () => {
      const d = combine(policy, [
        scored(env({ state: 0, ann_id: "a", reasoning: "neutral" })),
        scored({ ...env({ state: 1, ann_id: "b" }), reasoning: "" }),
      ]);
      expect(d.state).toBe(1);
      expect(d.reasoning).toContain("(no reasoning)");
    });
  });
});

describe("consensus — ConsensusPolicySchema", () => {
  it("accepts every legal policy shape", () => {
    expect(ConsensusPolicySchema.parse({ kind: "weighted_majority", threshold: 0.5 }).kind).toBe("weighted_majority");
    expect(ConsensusPolicySchema.parse({ kind: "veto_aware", threshold: 0.4 }).kind).toBe("veto_aware");
    expect(ConsensusPolicySchema.parse({ kind: "unanimous" }).kind).toBe("unanimous");
    expect(ConsensusPolicySchema.parse({ kind: "short_circuit" }).kind).toBe("short_circuit");
  });

  it("rejects an unknown kind", () => {
    expect(() => ConsensusPolicySchema.parse({ kind: "bayesian" })).toThrow();
    expect(() => ConsensusPolicySchema.parse({ kind: "majority" })).toThrow();
  });

  it("rejects a weighted_majority with a non-positive threshold", () => {
    expect(() => ConsensusPolicySchema.parse({ kind: "weighted_majority", threshold: 0 })).toThrow();
    expect(() => ConsensusPolicySchema.parse({ kind: "weighted_majority", threshold: -1 })).toThrow();
    expect(() => ConsensusPolicySchema.parse({ kind: "weighted_majority", threshold: NaN })).toThrow();
  });

  it("rejects an unanimous policy with extra fields (strict mode)", () => {
    expect(() =>
      ConsensusPolicySchema.parse({ kind: "unanimous", threshold: 0.5 }),
    ).toThrow();
  });

  it("rejects a missing kind", () => {
    expect(() => ConsensusPolicySchema.parse({ threshold: 0.5 })).toThrow();
  });
});
