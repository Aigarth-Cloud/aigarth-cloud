import { describe, it, expect } from "vitest";
import { SignalRefSchema, SignalSourceSchema } from "../signal";

describe("signal", () => {
  it("SignalSourceSchema accepts every documented source", () => {
    for (const s of [
      "ann_decision",
      "event",
      "feature",
      "market",
      "user",
      "system",
      "external",
    ] as const) {
      expect(SignalSourceSchema.parse(s)).toBe(s);
    }
  });

  it("SignalSourceSchema rejects unknown sources", () => {
    expect(() => SignalSourceSchema.parse("nope")).toThrow();
  });

  describe("SignalRefSchema", () => {
    it("parses a minimal signal", () => {
      const sig = SignalRefSchema.parse({ source: "event", id: "evt_123" });
      expect(sig.source).toBe("event");
      expect(sig.id).toBe("evt_123");
      expect(sig.content_hash).toBeUndefined();
      expect(sig.label).toBeUndefined();
    });

    it("parses a fully populated signal", () => {
      const sig = SignalRefSchema.parse({
        source: "ann_decision",
        id: "dec_abc",
        content_hash: "a".repeat(64),
        label: "Sales lead scoring",
      });
      expect(sig.content_hash).toBe("a".repeat(64));
      expect(sig.label).toBe("Sales lead scoring");
    });

    it("rejects empty id", () => {
      expect(() => SignalRefSchema.parse({ source: "event", id: "" })).toThrow();
    });

    it("rejects id over 256 chars", () => {
      expect(() =>
        SignalRefSchema.parse({ source: "event", id: "x".repeat(257) }),
      ).toThrow();
    });

    it("rejects malformed content_hash (too short, too long, non-hex)", () => {
      expect(() =>
        SignalRefSchema.parse({ source: "event", id: "x", content_hash: "abc" }),
      ).toThrow();
      expect(() =>
        SignalRefSchema.parse({
          source: "event",
          id: "x",
          content_hash: "z".repeat(64),
        }),
      ).toThrow();
      expect(() =>
        SignalRefSchema.parse({
          source: "event",
          id: "x",
          content_hash: "a".repeat(65),
        }),
      ).toThrow();
    });

    it("accepts mixed-case content_hash (normalised to lowercase by regex)", () => {
      const sig = SignalRefSchema.parse({
        source: "event",
        id: "x",
        content_hash: "A".repeat(64),
      });
      expect(sig.content_hash).toBe("A".repeat(64));
    });
  });
});
