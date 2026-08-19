/**
 * Schema sniffer (Phase 19B.3).
 *
 * Reads the first ~1 MiB of an uploaded dataset and infers a
 * minimal schema:
 *
 *   - CSV/TSV      → first row is the header, infer column types
 *                    from a sample of values
 *   - JSON Lines   → first non-empty line is the schema template
 *   - JSON array   → first object in the array is the schema template
 *   - Parquet      → look for the magic bytes "PAR1" and report
 *                    `kind: "tabular"` with a "use parquet-tools"
 *                    note. Full Parquet introspection is a v2.
 *   - PNG / JPEG   → image kind, no column schema
 *   - Anything else → `kind: "other"`, no columns, just the mime type
 *
 * Failure model: never throws. Returns a best-effort schema with
 * a `notes` field explaining what couldn't be inferred.
 */

import type { DatasetSchema } from "../db/schema.js";

/** Sniff a dataset from a prefix of its bytes. */
export function sniffSchema(
  bytes: Buffer,
  mimeType?: string,
): DatasetSchema {
  const text = bytes.toString("utf-8");
  const inferredMime = mimeType ?? guessMimeType(bytes);

  // CSV / TSV — sniff the first line for a header row.
  if (inferredMime === "text/csv" || looksLikeDelimited(text, ",")) {
    return sniffDelimited(text, ",");
  }
  if (inferredMime === "text/tab-separated-values" || looksLikeDelimited(text, "\t")) {
    return sniffDelimited(text, "\t");
  }

  // JSON / JSONL
  if (inferredMime === "application/jsonl" || inferredMime === "application/x-ndjson") {
    return sniffJsonl(text);
  }
  if (inferredMime === "application/json") {
    return sniffJson(text);
  }
  if (looksLikeJson(text)) {
    return sniffJson(text);
  }

  // Parquet
  if (inferredMime === "application/vnd.apache.parquet" || looksLikeParquet(bytes)) {
    return {
      kind: "tabular",
      notes:
        "Parquet detected. Column-level introspection is a v2 feature; the training service will read the footer at job time.",
    };
  }

  // Image
  if (inferredMime?.startsWith("image/") || looksLikeImage(bytes)) {
    return { kind: "image", mimeType: inferredMime ?? "image/*" };
  }

  // Audio
  if (inferredMime?.startsWith("audio/")) {
    return { kind: "audio", mimeType: inferredMime };
  }

  // Fallback
  return {
    kind: "other",
    mimeType: inferredMime,
    notes:
      "Could not infer a structured schema from the first 1 MiB. The dataset will still be stored and may be inspected manually.",
  };
}

// ---------- Helpers ----------

function guessMimeType(bytes: Buffer): string | undefined {
  if (bytes.length < 4) return undefined;
  if (bytes[0] === 0x50 && bytes[1] === 0x41 && bytes[2] === 0x52 && bytes[3] === 0x31) {
    return "application/vnd.apache.parquet";
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "audio/wav";
  }
  return undefined;
}

function looksLikeDelimited(text: string, sep: string): boolean {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  // Reject anything that smells like JSON before checking CSV.
  const trimmed = firstLine.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  if (firstLine.includes(sep) && firstLine.length < 4096) {
    return firstLine.split(sep).length >= 2;
  }
  return false;
}

function looksLikeJson(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

function looksLikeParquet(bytes: Buffer): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x41 &&
    bytes[2] === 0x52 &&
    bytes[3] === 0x31
  );
}

function looksLikeImage(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  return (
    (bytes[0] === 0x89 && bytes[1] === 0x50) || // PNG
    (bytes[0] === 0xff && bytes[1] === 0xd8) || // JPEG
    (bytes[0] === 0x47 && bytes[1] === 0x49) || // GIF
    (bytes[0] === 0x42 && bytes[1] === 0x4d) // BMP
  );
}

