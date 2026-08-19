/**
 * Tests for the progress pub/sub (Phase 19C.5).
 *
 * Forces the in-memory bus so tests don't need NATS. Validates
 * the publish/subscribe round-trip, isolation by jobId, and the
 * SSE handler's snapshot + progress + end sequence (via the
 * extracted `streamJobProgress` function, so we don't have to
 * plumb a real Node http server).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  publishProgress,
  subscribeProgress,
  __forceInMemoryProgress,
  __resetProgressForTests,
  __getProgressMode,
} from "../services/progress.js";
import { streamJobProgress, sseFormat } from "../routes/progress.js";
import type { TrainingProgress, TrainingJob } from "../db/schema.js";

function makeEvent(jobId: string, status: TrainingProgress["status"] = "running"): TrainingProgress {
  return {
    jobId,
    status,
    progress: { epoch: 1, total_epochs: 10, loss: 0.9, accuracy: 0.55 },
    metrics: { loss: 0.9, accuracy: 0.55 },
    ts: new Date(),
  };
}

function makeFakeJob(id: string, status: TrainingProgress["status"] = "running"): TrainingJob {
  return {
    id,
    annId: "22222222-2222-2222-2222-222222222222",
    datasetId: "33333333-3333-3333-3333-333333333333",
    datasetVersionId: "44444444-4444-4444-4444-444444444444",
    recipeId: "55555555-5555-5555-5555-555555555555",
    recipeJson: { slug: "mlp_classifier", name: "MLP", kind: "mlp_classifier", architecture: "mlp" },
    hyperparams: {},
    status,
    computeJobId: null,
    progressJson: {},
    metricsJson: {},
    errorMessage: null,
    artifactUrl: null,
    artifactSizeBytes: null,
    artifactHash: null,
    autoPublish: false,
    submittedBy: "66666666-6666-6666-6666-666666666666",
    submittedAt: new Date(),
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date(),
  } as TrainingJob;
}

describe("progress pub/sub (in-memory)", () => {
  beforeEach(() => {
    __resetProgressForTests();
    __forceInMemoryProgress();
  });

  afterEach(() => {
    __resetProgressForTests();
  });

  it("uses the in-memory bus when forced", () => {
    expect(__getProgressMode()).toBe("in-memory");
  });

  it("round-trips a single event to a subscriber", async () => {
    const received: TrainingProgress[] = [];
    const unsub = await subscribeProgress("job-1", (ev) => {
      received.push(ev);
    });
    await publishProgress("job-1", makeEvent("job-1", "running"));
    // Allow microtasks to flush.
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);
    expect(received[0]!.jobId).toBe("job-1");
    expect(received[0]!.status).toBe("running");
    expect(received[0]!.progress.epoch).toBe(1);
    await unsub();
  });

  it("delivers only events for the subscribed jobId", async () => {
    const job1Events: TrainingProgress[] = [];
    const job2Events: TrainingProgress[] = [];
    const unsub1 = await subscribeProgress("job-1", (ev) => job1Events.push(ev));
    const unsub2 = await subscribeProgress("job-2", (ev) => job2Events.push(ev));

    await publishProgress("job-1", makeEvent("job-1", "running"));
    await publishProgress("job-2", makeEvent("job-2", "running"));
    await new Promise((r) => setImmediate(r));

    expect(job1Events).toHaveLength(1);
    expect(job2Events).toHaveLength(1);
    expect(job1Events[0]!.jobId).toBe("job-1");
    expect(job2Events[0]!.jobId).toBe("job-2");

    await unsub1();
    await unsub2();
  });

  it("stops delivering after unsubscribe", async () => {
    const received: TrainingProgress[] = [];
    const unsub = await subscribeProgress("job-x", (ev) => received.push(ev));
    await publishProgress("job-x", makeEvent("job-x", "running"));
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);
    await unsub();
    await publishProgress("job-x", makeEvent("job-x", "succeeded"));
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);
  });

  it("forwards a terminal-state event", async () => {
    const received: TrainingProgress[] = [];
    const unsub = await subscribeProgress("job-end", (ev) => received.push(ev));
    await publishProgress("job-end", makeEvent("job-end", "succeeded"));
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);
    expect(received[0]!.status).toBe("succeeded");
    await unsub();
  });
});

describe("sseFormat", () => {
  it("formats an event with a JSON data payload", () => {
    const out = sseFormat("snapshot", { id: "abc" });
    expect(out).toBe(`event: snapshot\ndata: {"id":"abc"}\n\n`);
  });
});

describe("streamJobProgress (SSE handler)", () => {
  const JOB_ID = "77777777-7777-7777-7777-777777777777";

  beforeEach(() => {
    __resetProgressForTests();
    __forceInMemoryProgress();
  });

  afterEach(() => {
    __resetProgressForTests();
  });

  function makeSink() {
    const chunks: string[] = [];
    let closed = false;
    const closeHandlers: Array<() => void> = [];
    const sink = {
      chunks,
      get closed() {
        return closed;
      },
      write: (chunk: string) => {
        if (!closed) chunks.push(chunk);
      },
      close: () => {
        if (closed) return;
        closed = true;
        for (const cb of closeHandlers) cb();
      },
      onClientClose: (cb: () => void) => {
        closeHandlers.push(cb);
      },
      _simulateClientClose: () => {
        closed = true;
        for (const cb of closeHandlers) cb();
      },
    };
    return sink;
  }

  it("emits snapshot, progress, and end events for a running job", async () => {
    const sink = makeSink();
    const job = makeFakeJob(JOB_ID, "running");
    const streamPromise = streamJobProgress(job, sink);

    // Allow the snapshot to be written and the subscription to attach.
    await new Promise((r) => setTimeout(r, 30));

    // Publish a running progress event.
    await publishProgress(JOB_ID, makeEvent(JOB_ID, "running"));
    await new Promise((r) => setTimeout(r, 20));

    // Publish a terminal event to close the stream.
    await publishProgress(JOB_ID, makeEvent(JOB_ID, "succeeded"));
    await new Promise((r) => setTimeout(r, 20));

    await streamPromise;

    const allText = sink.chunks.join("");
    expect(allText).toMatch(/event: snapshot/);
    expect(allText).toMatch(/event: progress/);
    expect(allText).toMatch(/event: end/);
    expect(allText).toContain(JOB_ID);
    // The end event should reference the terminal status.
    expect(allText).toMatch(/"status":\s*"succeeded"/);
  });

  it("emits only snapshot + end for an already-terminal job", async () => {
    const sink = makeSink();
    const job = makeFakeJob(JOB_ID, "succeeded");
    await streamJobProgress(job, sink);

    const allText = sink.chunks.join("");
    expect(allText).toMatch(/event: snapshot/);
    expect(allText).toMatch(/event: end/);
    // No progress events for an already-terminal job.
    expect(allText).not.toMatch(/event: progress/);
  });

  it("emits end with the error_message for a failed job", async () => {
    const sink = makeSink();
    const job = { ...makeFakeJob(JOB_ID, "failed"), errorMessage: "compute_oom" };
    await streamJobProgress(job, sink);
    const allText = sink.chunks.join("");
    expect(allText).toMatch(/event: end/);
    expect(allText).toMatch(/compute_oom/);
  });
});
