/**
 * Tests for the BTC Direction Predictor v1 adapter.
 */

import { describe, it, expect } from "vitest";
import { BtcDirectionPredictorAdapter } from "../btc-direction-predictor.js";
import type { AnnManifest } from "../../../../types/ann-manifest.js";

const MANIFEST: AnnManifest = {
  id: "btc-direction-predictor",
  name: "BTC Direction Predictor",
  version: "v1.0.0",
  creator: "Aigarth Demo",
  architecture: "btc-direction-predictor-v1",
  modelHash: "sha256:" + "a".repeat(64),
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
};

const upward = Array.from({ length: 30 }, (_, i) => 100 + i * 1.5);
const downward = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
const flat = Array.from({ length: 30 }, () => 150);

describe("BtcDirectionPredictorAdapter", () => {
  it("predicts 'up' when the 5-day momentum is positive", async () => {
    const out = await BtcDirectionPredictorAdapter.infer({ features: upward }, MANIFEST);
    expect(out.prediction).toBe("up");
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
  });

  it("predicts 'down' when the 5-day momentum is negative", async () => {
    const out = await BtcDirectionPredictorAdapter.infer({ features: downward }, MANIFEST);
    expect(out.prediction).toBe("down");
    expect(out.confidence).toBeGreaterThan(0);
  });

  it("predicts 'flat' when the 5-day momentum is zero", async () => {
    const out = await BtcDirectionPredictorAdapter.infer({ features: flat }, MANIFEST);
    expect(out.prediction).toBe("flat");
    expect(out.confidence).toBe(0);
  });

  it("is deterministic — same input gives same output", async () => {
    const a = await BtcDirectionPredictorAdapter.infer({ features: upward }, MANIFEST);
    const b = await BtcDirectionPredictorAdapter.infer({ features: [...upward] }, MANIFEST);
    expect(a).toEqual(b);
  });

  it("rejects too-short feature arrays", async () => {
    await expect(
      BtcDirectionPredictorAdapter.infer({ features: [1, 2, 3] }, MANIFEST),
    ).rejects.toThrow(/at least 6 entries/);
  });

  it("rejects non-numeric features", async () => {
    await expect(
      BtcDirectionPredictorAdapter.infer(
        { features: [1, 2, 3, 4, 5, "six"] },
        MANIFEST,
      ),
    ).rejects.toThrow(/non-finite/);
  });

  it("rejects missing features", async () => {
    await expect(BtcDirectionPredictorAdapter.infer({}, MANIFEST)).rejects.toThrow();
  });
});
