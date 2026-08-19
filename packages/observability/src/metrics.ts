/**
 * Tiny Prometheus-compatible metrics primitives.
 *
 * Why hand-rolled (and not `prom-client`):
 *   - The full prom-client surface is large and we use <10% of it.
 *   - Zero new dependencies; the renderer is ~80 lines of stdlib.
 *   - Easier to test in isolation (no global default registry).
 *
 * Supported metric types:
 *   - Counter: monotonic, only incremented.
 *   - Gauge: arbitrary value (e.g. pause flag, queue depth).
 *   - Histogram: bucketed observation. Buckets are inclusive upper
 *     bounds in seconds. `+Inf` is implicit.
 *
 * Output is plain-text Prometheus exposition format
 * (https://prometheus.io/docs/instrumenting/exposition_formats/).
 * Each metric is rendered with `# HELP` + `# TYPE` lines + the data
 * lines. Labels are sorted alphabetically for stable output.
 *
 * Process metrics (uptime, rss, heap, pid) are added automatically
 * by the renderer — every /metrics scrape gets them for free.
 */

export type LabelValues = Record<string, string>;

/** Discriminated by `.name` for the registry to key metrics. */
export interface NamedMetric {
  readonly name: string;
  render(): string;
  reset(): void;
}

export interface MetricOptions {
  name: string;
  help: string;
  /** Labels declared at registration time. Required for labelled metrics. */
  labelNames?: string[];
}

export class Counter implements NamedMetric {
  readonly name: string;
  private readonly help: string;
  private readonly labelNames: string[];
  /** key = sorted-label-tuple joined by 0x1f, value = count. */
  private readonly values = new Map<string, bigint>();

  constructor(opts: MetricOptions) {
    this.name = opts.name;
    this.help = opts.help;
    this.labelNames = (opts.labelNames ?? []).slice().sort();
  }

  inc(labels: LabelValues = {}, value: bigint | number = 1n): void {
    if (value < 0n && typeof value !== "number") {
      throw new Error(`Counter ${this.name} cannot decrement (got ${value})`);
    }
    const key = labelKey(labels, this.labelNames);
    const cur = this.values.get(key) ?? 0n;
    this.values.set(key, cur + BigInt(value));
  }

  /** Returns the current value for the given label set (0 if unset). */
  get(labels: LabelValues = {}): bigint {
    return this.values.get(labelKey(labels, this.labelNames)) ?? 0n;
  }

  reset(): void {
    this.values.clear();
  }

  render(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this.values.size === 0) {
      // Emit a zero line so the metric appears in scrapes.
      lines.push(this.name + (this.labelNames.length === 0 ? "" : "{}") + " 0");
      return lines.join("\n");
    }
    const sortedKeys = Array.from(this.values.keys()).sort();
    for (const k of sortedKeys) {
      const labelPart = renderLabelBlock(k, this.labelNames);
      const val = this.values.get(k)!;
      lines.push(`${this.name}${labelPart} ${val}`);
    }
    return lines.join("\n");
  }
}

export class Gauge implements NamedMetric {
  readonly name: string;
  private readonly help: string;
  private readonly labelNames: string[];
  private readonly values = new Map<string, number>();

  constructor(opts: MetricOptions) {
    this.name = opts.name;
    this.help = opts.help;
    this.labelNames = (opts.labelNames ?? []).slice().sort();
  }

  set(labels: LabelValues, value: number): void;
  set(value: number): void;
  set(arg1: LabelValues | number, arg2?: number): void {
    const labels = typeof arg1 === "object" ? arg1 : {};
    const value = typeof arg1 === "number" ? arg1 : arg2!;
    const key = labelKey(labels, this.labelNames);
    this.values.set(key, value);
  }

