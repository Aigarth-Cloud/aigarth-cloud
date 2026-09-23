/**
 * Pool stats + browser worker kind tests (AIGARTH-EVO-02).
 */

import { describe, it, expect } from "vitest";
import {
  RegisterWorkerSchema,
} from "../types/worker.js";

describe("RegisterWorkerSchema — browser kind", () => {
  it("accepts kind = 'browser' with runtime = 'wasm'", () => {
    const r = RegisterWorkerSchema.safeParse({
      kind: "browser",
      capabilities: {
        cpu_cores: 1,
        memory_gb: 1,
        gpu: "none",
        algorithms: ["evo_step"],
        runtime: "wasm",
        location: "browser",
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects kind = 'browser' with runtime = 'docker' (browser workers run wasm)", () => {
    const r = RegisterWorkerSchema.safeParse({
      kind: "browser",
      capabilities: {
        cpu_cores: 1,
        memory_gb: 1,
        gpu: "none",
        algorithms: ["evo_step"],
        runtime: "docker",
        location: "browser",
      },
    });
    expect(r.success).toBe(false);
  });

  it("still rejects oc-processor / neuraxon / human-via-oracle", () => {
    for (const k of ["oc-processor", "neuraxon", "human-via-oracle"]) {
      const r = RegisterWorkerSchema.safeParse({
        kind: k,
        capabilities: {
          cpu_cores: 4,
          memory_gb: 8,
          gpu: "none",
          algorithms: ["awork_1"],
          runtime: "docker",
          location: "us-east-1",
        },
      });
      expect(r.success).toBe(false);
    }
  });

  it("still accepts kind = 'local' (no regression)", () => {
    const r = RegisterWorkerSchema.safeParse({
      kind: "local",
      capabilities: {
        cpu_cores: 4,
        memory_gb: 8,
        gpu: "none",
        algorithms: ["awork_1"],
        runtime: "docker",
        location: "local",
      },
    });
    expect(r.success).toBe(true);
  });
});

describe("ListWorkersQuerySchema — browser kind filterable", () => {
  it("accepts kind = 'browser' as a filter", async () => {
    const { ListWorkersQuerySchema } = await import("../types/worker.js");
    const r = ListWorkersQuerySchema.safeParse({ kind: "browser", limit: 10 });
    expect(r.success).toBe(true);
  });
});
