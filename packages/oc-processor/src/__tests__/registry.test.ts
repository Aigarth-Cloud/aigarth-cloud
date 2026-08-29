import { describe, it, expect } from "vitest";
import {
  OcProcessorRegistry,
  OcProcessorError,
  OcErrorCode,
} from "../index.js";
import { messageHash } from "../canonicalize.js";
import type {
  OcProcessorManifest,
  QubicInvocation,
  QubicComputorKey,
} from "../types.js";

const MANIFEST: OcProcessorManifest = {
  processor_id: "aigarth-test",
  capabilities: ["ann_execution"],
  fee_qubic: "1000000",
  endpoint: "https://example.test/oc/aigarth-test",
  result_pubkey: "ab".repeat(32),
};

function makeKeyMap(inv: QubicInvocation): Map<string, QubicComputorKey> {
  const m = new Map<string, QubicComputorKey>();
  inv.signatures.computors.forEach((c, i) => m.set(c, { computorIndex: i, publicKeyHex: "ab".repeat(32) }));
  return m;
}

function makeInvocation(): QubicInvocation {
  const inv: QubicInvocation = {
    kind: "invocation",
    contract_index: 1,
    procedure: "ann_execution",
    caller: "a".repeat(64),
    payer: "b".repeat(64),
    fee_paid_qubit: "0",
    epoch: 1,
    nonce: "n",
    payload: {},
    signatures: {
      computors: Array.from({ length: 451 }, (_, i) => i.toString(16).padStart(64, "0")),
      sigs: Array.from({ length: 451 }, () => "deadbeef".repeat(8)),
      message_hash: "",
    },
  };
  inv.signatures.message_hash = messageHash(inv);
  return inv;
}

describe("OcProcessorRegistry", () => {
  it("handles a verified invocation end-to-end", async () => {
    const reg = new OcProcessorRegistry();
    reg.register({
      manifest: MANIFEST,
      signingKey: { publicKeyHex: MANIFEST.result_pubkey, secret: "test-secret" },
      handler: async (inv) => ({ status: "verified", result: { work_id: "wki_test", invocation_epoch: inv.epoch } }),
      computorKeys: makeKeyMap(makeInvocation()),
    });
    const inv = makeInvocation();
    const result = await reg.handle({ processorId: "aigarth-test", invocation: inv });
    expect(result.status).toBe("verified");
    expect(result.work_id).toBe("wki_test");
    expect(result.aigarth_signature.length).toBe(64);
  });

  it("rejects with PROCESSOR_PAUSED when the circuit is open", async () => {
    const reg = new OcProcessorRegistry();
    reg.register({
      manifest: MANIFEST,
      signingKey: { publicKeyHex: MANIFEST.result_pubkey, secret: "x" },
      handler: async () => ({ status: "verified", result: {} }),
      computorKeys: makeKeyMap(makeInvocation()),
    });
    reg.pause("aigarth-test");
    const inv = makeInvocation();
    await expect(reg.handle({ processorId: "aigarth-test", invocation: inv })).rejects.toMatchObject({
      code: OcErrorCode.PROCESSOR_PAUSED,
    });
  });

  it("rejects unknown processor", async () => {
    const reg = new OcProcessorRegistry();
    const inv = makeInvocation();
    await expect(reg.handle({ processorId: "nope", invocation: inv })).rejects.toMatchObject({
      code: OcErrorCode.INTERNAL,
    });
  });

  it("rejects when handler throws and records a failure", async () => {
    const reg = new OcProcessorRegistry();
    reg.register({
      manifest: MANIFEST,
      signingKey: { publicKeyHex: MANIFEST.result_pubkey, secret: "x" },
      handler: async () => {
        throw new Error("boom");
      },
      computorKeys: makeKeyMap(makeInvocation()),
    });
    const inv = makeInvocation();
    await expect(reg.handle({ processorId: "aigarth-test", invocation: inv })).rejects.toMatchObject({
      code: OcErrorCode.HANDLER_FAILED,
    });
  });

  it("list() returns registered processors", () => {
    const reg = new OcProcessorRegistry();
    reg.register({
      manifest: MANIFEST,
      signingKey: { publicKeyHex: MANIFEST.result_pubkey, secret: "x" },
      handler: async () => ({ status: "verified", result: {} }),
    });
    expect(reg.list()).toHaveLength(1);
    expect(reg.list()[0]!.processor_id).toBe("aigarth-test");
  });
});