  inc(labels: LabelValues = {}, value = 1): void {
    const key = labelKey(labels, this.labelNames);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  dec(labels: LabelValues = {}, value = 1): void {
    const key = labelKey(labels, this.labelNames);
    this.values.set(key, (this.values.get(key) ?? 0) - value);
  }

  get(labels: LabelValues = {}): number {
    return this.values.get(labelKey(labels, this.labelNames)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  render(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    if (this.values.size === 0) {
      lines.push(this.name + (this.labelNames.length === 0 ? "" : "{}") + " 0");
      return lines.join("\n");
    }
    const sortedKeys = Array.from(this.values.keys()).sort();
    for (const k of sortedKeys) {
      const labelPart = renderLabelBlock(k, this.labelNames);
      const val = this.values.get(k)!;
      lines.push(`${this.name}${labelPart} ${val}`);
    }
    return lines.join("\n");
  }
}

export interface HistogramOpts extends MetricOptions {
  /** Inclusive upper bounds in seconds. The last bucket is implicit +Inf. */
  buckets: number[];
}

export class Histogram implements NamedMetric {
  readonly name: string;
  private readonly help: string;
  private readonly labelNames: string[];
  /** Buckets are sorted ascending + deduped at construction. */
  private readonly buckets: number[];
  /** Per-label-set state. */
  private readonly series = new Map<
    string,
    { counts: bigint[]; sum: number; count: bigint }
  >();

  constructor(opts: HistogramOpts) {
    this.name = opts.name;
    this.help = opts.help;
    this.labelNames = (opts.labelNames ?? []).slice().sort();
    this.buckets = Array.from(new Set(opts.buckets)).sort((a, b) => a - b);
  }

  observe(labels: LabelValues, valueSeconds: number): void {
    if (!Number.isFinite(valueSeconds)) {
      throw new Error(`Histogram ${this.name} observe requires a finite number, got ${valueSeconds}`);
    }
    const key = labelKey(labels, this.labelNames);
    let s = this.series.get(key);
    if (!s) {
      s = {
        counts: new Array(this.buckets.length).fill(0n),
        sum: 0,
        count: 0n,
      };
      this.series.set(key, s);
    }
    // Prometheus histograms are cumulative. The render path
    // produces the cumulative count, so we only need to record
    // which bucket the observation fell into (the smallest one
    // whose upper bound is >= the value).
    for (let i = 0; i < this.buckets.length; i++) {
      if (valueSeconds <= this.buckets[i]!) {
        s.counts[i]! += 1n;
        break;
      }
    }
    s.count += 1n;
    s.sum += valueSeconds;
  }

  reset(): void {
    this.series.clear();
  }

  render(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    if (this.series.size === 0) {
      // Emit all-zero buckets + sum + count so the metric appears.
      const baseLabel = this.labelNames.length === 0 ? "" : "{}";
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${b}"}${baseLabel} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"}${baseLabel} 0`);
      lines.push(`${this.name}_sum${baseLabel} 0`);
      lines.push(`${this.name}_count${baseLabel} 0`);
      return lines.join("\n");
    }
    const sortedKeys = Array.from(this.series.keys()).sort();
    for (const k of sortedKeys) {
      const s = this.series.get(k)!;
      const baseLabels = decodeLabelKey(k, this.labelNames);
      const basePart = baseLabels
        ? "{" + baseLabels + "}"
        : this.labelNames.length > 0
          ? "{}"
          : "";
      let cumulative = 0n;
      for (let i = 0; i < this.buckets.length; i++) {
        cumulative += s.counts[i]!;
        const inner =
          baseLabels !== ""
            ? baseLabels + `,le="${this.buckets[i]}"`
            : `le="${this.buckets[i]}"`;
        lines.push(`${this.name}_bucket{${inner}} ${cumulative}`);
      }
      // +Inf bucket = total count.
      const infInner = baseLabels !== "" ? baseLabels + `,le="+Inf"` : `le="+Inf"`;
      lines.push(`${this.name}_bucket{${infInner}} ${s.count}`);
      lines.push(`${this.name}_sum${basePart} ${s.sum}`);
      lines.push(`${this.name}_count${basePart} ${s.count}`);
    }
    return lines.join("\n");
  }
}

export class Registry {
  private readonly metrics = new Map<string, NamedMetric>();
  private readonly processMetricsEnabled: boolean;

  constructor(opts: { includeProcessMetrics?: boolean } = {}) {
    this.processMetricsEnabled = opts.includeProcessMetrics ?? true;
  }

  registerCounter(opts: MetricOptions): Counter {
    const m = new Counter(opts);
    this.registerOne(m);
    return m;
  }

  registerGauge(opts: MetricOptions): Gauge {
    const m = new Gauge(opts);
    this.registerOne(m);
    return m;
  }

  registerHistogram(opts: HistogramOpts): Histogram {
    const m = new Histogram(opts);
    this.registerOne(m);
    return m;
  }

  private registerOne(m: NamedMetric): void {
    if (this.metrics.has(m.name)) {
      throw new Error(`Metric ${m.name} is already registered`);
    }
    this.metrics.set(m.name, m);
  }

  /** Render the registry as a single Prometheus text-format body. */
  render(): string {
    const blocks: string[] = [];
    // Process metrics first (alphabetical by service convention).
    if (this.processMetricsEnabled) {
      blocks.push(renderProcessMetrics());
    }
    // User metrics in registration order (insertion order in Map is
    // preserved).
    for (const m of this.metrics.values()) {
      blocks.push(m.render());
    }
    return blocks.join("\n\n") + "\n";
  }

  /** Reset all user metrics. Process metrics always re-render fresh. */
  resetAll(): void {
    for (const m of this.metrics.values()) m.reset();
  }
}

// ---------- Internals ----------

/** Build the canonical key for a label set, given the metric's declared labelNames. */
function labelKey(labels: LabelValues, labelNames: string[]): string {
  if (labelNames.length === 0) return "";
  // Sort by labelNames order (already sorted at construction) for
  // a stable key. Encode each value with the unit-separator (0x1f)
  // so labels containing commas don't collide.
  const parts: string[] = [];
  for (const n of labelNames) {
    parts.push(escapeLabelValue(labels[n] ?? ""));
  }
  return parts.join("\x1f");
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Render the canonical {key="value",...} block for a series key.
 * Returns the inner content (no braces) when labels exist, an empty
 * string when the metric has no labels.
 */
function renderLabelBlock(key: string, labelNames: string[]): string {
  if (labelNames.length === 0) return "";
  const inner = decodeLabelKey(key, labelNames);
  return `{${inner}}`;
}

/**
 * Decode a key (0x1f-separated label values) back into a
 * `name="value",name="value"` string. Returns "" if no labels.
 */
function decodeLabelKey(key: string, labelNames: string[]): string {
  if (labelNames.length === 0) return "";
  const parts = key.split("\x1f");
  const pairs: string[] = [];
  for (let i = 0; i < labelNames.length; i++) {
    const v = parts[i] ?? "";
    pairs.push(`${labelNames[i]}="${escapeLabelValue(v)}"`);
  }
  return pairs.join(",");
}

function renderProcessMetrics(): string {
  const mu = process.memoryUsage();
  const lines: string[] = [
    `# HELP process_uptime_seconds Process uptime in seconds.`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${(process.uptime?.() ?? 0).toFixed(3)}`,
    `# HELP process_resident_memory_bytes Resident memory size in bytes.`,
    `# TYPE process_resident_memory_bytes gauge`,
    `process_resident_memory_bytes ${mu.rss}`,
    `# HELP process_heap_bytes V8 heap size in bytes (used / total).`,
    `# TYPE process_heap_bytes gauge`,
    `process_heap_bytes{what="used"} ${mu.heapUsed}`,
    `process_heap_bytes{what="total"} ${mu.heapTotal}`,
    `# HELP process_pid Process ID.`,
    `# TYPE process_pid gauge`,
    `process_pid ${process.pid}`,
    `# HELP process_node_version_info Node.js version info (always 1).`,
    `# TYPE process_node_version_info gauge`,
    `process_node_version_info{version="${escapeLabelValue(process.version)}"} 1`,
  ];
  return lines.join("\n");
}
