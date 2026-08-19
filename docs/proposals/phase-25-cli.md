# Phase 25 — Aigarth CLI (agent-grade)

> **Status:** Proposal, awaiting approval
> **Date:** 2026-08-10
> **Runtime:** Node + `npm install -g @aigarth/cli` (single-binary distribution deferred to a later phase)
> **Auth:** API key + Qubic wallet binding (matches the existing identity service)
> **Scope:** Foundation + discovery + one execution path (ANN inference via the gateway)
> **Related docs:** [`docs/BRD.md`](../BRD.md), [`docs/PRODUCT-VISION.md`](../PROPOSALS/phase-3-vision-marketing.md), [`packages/sdk/src/resources/`](../../packages/sdk/src/resources/) (the SDK this CLI wraps)

---

## 1. Why this exists

Every LLM agent that wants to use Aigarth has to either call the SDK directly (heavy — pulls in the full TypeScript runtime, fights the bundler, has to deal with `.js` import extensions) or hit REST endpoints by hand (fragile — agents get the schema wrong constantly, and there's no introspection).

The CLI is the missing layer: it's the surface an agent can call from bash with stable, documented JSON output, and it's also the surface a human can use interactively with `--human` pretty-printing. It is the canonical way to drive the Aigarth platform from a terminal, designed agent-first.

The two design choices that matter most:

1. **No interactive prompts.** If a command needs input, it errors with a clear "missing --foo" message. The agent retries with the flag.
2. **Schema is the contract.** Every output has a `schema_version`. The CLI ships a `aigarth schema` command that returns the JSON schema for any command's output. Agents can introspect the surface at runtime, not at training time.

The differentiator from a typical dev CLI: JSON is the default, errors are structured, exit codes map to error classes, idempotency is first-class, and the auth model is a Qubic-signed bearer key (not a session cookie).

---

## 2. The shape

A single `aigarth` command with a tree of subcommands, mirroring the SDK resource hierarchy. Distributed as `@aigarth/cli` on npm. Single-binary compilation (via `bun build --compile`) is deferred to a later phase when the platform is more mature and the agent-ecosystem value of a single static binary outweighs the iteration cost.

```
$ aigarth auth login --api-key aig_pat_... --qubic-seed 0x...
$ aigarth whoami
$ aigarth anns list --json
$ aigarth anns run my-ann --input '{"x": 1}' --json
$ aigarth tissues list --json
$ aigarth marketplace search "fraud detection" --json
$ aigarth nodes reservations --json
$ aigarth self version
$ aigarth self update
$ aigarth schema anns run            # JSON schema for that command's output
$ aigarth help anns run               # synopsis, flags, examples, exit codes
```

---

## 3. The auth model

The CLI uses an **API key + Qubic wallet binding**. The flow:

1. `aigarth auth login` prompts for a long-lived API key (created via the existing `/v1/auth/api-keys` endpoint in the identity service).
2. The CLI requests a binding nonce from `GET /v1/auth/wallet-link/start`.
3. The user signs the nonce with their Qubic wallet seed (the same `prewarmQubic()` flow from `apps/web/app/(auth)/prewarm-qubic.tsx`).
4. The CLI submits the signature to `POST /v1/auth/wallet-link/finish`.
5. The resulting bearer token is stored at `~/.config/aigarth/credentials.json` with mode `0600`.

The bearer token is what every subsequent call uses. The CLI does not store the wallet seed after login — it only stores the signed bearer.

```
~/.config/aigarth/
  credentials.json       # 0600, contains { api_key, bearer_token, wallet_address, user_id, org_id }
  config.json            # default output mode (json|human), default tier, telemetry opt-in
  cache/                 # 24h TTL on discovery responses (anns list, marketplace search, etc.)
```

The credentials file is 0600. The bearer token is the only thing the CLI needs to make API calls; the API key is stored for transparency (so `aigarth whoami` can show the user which key they're using) but the bearer is what travels.

**Token refresh:** the bearer expires every 30 days. The CLI re-runs the wallet-link flow automatically on 401, so the user only needs to sign once per session. If the wallet seed isn't available (CI, agent runtime), the agent uses the long-lived API key as a fallback.

---

## 4. The output model

Every command follows the same wire shape. JSON is the default; `--human` switches to pretty output.

### 4.1 Success envelope

```json
{
  "schema_version": "1.0.0",
  "command": "anns.run",
  "data": { ... command-specific payload ... },
  "meta": {
    "request_id": "req_...",
    "duration_ms": 234,
    "rate_limit_remaining": 99
  }
}
```

`schema_version` is the contract. Breaking changes bump the major version. The CLI refuses to parse a response with an unknown major version (forward-compat fail-fast).

### 4.2 Error envelope

```json
{
  "schema_version": "1.0.0",
  "command": "anns.run",
  "error": {
    "code": "ANN_NOT_FOUND",
    "message": "ANN 'my-ann' was not found in the marketplace.",
    "details": { "slug": "my-ann", "tier": 1 },
    "retryable": false,
    "request_id": "req_..."
  }
}
```

### 4.3 Exit codes

| Code | Meaning | Retryable |
|---|---|---|
| 0 | Success | — |
| 1 | User error (bad input, missing flag, validation failure) | No |
| 2 | Server error (5xx from a service) | Maybe |
| 3 | Rate limited (429) | Yes, with backoff |
| 4 | Auth error (401, 403) | No — re-auth required |
| 5 | Conflict (409, e.g. reservation already confirmed) | No |
| 64 | Internal CLI error (bug) | No — file an issue |
| 130 | SIGINT (Ctrl-C) | — |

Agents can branch on the exit code without parsing the error envelope. The envelope is for humans (and for agents that want richer context).

### 4.4 Streams

- **stdout**: the success/error envelope (JSON or `--human` pretty-printed)
- **stderr**: logs, progress events, deprecation warnings

Progress events are NDJSON on stderr when `--progress` is set:
```
{"ts": "...", "level": "info", "event": "upload.started", "bytes_total": 1024}
{"ts": "...", "level": "info", "event": "upload.completed", "bytes_total": 1024}
```

Agents that want to suppress logs redirect stderr to `/dev/null`. Agents that want live progress leave stderr connected and parse NDJSON.

---

## 5. MVP scope (Phase 25)

Foundation + discovery + one execution path. ~8 SP, mirrors the cadence that worked for Phase 24.

| Command | Purpose | Method on SDK |
|---|---|---|
| `aigarth auth login` | API key + wallet binding, persists credentials | identity + qubic |
| `aigarth auth status` | Show current user + org + wallet | identity |
| `aigarth auth logout` | Delete credentials file | local |
| `aigarth whoami` | Compact JSON: user, org, wallet, tier, scopes | identity + qubic |
| `aigarth anns list [--category X] [--limit N]` | List ANNs, paginated | ann.list |
| `aigarth anns retrieve <slug>` | Fetch one ANN | ann.retrieve |
| `aigarth anns run <slug> --input <json>` | Run inference (OpenAI-compatible) | ann.run |
| `aigarth tissues list` | List tissues | tissue.list |
| `aigarth tissues retrieve <slug>` | Fetch one tissue | tissue.retrieve |
| `aigarth tissues run <slug> --input <json>` | Run tissue inference | tissue.run |
| `aigarth marketplace search <query> [--category X]` | Search marketplace | marketplace.search |
| `aigarth marketplace retrieve <slug>` | Fetch one listing | marketplace.retrieve |
| `aigarth nodes reservations` | List user's node reservations | compute.nodeReservations.list |
| `aigarth nodes reserve` | Create a new reservation (interactive: tier + yield opt-in) | compute.nodeReservations.create |
| `aigarth self version` | Print the CLI's version | local |
| `aigarth self update` | Self-update via GitHub releases | local |
| `aigarth schema <command-path>` | JSON schema for that command's output | local |
| `aigarth help <command-path>` | Synopsis, flags, examples, exit codes | local |

**On every command, the following flags work:**
- `--json` (default for non-TTY) / `--human` (default for TTY)
- `--dry-run` (mutating commands only)
- `--idempotency-key <uuid>` (mutating commands only)
- `--no-color` / `--quiet` / `--verbose`
- `--output <path>` (write the envelope to a file instead of stdout)
- `--schema-version <X.Y.Z>` (override the expected response schema; fails on mismatch)

---

## 6. Architecture

### 6.1 File layout

```
apps/cli/
  src/
    commands/                # one file per command family
      auth.ts                # auth login, auth status, auth logout
      whoami.ts
      anns.ts                # anns list, retrieve, run
      tissues.ts
      marketplace.ts
      nodes.ts               # nodes reservations, reserve
      self.ts                # self version, self update
      schema.ts              # schema <command-path>
      help.ts                # help <command-path>
    lib/
      config.ts              # ~/.config/aigarth/ read/write
      credentials.ts         # 0600 credentials file
      http.ts                # fetch wrapper with bearer + retry + idempotency
      output.ts              # success envelope + error envelope + pretty printer
      errors.ts              # error code catalog (AigarthError, exit code mapping)
      schema.ts              # in-memory JSON schemas per command output
      progress.ts            # NDJSON progress events on stderr
      signing.ts             # Qubic wallet binding nonce signing
    bin/
      aigarth.ts             # entry point: parse argv, dispatch
  package.json               # @aigarth/cli
  README.md
  tests/
    commands/                # one file per command
    lib/                     # config, http, output, errors unit tests
  vitest.config.ts
docs/proposals/phase-25-cli.md
docs/deliveries/phase-25-delivery.md
apps/dashboard/scripts/register-phase-25.ts
apps/dashboard/scripts/closeout-25.ts
```

### 6.2 The dispatcher

`bin/aigarth.ts` parses argv, resolves the command path, applies the global flags, and calls the command handler. The handler returns a `CommandResult` (success envelope or error envelope) and the dispatcher handles serialization + exit code.

```typescript
type CommandResult =
  | { ok: true; data: unknown; meta?: Record<string, unknown> }
  | { ok: false; error: AigarthError };

interface Command {
  path: string;                              // e.g. "anns.run"
  synopsis: string;
  description: string;
  flags: FlagSpec[];
  outputSchemaVersion: string;
  run: (args: ParsedArgs, ctx: CommandContext) => Promise<CommandResult>;
  examples: Example[];
  exitCodes: ExitCodeDoc[];
}
```

Each command file exports a `Command[]` array. The dispatcher concatenates them at startup and resolves by path.

### 6.3 The HTTP wrapper

`lib/http.ts` is a thin `fetch` wrapper that:
- Injects the bearer token from the credentials file
- Attaches an idempotency key on mutating requests (`--idempotency-key` or a generated UUID)
- Retries on 429 with exponential backoff (max 3 retries)
- Refreshes the bearer on 401 by re-running the wallet-link flow
- Maps HTTP errors to the error envelope
- Emits a `request.completed` progress event on stderr with `request_id`, `duration_ms`, `status_code`

The wrapper is the single place that knows about auth, retries, and idempotency. Every command uses it; none of them reimplement it.

### 6.4 The output module

`lib/output.ts`:
- `success(data, meta)` — produces the success envelope
- `failure(error)` — produces the error envelope
- `print(result, mode)` — writes the envelope to stdout (or `--output <path>`), exits with the right code
- `printHuman(envelope, mode)` — pretty-prints with tables, colors, summary lines (used by `--human`)

The pretty-printer is deliberately minimal: a JSON-aware table renderer, a color palette, and a "summary" line. No TUI, no paginator, no progress bars that override the stream. The CLI is a Unix tool first.

### 6.5 The schema module

`lib/schema.ts` keeps an in-memory map from `command_path` to `{ version, jsonSchema }`. Used by `aigarth schema <path>` and by the dispatcher to validate the response envelope before printing (in `--strict` mode).

Schemas are hand-authored per command and stored as JSON. They are the contract. When a command's output shape changes, the author bumps the schema version in lockstep.

### 6.6 The progress module

`lib/progress.ts`:
- `progress(event, payload)` — writes an NDJSON line to stderr
- `--quiet` suppresses these
- `--progress <path>` writes to a file instead of stderr

Used by the HTTP wrapper, by long-running commands (training, downloads), and by `--dry-run` to print what *would* happen.

---

## 7. Edge cases

| Edge case | Handling |
|---|---|
| User runs `aigarth` with no subcommand | Print top-level help to stderr, exit 1 |
| `--json` flag on a help or version command | The version string is the data field; one line of JSON |
| API key revoked mid-session | HTTP wrapper catches 401, refreshes the bearer; if the refresh fails, prints an error and exits 4 |
| Network timeout | HTTP wrapper retries 3x with exponential backoff, then exits 2 with a clear "could not reach <service>" error |
| Server returns a response with an unknown `schema_version` | Dispatcher fails fast with exit 1 and a clear "schema version mismatch: expected 1.x.x, got 2.0.0; run `aigarth self update`" message |
| User runs `aigarth anns run my-ann` (missing `--input`) | Exit 1 with `{"code": "MISSING_FLAG", "message": "missing required flag: --input", "details": {"flag": "--input"}}` |
| Two clients race on `--idempotency-key` | The server returns 409 with `{"code": "IDEMPOTENCY_KEY_REUSED", "details": {"original_request_id": "..."}}`; the CLI exits 5 |
| Credentials file is corrupted | CLI prints a clear "credentials file at ~/.config/aigarth/credentials.json is corrupted; run `aigarth auth login` again" and exits 4 |
| Output is piped to `jq` / `less` / a file | The CLI auto-detects non-TTY and switches to JSON; `--human` overrides |
| The user pipes both stdout and stderr | Logs go to stderr (correct Unix behavior); agents can separate them |

---

## 8. Phasing

### 8.1 This phase (Phase 25) ships

- 8 SP, 8 sub-stories (mirror of Phase 24's structure)
- `aigarth auth login` / `status` / `logout`
- `aigarth whoami`
- `aigarth anns list` / `retrieve` / `run`
- `aigarth tissues list` / `retrieve` / `run`
- `aigarth marketplace search` / `retrieve`
- `aigarth nodes reservations` / `reserve`
- `aigarth self version` / `self update`
- `aigarth schema` / `help`
- Distributed as `@aigarth/cli` on npm

### 8.2 Explicitly out of scope (deferred to Phase 26+)

- **Training submissions** (recipes, jobs, progress polling). Deferred until the training service has a stable streaming interface.
- **Compute job management** (submit / list / cancel). Deferred until we have a real use case from an agent.
- **Billing / invoices**. Deferred — agents don't pay bills; humans use the web UI.
- **Identity / org management** (create orgs, invite members, manage API keys). Defer; the web UI handles this today.
- **Dataset CRUD**. Defer.
- **Plugin system**. Defer.
- **Telemetry**. Out of scope by default; explicit `--telemetry` opt-in only.
- **Fish / zsh completions**. Defer to Phase 27 (polish).
- **Single-binary distribution** via Bun. Explicit deferral; revisit when the platform is more mature.
- **Real Qubic wallet signing** without a local seed. The CLI needs the seed; CI / agent runtimes without a seed use the API key only. Defer hardware-wallet support (Ledger / Trezor) to Phase 28+.

### 8.3 What blocks Phase 25

- The SDK has the methods we need (`ann.list`, `ann.retrieve`, `ann.run`, etc.). No SDK changes required.
- The identity service has the wallet-link flow (`prewarmQubic()` is in place per recent work).
- The Phase 24 `compute.nodeReservations` resource is in place.

No blockers. The phase is self-contained.

---

## 9. Acceptance criteria

- [ ] `npm install -g @aigarth/cli` installs a working `aigarth` binary on Linux, macOS, and Windows.
- [ ] `aigarth --version` prints the CLI version in JSON: `{"schema_version": "1.0.0", "command": "self.version", "data": {"version": "0.1.0"}}`.
- [ ] `aigarth --json` is the default in non-TTY environments; `aigarth --human` is the default in TTY.
- [ ] `aigarth auth login` reads an API key from `--api-key` (or a prompt), runs the wallet-link flow, persists `~/.config/aigarth/credentials.json` with mode `0600`.
- [ ] `aigarth whoami` returns the current user, org, wallet, and tier in the success envelope.
- [ ] `aigarth anns list --json` returns the ANNs list with `schema_version: "1.0.0"`.
- [ ] `aigarth anns run my-ann --input '{"x": 1}' --json` runs inference and returns the result.
- [ ] `aigarth tissues list` / `tissues run my-tissue --input '...'` work the same way.
- [ ] `aigarth marketplace search "fraud detection" --json` returns matching listings.
- [ ] `aigarth nodes reservations --json` returns the user's Phase 24 reservations.
- [ ] `aigarth schema anns.run` returns the JSON schema for that command's output.
- [ ] `aigarth help anns.run` returns JSON help: synopsis, flags, examples, exit codes, output schema ref.
- [ ] Exit codes map correctly: 0 ok, 1 user error, 2 server, 3 rate limit, 4 auth, 5 conflict.
- [ ] All mutating commands support `--dry-run` and `--idempotency-key`.
- [ ] HTTP wrapper retries on 429 with exponential backoff, max 3 retries.
- [ ] HTTP wrapper refreshes the bearer on 401 (re-runs wallet-link).
- [ ] HTTP wrapper emits `request.completed` progress events on stderr.
- [ ] No interactive prompts anywhere; missing input exits 1 with a clear error.
- [ ] Vitest coverage: ~30 cases across the dispatcher, http wrapper, output, errors, and one or two end-to-end command tests.
- [ ] Typecheck clean across `@aigarth/cli`, `@aigarth/sdk`.
- [ ] No em-dashes in CLI output (per AGENTS.md em-dash policy).

---

## 10. Open questions

1. **Self-update transport.** GitHub releases is the obvious choice. Pin to the latest stable tag, or pin to the major version (so a breaking change in 2.0 doesn't auto-update a 1.x CLI)? I'd default to "pin to the major version" with a `--self-update-channel` flag for `stable` / `beta` / `nightly`.
2. **Credentials encryption at rest.** Store the bearer in plain text (0600), or encrypt with a passphrase (like `git credential.helper`)? Plain text is the standard for API tokens; encryption adds friction without much benefit. Default: plain text 0600.
3. **Agent protocol for "I am an agent".** Should the CLI have a flag that says "I am an LLM agent acting on behalf of a user" so the server can rate-limit / log differently? Defer to Phase 28+ unless the user wants it now.
4. **Output size limits.** Some commands (large inference results, dataset exports) could blow up the envelope. Should the CLI write to a file and print a path? Default: truncate at 1MB and offer `--output <path>` for larger results. Worth a call.
5. **What about Windows?** `aigarth self update` on Windows is harder than Linux/macOS because the binary is locked while running. Need a "download to temp, rename on next invocation" dance. Defer Windows self-update to Phase 27 unless the user wants it now.

---

## 11. Why this is a good Phase 25

- The platform is at the point where external agents (and humans) need a non-web surface. The SDK exists; the CLI wraps it.
- The "agent-grade" framing is a real differentiator. No competitor ships a CLI with stable JSON output, exit-code taxonomy, and runtime schema introspection. Our CLI becomes the canonical way for an LLM agent to use Aigarth.
- The blast radius is small. The CLI is a new package; it doesn't touch any existing service. The SDK is the integration point.
- ~8 SP in one sprint, with the same cadence that worked for Phase 24. Foundation + discovery + 1 execution is a meaningful MVP that agents can already do real work with.

If you want to ship it, the next step is to start with 25.1 (CLI skeleton + config + auth). The design doc is the spec; the implementation is straightforward.

---

## 12. Files this phase creates or modifies

**Created:**
- `apps/cli/` (new package)
  - `package.json` (name: `@aigarth/cli`)
  - `src/bin/aigarth.ts` (entry point)
  - `src/commands/auth.ts`
  - `src/commands/whoami.ts`
  - `src/commands/anns.ts`
  - `src/commands/tissues.ts`
  - `src/commands/marketplace.ts`
  - `src/commands/nodes.ts`
  - `src/commands/self.ts`
  - `src/commands/schema.ts`
  - `src/commands/help.ts`
  - `src/lib/config.ts`
  - `src/lib/credentials.ts`
  - `src/lib/http.ts`
  - `src/lib/output.ts`
  - `src/lib/errors.ts`
  - `src/lib/schema.ts`
  - `src/lib/progress.ts`
  - `src/lib/signing.ts`
  - `tests/commands/` (one file per command)
  - `tests/lib/` (config, http, output, errors unit tests)
  - `vitest.config.ts`
  - `README.md`
- `docs/proposals/phase-25-cli.md` (this file)
- `docs/deliveries/phase-25-delivery.md`
- `apps/dashboard/scripts/register-phase-25.ts`
- `apps/dashboard/scripts/closeout-25.ts`

**Modified:**
- `pnpm-workspace.yaml` (add `apps/cli` to the workspace)
- `turbo.json` or root `package.json` (add the `cli` task)

No changes to any service. The CLI is purely additive.
