/**
 * Tests for the result-hash module.
 */

import { describe, it, expect } from "vitest";
import { inputHash, resultHash } from "../result-hash.js";

describe("inputHash", () => {
  it("returns sha256:<64 hex>", () => {
    const h = inputHash({ a: 1 });
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("is stable for permuted keys", () => {
    expect(inputHash({ a: 1, b: 2 })).toBe(inputHash({ b: 2, a: 1 }));
  });

  it("changes when any value changes", () => {
    expect(inputHash({ a: 1 })).not.toBe(inputHash({ a: 2 }));
  });
});

describe("resultHash", () => {
  const base = {
    manifestHash: "sha256:" + "a".repeat(64),
    annVersion: "v1.0.0",
    input: { features: [1, 2, 3] },
    target: "local" as const,
    output: { prediction: "up", confidence: 0.7 },
  };

  it("is stable for the same logical input", () => {
    const a = resultHash(base);
    const b = resultHash({ ...base, input: { features: [1, 2, 3] } });
    expect(a).toBe(b);
  });

  it("changes when the manifest hash changes", () => {
    expect(resultHash(base)).not.toBe(
      resultHash({ ...base, manifestHash: "sha256:" + "b".repeat(64) }),
    );
  });

  it("changes when the version changes", () => {
    expect(resultHash(base)).not.toBe(resultHash({ ...base, annVersion: "v1.0.1" }));
  });

  it("changes when the input changes", () => {
    expect(resultHash(base)).not.toBe(resultHash({ ...base, input: { features: [1, 2, 4] } }));
  });

  it("changes when the target changes", () => {
    expect(resultHash(base)).not.toBe(resultHash({ ...base, target: "qubic_oc" }));
  });

  it("changes when the output changes", () => {
    expect(resultHash(base)).not.toBe(
      resultHash({ ...base, output: { prediction: "down", confidence: 0.7 } }),
    );
  });
});
