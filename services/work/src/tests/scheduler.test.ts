/**
 * Scheduler scoring + decision unit tests.
 *
 * 5 cases covering the v1 scoring function in ADR 006 §5.
 */

import { describe, it, expect } from "vitest";
import { scoreCandidate } from "../services/scheduler.js";
import { decideOutcome } from "../services/verifier.js";
import type { WorkItem, Worker } from "../db/schema.js";

const baseItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  id: "00000000-0000-0000-0000-000000000001",
  workId: "wki_" + "0".repeat(26),
  type: "trinary_decision",
  specVersion: 1,
  status: "queued",
  inputHash: "sha256:" + "a".repeat(64),
  inputUri: "s3://aigarth/test",
  inputSizeBytes: BigInt(1024),
  algorithmName: "trinary_classifier",
  algorithmVersion: "v1.0.0",
  algorithmContainer: "registry.aigarth.cloud/x",
  algorithmDeterministic: false,
  algorithmContainerHash: null,
  reqCpuCores: 2,
  reqMemoryGb: 4,
  reqGpu: "none",
  reqGpuKind: "any",
  reqEstimatedRuntimeS: 60,
  verificationMethod: "replication",
  replicas: 3,
  challengeWorkId: null,
  rewardCurrency: "QUBIC",
  rewardAmount: BigInt(0),
  rewardPayer: "user_test",
  resultPayloadHash: null,
  resultCompletedBy: null,
  resultCompletedAt: null,
  resultReplicasAgreed: null,
  createdBy: "user_test",
  settlementTx: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const baseWorker = (overrides: Partial<Worker> = {}): Worker => ({
  id: "00000000-0000-0000-0000-000000000002",
  workerId: "wrk_" + "A".repeat(26),
  kind: "local",
  status: "active",
  cpuCores: 4,
  memoryGb: 8,
  gpu: "none",
  gpuKind: "any",
  algorithms: ["trinary_classifier"],
  runtime: "docker",
  location: "local",
  reputation: "0.9",
  disputes: 0,
  lastHeartbeatAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const CFG = { WORKER_DEFAULT_CONCURRENCY_CAP: 2, REPUTATION_FLOOR: 0.5 };

describe("scoreCandidate", () => {
  it("returns negative infinity for a worker with status = 'offline'", () => {
    const s = scoreCandidate(baseItem(), baseWorker({ status: "offline" }), 0, CFG);
    expect(s).toBe(Number.NEGATIVE_INFINITY);
  });

  it("returns negative infinity for a worker below reputation floor", () => {
    const s = scoreCandidate(baseItem(), baseWorker({ reputation: "0.3" }), 0, CFG);
    expect(s).toBe(Number.NEGATIVE_INFINITY);
  });

  it("returns negative infinity for a worker that lacks the algorithm", () => {
    const s = scoreCandidate(
      baseItem({ algorithmName: "dft_relaxation" }),
      baseWorker({ algorithms: ["trinary_classifier"] }),
      0,
      CFG,
    );
    expect(s).toBe(Number.NEGATIVE_INFINITY);
  });

  it("returns negative infinity when concurrency cap is reached", () => {
    const s = scoreCandidate(baseItem(), baseWorker(), 2, CFG);
    expect(s).toBe(Number.NEGATIVE_INFINITY);
  });

  it("returns a positive score for a high-reputation, free, capable worker", () => {
    const s = scoreCandidate(baseItem(), baseWorker({ reputation: "0.95" }), 0, CFG);
    expect(s).toBeGreaterThan(0);
  });
});

describe("decideOutcome", () => {
  it("V01 — all three submissions agree: verified, 3/3", () => {
    const r = decideOutcome(["sha256:aaa", "sha256:aaa", "sha256:aaa"], 3);
    expect(r.status).toBe("verified");
    expect(r.replicasAgreed).toBe("3/3");
    expect(r.primaryHash).toBe("sha256:aaa");
  });

  it("V02 — 2 of 3 agree: verified, 2/3, primary is the majority", () => {
    const r = decideOutcome(["sha256:aaa", "sha256:aaa", "sha256:bbb"], 3);
    expect(r.status).toBe("verified");
    expect(r.replicasAgreed).toBe("2/3");
    expect(r.primaryHash).toBe("sha256:aaa");
  });

  it("V03 — all 3 differ: disputed", () => {
    const r = decideOutcome(["sha256:aaa", "sha256:bbb", "sha256:ccc"], 3);
    expect(r.status).toBe("disputed");
    expect(r.primaryHash).toBeNull();
  });

  it("1 of 1 agrees (single replica): verified, 1/1", () => {
    const r = decideOutcome(["sha256:only"], 1);
    expect(r.status).toBe("verified");
    expect(r.replicasAgreed).toBe("1/1");
  });

  it("0 submissions: disputed, 0/N", () => {
    const r = decideOutcome([], 3);
    expect(r.status).toBe("disputed");
    expect(r.replicasAgreed).toBe("0/3");
  });
});