function sniffDelimited(text: string, sep: string): DatasetSchema {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0).slice(0, 200);
  if (lines.length < 1) {
    return { kind: "tabular", mimeType: "text/csv", notes: "Empty dataset" };
  }
  const header = parseCsvLine(lines[0]!, sep);
  const sampleRows = lines.slice(1, Math.min(lines.length, 51)).map((l) => parseCsvLine(l, sep));
  const columns = header.map((name, i) => ({
    name,
    type: inferColumnType(sampleRows.map((r) => r[i])),
  }));
  return {
    kind: "tabular",
    columns,
    mimeType: sep === "\t" ? "text/tab-separated-values" : "text/csv",
    encoding: "utf-8",
  };
}

function sniffJsonl(text: string): DatasetSchema {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) {
    return { kind: "text", mimeType: "application/jsonl", notes: "Empty JSONL" };
  }
  try {
    const obj = JSON.parse(firstLine);
    return { kind: "text", columns: objectToColumns(obj), mimeType: "application/jsonl" };
  } catch {
    return { kind: "text", mimeType: "application/jsonl", notes: "First JSONL line did not parse" };
  }
}

function sniffJson(text: string): DatasetSchema {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
      return { kind: "text", columns: objectToColumns(parsed[0]), mimeType: "application/json" };
    }
    if (typeof parsed === "object" && parsed !== null) {
      return { kind: "text", columns: objectToColumns(parsed), mimeType: "application/json" };
    }
    return { kind: "text", mimeType: "application/json" };
  } catch {
    return { kind: "text", mimeType: "application/json", notes: "Top-level JSON did not parse" };
  }
}

function parseCsvLine(line: string, sep: string): string[] {
  // Minimal CSV parser: handles quoted fields with embedded commas
  // and escaped quotes. Doesn't handle every edge case (CRLF in
  // quoted fields, multi-line records) — that's a v2 problem.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function objectToColumns(obj: Record<string, unknown>): DatasetSchema["columns"] {
  return Object.keys(obj).map((name) => {
    const v = obj[name];
    return {
      name,
      type: inferColumnType([v as string | undefined]),
      nullable: v === null,
    };
  });
}

function inferColumnType(
  values: Array<unknown>,
): "string" | "number" | "boolean" | "date" | "json" {
  let numbers = 0;
  let booleans = 0;
  let dates = 0;
  let jsons = 0;
  let nonEmpty = 0;

  for (const raw of values) {
    if (raw === undefined || raw === null || raw === "") continue;
    nonEmpty++;
    // Normalize native types to the string heuristic
    let v: string;
    if (typeof raw === "number") {
      v = String(raw);
    } else if (typeof raw === "boolean") {
      v = raw ? "true" : "false";
    } else if (typeof raw === "string") {
      v = raw;
    } else {
      // objects, arrays → try JSON
      try {
        JSON.stringify(raw);
        jsons++;
        continue;
      } catch {
        return "string";
      }
    }

    const lc = v.toLowerCase();
    if (lc === "true" || lc === "false") {
      booleans++;
      continue;
    }
    const n = Number(v);
    if (!Number.isNaN(n) && v.trim() !== "") {
      numbers++;
      continue;
    }
    // ISO date heuristic — YYYY-MM-DD or full ISO 8601
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) {
      dates++;
      continue;
    }
    if (v.startsWith("{") || v.startsWith("[")) {
      try {
        JSON.parse(v);
        jsons++;
        continue;
      } catch {
        // not json
      }
    }
  }

  if (nonEmpty === 0) return "string";
  if (booleans === nonEmpty) return "boolean";
  if (numbers === nonEmpty) return "number";
  // Date and JSON inferences need at least 2 data points to be
  // trustworthy. With a single value, the pattern match is too
  // aggressive — fall back to "string" so the user can override.
  if (nonEmpty >= 2 && dates === nonEmpty) return "date";
  if (nonEmpty >= 2 && jsons >= Math.floor(nonEmpty / 2)) return "json";
  return "string";
}
