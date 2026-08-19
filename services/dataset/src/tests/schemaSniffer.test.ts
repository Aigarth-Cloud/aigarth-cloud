/**
 * Tests for the schema sniffer (Phase 19B.3).
 *
 * Covers all sniffed formats and edge cases. The sniffer is a
 * pure function (no I/O), so no fixtures or DB needed.
 */

import { describe, it, expect } from "vitest";
import { sniffSchema } from "../services/schemaSniffer.js";

describe("sniffSchema — CSV", () => {
  it("infers columns from a header row and infers types from values", () => {
    const csv = `name,age,active,joined_at
Alice,30,true,2024-01-15
Bob,25,false,2024-02-20
Carol,40,true,2024-03-10
`;
    const out = sniffSchema(Buffer.from(csv, "utf-8"), "text/csv");
    expect(out.kind).toBe("tabular");
    expect(out.columns).toEqual([
      { name: "name", type: "string", nullable: undefined },
      { name: "age", type: "number", nullable: undefined },
      { name: "active", type: "boolean", nullable: undefined },
      { name: "joined_at", type: "date", nullable: undefined },
    ]);
    expect(out.mimeType).toBe("text/csv");
    expect(out.encoding).toBe("utf-8");
  });

  it("handles TSV (tab-separated)", () => {
    const tsv = "col1\tcol2\n1\t2\n3\t4\n";
    const out = sniffSchema(Buffer.from(tsv, "utf-8"));
    expect(out.kind).toBe("tabular");
    expect(out.columns?.map((c) => c.name)).toEqual(["col1", "col2"]);
  });

  it("handles quoted fields with embedded commas", () => {
    const csv = `name,note
"Smith, John","hello, world"
"Doe, Jane","test, 123"
`;
    const out = sniffSchema(Buffer.from(csv, "utf-8"), "text/csv");
    expect(out.kind).toBe("tabular");
    expect(out.columns).toHaveLength(2);
    expect(out.columns?.[0]?.name).toBe("name");
    expect(out.columns?.[1]?.name).toBe("note");
  });

  it("handles a CSV with only a header (no data rows)", () => {
    const csv = "a,b,c\n";
    const out = sniffSchema(Buffer.from(csv, "utf-8"));
    expect(out.kind).toBe("tabular");
    expect(out.columns?.map((c) => c.name)).toEqual(["a", "b", "c"]);
  });
});

describe("sniffSchema — JSON / JSONL", () => {
  it("infers columns from a JSON object", () => {
    const json = JSON.stringify({ name: "Alice", age: 30, active: true, joined_at: "2024-01-15" });
    const out = sniffSchema(Buffer.from(json, "utf-8"), "application/json");
    expect(out.kind).toBe("text");
    expect(out.columns).toEqual([
      { name: "name", type: "string", nullable: false },
      { name: "age", type: "number", nullable: false },
      { name: "active", type: "boolean", nullable: false },
      { name: "joined_at", type: "string", nullable: false },
    ]);
  });

  it("infers columns from a JSON array's first object", () => {
    const json = JSON.stringify([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const out = sniffSchema(Buffer.from(json, "utf-8"));
    expect(out.kind).toBe("text");
    expect(out.columns?.map((c) => c.name)).toEqual(["name", "age"]);
  });

  it("infers columns from the first JSONL line", () => {
    const jsonl = `{"name":"Alice","score":0.95}
{"name":"Bob","score":0.42}
{"name":"Carol","score":0.78}
`;
    const out = sniffSchema(Buffer.from(jsonl, "utf-8"), "application/jsonl");
    expect(out.kind).toBe("text");
    expect(out.columns?.map((c) => c.name)).toEqual(["name", "score"]);
    expect(out.columns?.[1]?.type).toBe("number");
  });
});

describe("sniffSchema — Parquet", () => {
  it("detects Parquet by magic bytes", () => {
    // First 4 bytes = "PAR1"
    const bytes = Buffer.concat([Buffer.from("PAR1"), Buffer.alloc(100, 0)]);
    const out = sniffSchema(bytes);
    expect(out.kind).toBe("tabular");
    expect(out.notes).toContain("Parquet detected");
  });
});

describe("sniffSchema — image", () => {
  it("detects PNG by magic bytes", () => {
    // PNG magic: 89 50 4e 47
    const bytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(100, 0)]);
    const out = sniffSchema(bytes);
    expect(out.kind).toBe("image");
  });

  it("detects JPEG by magic bytes", () => {
    // JPEG magic: ff d8
    const bytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 0)]);
    const out = sniffSchema(bytes);
    expect(out.kind).toBe("image");
  });
});

describe("sniffSchema — fallback", () => {
  it("returns 'other' for unrecognized content", () => {
    const out = sniffSchema(Buffer.from("this is just plain text with no structure"));
    expect(out.kind).toBe("other");
    expect(out.notes).toBeDefined();
  });

  it("never throws on garbage input", () => {
    const out = sniffSchema(Buffer.from([0, 1, 2, 3, 255, 254, 253]));
    expect(out).toBeDefined();
    expect(out.kind).toBeDefined();
  });
});
