# @aigarth/evo-wasm

Browser-side WebAssembly port of the [`@aigarth/evo`](../../evo) substrate. Used by the AIGARTH-EVO-02 Contribute widget on the dashboard. Browser workers run the same deterministic evaluation as the server-side TypeScript implementation, so the Work Runtime verifier can spot-check a browser submission by re-running the same genome + inputs server-side and confirming a byte-identical result.

## Build

```
pnpm --filter @aigarth/evo-wasm build
```

This runs:

1. `asc assembly/index.ts --target release ...` — compiles the AssemblyScript to `dist/evo-wasm.wasm`.
2. `tsc` — emits the JS loader (`src/loader.ts`) to `dist/evo-wasm.js`.

## Use

```ts
import { loadEvoWasm, packGenome, scoreRows } from "@aigarth/evo-wasm";

const wasm = await loadEvoWasm("/evo-wasm.wasm");
const packed = packGenome(wasm, genome);
const accuracy = scoreRows(wasm, packed, env.examples(), 2);
```

## Layout

See `assembly/index.ts` for the canonical memory layout. Summary:

- `genome_data`: i32 array, header (node_count, input_count, output_count) + input/output indices + per-node (3 input refs + 27 rule entries)
- `state_data`: i8 scratch, length node_count
- `input_data`, `output_data`, `target_data`: i32 scratch buffers
