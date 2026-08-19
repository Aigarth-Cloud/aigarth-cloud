/**
 * Zod envelope tests (Work Item + Worker + Algorithm).
 *
 * 10 cases covering the contract invariants in ADR 006 §3, §4, §10.
 */

import { describe, it, expect } from "vitest";
import {
  SubmitWorkItemSchema,
  WorkIdSchema,
  WorkerIdSchema,
} from "../types/work-item.js";
import { RegisterWorkerSchema } from "../types/worker.js";
import {
  RegisterAlgorithmSchema,
  signAlgorithm,
  verifyAlgorithmSignature,
} from "../types/algorithm.js";

const VALID_INPUT = {
  type: "trinary_decision",
  spec_version: 1,
  input: {
    payload_hash: "sha256:" + "a".repeat(64),
    payload_uri: "s3://aigarth/test/input.json",
    payload_size_bytes: 1024,
  },
  algorithm: {
    name: "trinary_classifier",
    version: "v1.0.0",
    container: "registry.aigarth.cloud/algorithms/trinary_classifier:v1.0.0",
    deterministic: false,
  },
  requirements: {
    cpu_cores: 2,
    memory_gb: 4,
    gpu: "none",
    gpu_kind: "any",
    estimated_runtime_s: 60,
  },
  verification: {
    method: "replication",
    replicas: 3,
  },
  reward: {
    currency: "QUBIC",
    amount: "1000",
    payer: "user_test_001",
  },
};

describe("Work Item envelope (Zod)", () => {
  it("accepts a valid envelope", () => {
    const r = SubmitWorkItemSchema.safeParse(VALID_INPUT);
    expect(r.success).toBe(true);
  });

  it("rejects a missing required field (input.payload_hash)", () => {
    const bad = { ...VALID_INPUT, input: { ...VALID_INPUT.input, payload_hash: "" } };
    const r = SubmitWorkItemSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects a malformed payload_hash (not sha256:<64hex>)", () => {
    const bad = { ...VALID_INPUT, input: { ...VALID_INPUT.input, payload_hash: "not-a-hash" } };
    const r = SubmitWorkItemSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects negative payload_size_bytes", () => {
    const bad = { ...VALID_INPUT, input: { ...VALID_INPUT.input, payload_size_bytes: -1 } };
    const r = SubmitWorkItemSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects verification.method = 'deterministic' on a non-deterministic algorithm (ADR 006 §3 invariant 1)", () => {
    const bad = {
      ...VALID_INPUT,
      algorithm: { ...VALID_INPUT.algorithm, deterministic: false },
      verification: { ...VALID_INPUT.verification, method: "deterministic" },
    };
    const r = SubmitWorkItemSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      const messages = r.error.issues.map((i) => i.message).join(" ");
      expect(messages).toMatch(/deterministic/);
    }
  });

  it("accepts deterministic method on a deterministic algorithm", () => {
    const ok = {
      ...VALID_INPUT,
      algorithm: { ...VALID_INPUT.algorithm, deterministic: true },
      verification: { ...VALID_INPUT.verification, method: "deterministic" },
    };
    const r = SubmitWorkItemSchema.safeParse(ok);
    expect(r.success).toBe(true);
  });

  it("rejects reservationId field (ADR 006 §10 negative consequence 2)", () => {
    const bad = { ...VALID_INPUT, reservationId: "res-123" };
    const r = SubmitWorkItemSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("WorkId regex matches wki_<Crockford-26>", () => {
    expect(WorkIdSchema.safeParse("wki_" + "0".repeat(26)).success).toBe(true);
    expect(WorkIdSchema.safeParse("wki_invalid").success).toBe(false);
    expect(WorkIdSchema.safeParse("foo_" + "0".repeat(26)).success).toBe(false);
  });

  it("WorkerId regex matches wrk_<Crockford-26>", () => {
    expect(WorkerIdSchema.safeParse("wrk_" + "A".repeat(26)).success).toBe(true);
    expect(WorkerIdSchema.safeParse("wki_" + "A".repeat(26)).success).toBe(false);
  });
});

describe("Worker manifest (Zod)", () => {
  it("accepts a valid local worker", () => {
    const r = RegisterWorkerSchema.safeParse({
      kind: "local",
      capabilities: {
        cpu_cores: 4,
        memory_gb: 8,
        gpu: "none",
        algorithms: ["trinary_classifier", "awork_1"],
        runtime: "docker",
        location: "local",
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects kind = 'remote' (v1 only allows 'local', ADR 006 §4 invariant 2)", () => {
    const r = RegisterWorkerSchema.safeParse({
      kind: "remote",
      capabilities: {
        cpu_cores: 4,
        memory_gb: 8,
        gpu: "none",
        algorithms: ["trinary_classifier"],
        runtime: "docker",
        location: "us-east-1",
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty algorithm list", () => {
    const r = RegisterWorkerSchema.safeParse({
      kind: "local",
      capabilities: {
        cpu_cores: 4,
        memory_gb: 8,
        gpu: "none",
        algorithms: [],
        runtime: "docker",
        location: "local",
      },
    });
    expect(r.success).toBe(false);
  });
});

describe("Algorithm registry (Zod + signature)", () => {
  it("accepts a valid algorithm", () => {
    const r = RegisterAlgorithmSchema.safeParse({
      name: "awork_1",
      version: "v0.1.0",
      container: "registry.aigarth.cloud/algorithms/awork_1:v0.1.0",
      deterministic: true,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid semver", () => {
    const r = RegisterAlgorithmSchema.safeParse({
      name: "awork_1",
      version: "0.1.0", // missing v prefix
      container: "registry.aigarth.cloud/algorithms/awork_1:v0.1.0",
      deterministic: true,
    });
    expect(r.success).toBe(false);
  });

  it("signs + verifies an algorithm signature (HMAC-SHA-256)", () => {
    const name = "awork_1";
    const version = "v0.1.0";
    const container = "registry.aigarth.cloud/algorithms/awork_1:v0.1.0";
    const key = "test-key-do-not-use-in-prod";
    const sig = signAlgorithm(name, version, container, key);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyAlgorithmSignature(name, version, container, sig, key)).toBe(true);
    expect(verifyAlgorithmSignature(name, version, "different-container", sig, key)).toBe(false);
    expect(verifyAlgorithmSignature(name, version, container, sig, "wrong-key")).toBe(false);
  });
});
