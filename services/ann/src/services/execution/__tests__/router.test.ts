/**
 * Tests for the Execution Router.
 */

import { describe, it, expect } from "vitest";
import { ExecutionRouter } from "../router.js";
import { AnnExecutorError } from "../types.js";
import type { AnnExecutor, ANNExecutionRequest, ANNExecutionResult } from "../types.js";

class FakeLocal implements AnnExecutor {
  info() {
    return { id: "fake-local", model: "fake", version: "1.0.0" };
  }
  async execute(req: ANNExecutionRequest): Promise<ANNExecutionResult> {
    return {
      executionId: "axe_test",
      annId: req.annId,
      annVersion: req.annVersion,
      manifestHash: req.manifestHash,
      target: "local",
      status: "completed",
      output: { fixture: true },
      resultHash: "sha256:" + "0".repeat(64),
      verificationStatus: "local_deterministic",
      startedAt: new Date().toISOString(),
    };
  }
}

class FakeOC implements AnnExecutor {
  info() {
    return { id: "fake-oc", model: "fake", version: "1.0.0" };
  }
  async execute(req: ANNExecutionRequest): Promise<ANNExecutionResult> {
    return {
      executionId: "axe_test",
      annId: req.annId,
      annVersion: req.annVersion,
      manifestHash: req.manifestHash,
      target: "qubic_oc",
      status: "running",
      workId: "wki_test",
      verificationStatus: "pending",
      startedAt: new Date().toISOString(),
    };
  }
}

class FailingOC implements AnnExecutor {
  info() {
    return { id: "failing-oc", model: "fake", version: "1.0.0" };
  }
  async execute(): Promise<ANNExecutionResult> {
    throw new AnnExecutorError("OC engine down", "executor_unavailable");
  }
}

const baseRequest: ANNExecutionRequest = {
  annId: "btc-direction-predictor",
  annVersion: "v1.0.0",
  manifestHash: "sha256:" + "a".repeat(64),
  requestId: "req_test",
  target: "local",
  input: { features: [1, 2, 3] },
  parameters: { architecture: "btc-direction-predictor-v1" },
};

describe("ExecutionRouter", () => {
  it("dispatches local requests to the local executor", async () => {
    const router = new ExecutionRouter({ local: new FakeLocal(), oc: new FakeOC() });
    const r = await router.execute({ ...baseRequest, target: "local" });
    expect(r.target).toBe("local");
    expect(r.status).toBe("completed");
  });

  it("dispatches qubic_oc requests to the OC executor", async () => {
    const router = new ExecutionRouter({ local: new FakeLocal(), oc: new FakeOC() });
    const r = await router.execute({ ...baseRequest, target: "qubic_oc" });
    expect(r.target).toBe("qubic_oc");
    expect(r.status).toBe("running");
  });

  it("never falls back to local when OC fails", async () => {
    const router = new ExecutionRouter({ local: new FakeLocal(), oc: new FailingOC() });
    await expect(router.execute({ ...baseRequest, target: "qubic_oc" })).rejects.toThrow(
      /OC engine down/,
    );
  });

  it("info() returns the right backend for each target", () => {
    const router = new ExecutionRouter({ local: new FakeLocal(), oc: new FakeOC() });
    expect(router.info("local").id).toBe("fake-local");
    expect(router.info("qubic_oc").id).toBe("fake-oc");
  });
});
