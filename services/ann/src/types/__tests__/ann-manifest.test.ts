/**
 * Tests for the ANN manifest standard.
 */

import { describe, it, expect } from "vitest";
import {
  AnnManifestSchema,
  buildManifest,
  canonicalizeManifest,
  manifestHash,
  parseAnnManifest,
  versionIdentity,
  ManifestValidationError,
} from "../ann-manifest.js";

const SAMPLE = {
  id: "btc-direction-predictor",
  name: "BTC Direction Predictor",
  version: "v1.0.0",
  creator: "Aigarth Demo",
  architecture: "mlp-3",
  modelHash: "sha256:" + "a".repeat(64),
  inputSchema: { type: "object", required: ["features"], properties: { features: { type: "array" } } },
  outputSchema: { type: "object", properties: { prediction: { type: "string" }, confidence: { type: "number" } } },
  benchmark: { name: "btc-5d", score: 67.2 },
  repository: "https://github.com/aigarth-cloud/ann-btc-direction-predictor",
  commit: "0".repeat(40),
  license: "Apache-2.0",
  description: "Predicts next-5d BTC direction from a 30-day feature window.",
};

describe("AnnManifestSchema", () => {
  it("accepts a complete manifest", () => {
    const parsed = AnnManifestSchema.parse(SAMPLE);
    expect(parsed.id).toBe("btc-direction-predictor");
    expect(parsed.version).toBe("v1.0.0");
  });

  it("fills defaults for optional fields", () => {
    const minimal = AnnManifestSchema.parse({
      id: "x",
      name: "X",
      version: "v0.0.1",
      creator: "me",
      architecture: "stub",
      modelHash: "sha256:" + "b".repeat(64),
    });
    expect(minimal.inputSchema.type).toBe("object");
    expect(minimal.outputSchema.type).toBe("object");
  });

  it("rejects an invalid semver", () => {
    expect(() => AnnManifestSchema.parse({ ...SAMPLE, version: "1.0.0" })).toThrow();
  });

  it("rejects a modelHash without sha256: prefix", () => {
    expect(() => AnnManifestSchema.parse({ ...SAMPLE, modelHash: "a".repeat(64) })).toThrow();
  });

  it("rejects a wrong-length modelHash", () => {
    expect(() => AnnManifestSchema.parse({ ...SAMPLE, modelHash: "sha256:abc" })).toThrow();
  });

  it("rejects an unknown top-level field (strict)", () => {
    expect(() => AnnManifestSchema.parse({ ...SAMPLE, unknown_field: 1 })).toThrow();
  });

  it("rejects benchmark score outside 0-100", () => {
    expect(() =>
      AnnManifestSchema.parse({ ...SAMPLE, benchmark: { name: "x", score: 150 } }),
    ).toThrow();
  });
});

describe("canonicalizeManifest", () => {
  it("produces stable output for permuted keys", () => {
    const a = canonicalizeManifest(AnnManifestSchema.parse(SAMPLE));
    const b = canonicalizeManifest(AnnManifestSchema.parse({
      description: SAMPLE.description,
      license: SAMPLE.license,
      commit: SAMPLE.commit,
      repository: SAMPLE.repository,
      benchmark: SAMPLE.benchmark,
      outputSchema: SAMPLE.outputSchema,
      inputSchema: SAMPLE.inputSchema,
      modelHash: SAMPLE.modelHash,
      architecture: SAMPLE.architecture,
      creator: SAMPLE.creator,
      version: SAMPLE.version,
      name: SAMPLE.name,
      id: SAMPLE.id,
    }));
    expect(a).toBe(b);
  });
});

describe("manifestHash", () => {
  it("returns a sha256:<64 hex> string", () => {
    const h = manifestHash(AnnManifestSchema.parse(SAMPLE));
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("is stable across two equal inputs", () => {
    const a = manifestHash(AnnManifestSchema.parse(SAMPLE));
    const b = manifestHash(AnnManifestSchema.parse({ ...SAMPLE }));
    expect(a).toBe(b);
  });

  it("changes when any field changes", () => {
    const a = manifestHash(AnnManifestSchema.parse(SAMPLE));
    const b = manifestHash(AnnManifestSchema.parse({ ...SAMPLE, name: "different" }));
    expect(a).not.toBe(b);
  });
});

describe("versionIdentity", () => {
  it("returns annId + version + manifestHash", () => {
    const v = versionIdentity(AnnManifestSchema.parse(SAMPLE));
    expect(v.annId).toBe("btc-direction-predictor");
    expect(v.version).toBe("v1.0.0");
    expect(v.manifestHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe("parseAnnManifest", () => {
  it("parses a valid manifest", () => {
    const m = parseAnnManifest(SAMPLE);
    expect(m.id).toBe("btc-direction-predictor");
  });

  it("throws ManifestValidationError on bad input", () => {
    try {
      parseAnnManifest({ id: "x" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestValidationError);
    }
  });
});

describe("buildManifest", () => {
  it("fills defaults for the architecture + modelHash", () => {
    const m = buildManifest({
      id: "x",
      name: "X",
      version: "v0.0.1",
      creator: "me",
    });
    expect(m.architecture).toBe("deterministic-stub");
    expect(m.modelHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
