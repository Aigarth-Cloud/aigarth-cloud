#!/usr/bin/env node
/**
 * aigarth CLI
 *
 * Usage:
 *   aigarth login                          # interactive login
 *   aigarth whoami                         # current user
 *   aigarth chat "hello"                   # one-shot chat
 *   aigarth chat                           # REPL
 *   aigarth keys list
 *   aigarth keys create "ci-key" --scopes chat:write
 *   aigarth anns list
 *   aigarth anns deploy <slug> --region <id> --cluster <id>
 *   aigarth usage
 *   aigarth init                           # scaffold .aigarth/ + .env
 *   aigarth --help
 *
 * Credentials are stored at ~/.config/aigarth/credentials.json.
 * API keys are read from AIGARTH_API_KEY env var or the credentials file.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL, fileURLToPath } from "node:url";

// Resolve the SDK package root from this script's location, regardless of
// how the CLI was invoked (direct node, pnpm symlink, npx, etc.).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SDK_ROOT = path.resolve(__dirname, "..");

// Dynamic import the SDK's ESM dist. We can't use createRequire here
// because the dist has no .js extensions (intentional, for Next.js
// compatibility — see scripts/strip-js-extensions.mjs). Dynamic
// import + file:// URL works in Node 14+.
const sdkUrl = pathToFileURL(path.join(SDK_ROOT, "dist", "index.js")).href;
const { Aigarth } = await import(sdkUrl);

// ----- ANSI -----
const isTty = process.stdout.isTTY;
const c = (code, s) => (isTty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c("1", s);
const dim = (s) => c("2", s);
const green = (s) => c("32", s);
const red = (s) => c("31", s);
const yellow = (s) => c("33", s);
const cyan = (s) => c("36", s);

// ----- Args -----
const argv = process.argv.slice(2);
const command = argv[0];
const rest = argv.slice(1);

function getFlag(name) {
  const i = rest.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return rest[i + 1];
}
function hasFlag(name) {
  return rest.includes(`--${name}`);
}
function positional() {
  return rest.filter((a) => !a.startsWith("--"));
}

// ----- Config -----
const CONFIG_DIR = path.join(
  process.env.AIGARTH_CONFIG_DIR ?? path.join(os.homedir(), ".config", "aigarth"),
);
const CREDS_FILE = path.join(CONFIG_DIR, "credentials.json");

function loadCreds() {
  if (process.env.AIGARTH_API_KEY) {
    return { apiKey: process.env.AIGARTH_API_KEY, services: {}, jwt: process.env.AIGARTH_JWT ?? null };
  }
  if (!fs.existsSync(CREDS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCreds(creds) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
  console.log(green(`✓ Saved credentials to ${CREDS_FILE}`));
}

function client() {
  const creds = loadCreds();
  if (!creds?.apiKey) {
    console.error(red("✗ Not logged in. Run `aigarth login` or set AIGARTH_API_KEY."));
    process.exit(1);
  }
  return new Aigarth({
    apiKey: creds.apiKey,
    services: creds.services,
  });
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

// ----- Help -----

const HELP = `
${bold("aigarth")} — Aigarth Cloud developer CLI

${bold("Usage:")}
  aigarth <command> [options]

${bold("Commands:")}
  ${cyan("login")}                       Save an API key (interactive)
  ${cyan("whoami")}                      Show the current user
  ${cyan("chat")} [message...]           One-shot chat or REPL (no args)
  ${cyan("keys list")}                   List your gateway API keys
  ${cyan("keys create <name>")}          Create a new key (prints full key ONCE)
  ${cyan("keys revoke <id>")}            Revoke a key
  ${cyan("anns list")}                   List ANNs
  ${cyan("anns deploy <slug>")}          Deploy an ANN to a region/cluster
  ${cyan("usage")}                       Show your usage
  ${cyan("init")}                        Scaffold a .env + .aigarth/ project file
  ${cyan("help")}                        Show this help

${bold("Options:")}
  --scopes chat:write,embeddings:read   Scopes for \`keys create\`
  --region <id>                        Region for \`anns deploy\`
  --cluster <id>                       Cluster for \`anns deploy\`
  --model <name>                       Model for \`chat\` (default: aigarth-meridian-1)
  --since YYYY-MM-DD                   Start date for \`usage\`
  --until YYYY-MM-DD                   End date for \`usage\`
  --json                               Output raw JSON instead of pretty

${bold("Environment:")}
  AIGARTH_API_KEY                      Gateway API key
  AIGARTH_JWT                          Identity service JWT
  AIGARTH_CONFIG_DIR                   Override config dir (default ~/.config/aigarth)
`;

// ----- Commands -----

async function cmdLogin() {
  console.log(bold("\n  Aigarth login\n"));
  console.log(dim("  Paste a gateway API key, or press enter to log in with email + password.\n"));

  const choice = await prompt("  (1) API key, (2) Email/password [1/2]: ");
  let apiKey, jwt, services = {};
  if (choice.trim() === "2") {
    const email = await prompt("  email: ");
    const password = await prompt("  password: ");
    const identityURL = process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001";
    const res = await fetch(`${identityURL}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(red(`✗ Login failed: ${res.status} ${body}`));
      process.exit(1);
    }
    const data = await res.json();
    jwt = data.access_token;
    console.log(green(`✓ Logged in as ${data.user.email}`));
    apiKey = jwt; // use JWT for everything by default
  } else {
    apiKey = (await prompt("  API key: ")).trim();
    if (!apiKey) {
      console.error(red("✗ API key required."));
      process.exit(1);
    }
  }

  // Save
  saveCreds({ apiKey, jwt, services });
}

async function cmdWhoami() {
  const c = client();
  try {
    const me = await c.identity.whoami();
    if (hasFlag("json")) {
      console.log(JSON.stringify(me, null, 2));
      return;
    }
    console.log(bold(`\n  ${me.name}`) + dim(`  <${me.email}>`));
    console.log(`  ${dim("id:")} ${me.id}`);
    if (me.is_admin) console.log(yellow("  admin"));
    if (me.email_verified_at) console.log(green("  ✓ email verified"));
    else console.log(yellow("  ⚠ email not verified"));
    console.log(`  ${dim("created:")} ${me.created_at}\n`);
  } catch (err) {
    console.error(red(`✗ ${err.message}`));
    process.exit(1);
  }
}

async function cmdChat() {
  const c = client();
  const model = getFlag("model") ?? "aigarth-meridian-1";
  const promptMsg = positional().join(" ");

  if (!promptMsg) {
    // REPL
    console.log(bold(`\n  Aigarth chat — ${dim(model)}\n  type 'exit' to quit\n`));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const messages = [];
    const ask = () =>
      new Promise((resolve) =>
        rl.question(cyan("  > "), async (line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "exit") { resolve(null); return; }
          messages.push({ role: "user", content: trimmed });
          try {
            const stream = await c.chat.create({
              model,
              messages,
              stream: true,
            });
            process.stdout.write("\n  ");
            let full = "";
            for await (const chunk of stream) {
              const delta = chunk.choices?.[0]?.delta?.content ?? "";
              if (delta) { process.stdout.write(delta); full += delta; }
            }
            process.stdout.write("\n\n");
            messages.push({ role: "assistant", content: full });
            ask();
          } catch (err) {
            console.error(red(`\n  ✗ ${err.message}\n`));
            ask();
          }
        }),
      );
    await ask();
    rl.close();
    return;
  }

  // One-shot
  try {
    const completion = await c.chat.create({
      model,
      messages: [{ role: "user", content: promptMsg }],
    });
    if (hasFlag("json")) {
      console.log(JSON.stringify(completion, null, 2));
    } else {
      console.log(completion.choices[0]?.message?.content ?? "");
    }
  } catch (err) {
    console.error(red(`✗ ${err.message}`));
    process.exit(1);
  }
}

async function cmdKeys(sub) {
  const c = client();
  try {
    if (sub === "list" || !sub) {
      const { data } = await c.keys.list();
      if (hasFlag("json")) return console.log(JSON.stringify(data, null, 2));
      console.log(bold(`\n  ${data.length} key(s)\n`));
      for (const k of data) {
        const status = k.status === "active" ? green("active") : yellow(k.status);
        console.log(`  ${bold(k.name)} ${dim(`(${k.id})`)} ${status}`);
        console.log(`    ${dim("prefix:")} ${k.prefix}…${k.secret_last4}  ${dim("scopes:")} ${k.scopes.join(", ")}`);
      }
      console.log("");
    } else if (sub === "create") {
      const name = positional()[1];
      if (!name) { console.error(red("✗ usage: aigarth keys create <name> --scopes chat:write")); process.exit(1); }
      const scopes = (getFlag("scopes") ?? "chat:read,chat:write").split(",").map((s) => s.trim());
      const result = await c.keys.create({ name, scopes });
      if (hasFlag("json")) return console.log(JSON.stringify(result, null, 2));
      console.log(green(`\n  ✓ Key created`));
      console.log(yellow(`\n  full key (save this — it will not be shown again):\n`));
      console.log(`    ${bold(result.full_key)}\n`);
    } else if (sub === "revoke") {
      const id = positional()[1];
      if (!id) { console.error(red("✗ usage: aigarth keys revoke <id>")); process.exit(1); }
      await c.keys.revoke(id);
      console.log(green(`✓ Revoked ${id}`));
    } else {
      console.error(red(`✗ unknown keys subcommand: ${sub}`));
      process.exit(1);
    }
  } catch (err) {
    console.error(red(`✗ ${err.message}`));
    process.exit(1);
  }
}

async function cmdAnns(sub) {
  const c = client();
  try {
    if (sub === "list" || !sub) {
      const res = await c.anns.list({ limit: 20 });
      if (hasFlag("json")) return console.log(JSON.stringify(res, null, 2));
      console.log(bold(`\n  ${res.data.length} ANN(s)\n`));
      for (const a of res.data) {
        console.log(`  ${bold(a.name)} ${dim(`(${a.slug ?? a.id})`)}`);
        console.log(`    ${dim("category:")} ${a.category}  ${dim("license:")} ${a.license}  ${dim("rating:")} ${a.rating_average ?? "—"}/5`);
      }
      console.log("");
    } else if (sub === "deploy") {
      const slug = positional()[1];
      if (!slug) { console.error(red("✗ usage: aigarth anns deploy <slug> --region <id> --cluster <id>")); process.exit(1); }
      const region = getFlag("region");
      const cluster = getFlag("cluster");
      if (!region || !cluster) { console.error(red("✗ --region and --cluster required")); process.exit(1); }
      const result = await c.anns.deploy(slug, { regionId: region, clusterId: cluster });
      if (hasFlag("json")) return console.log(JSON.stringify(result, null, 2));
      console.log(green(`✓ Deploy queued: ${result.job_id} (${result.status})`));
      console.log(dim(`  estimated cost: ${result.estimated_cost_qubic} Qu`));
    } else {
      console.error(red(`✗ unknown anns subcommand: ${sub}`));
      process.exit(1);
    }
  } catch (err) {
    console.error(red(`✗ ${err.message}`));
    process.exit(1);
  }
}

async function cmdUsage() {
  const c = client();
  try {
    const params = {};
    if (getFlag("since")) params.start_date = getFlag("since");
    if (getFlag("until")) params.end_date = getFlag("until");
    const data = await c.usage.list(params);
    if (hasFlag("json")) return console.log(JSON.stringify(data, null, 2));
    console.log(bold("\n  Usage\n"));
    console.log(`  ${dim("requests:")}     ${data.total_requests}`);
    console.log(`  ${dim("tokens:")}       ${data.total_tokens}  ${dim(`(${data.prompt_tokens} prompt + ${data.completion_tokens} completion)`)}`);
    console.log(`  ${dim("cost:")}         ${data.total_cost_qubic} Qu`);
    console.log("");
  } catch (err) {
    console.error(red(`✗ ${err.message}`));
    process.exit(1);
  }
}

async function cmdInit() {
  console.log(bold("\n  Aigarth init\n"));
  fs.mkdirSync(".aigarth", { recursive: true });
  const envFile = ".env.aigarth.example";
  if (!fs.existsSync(envFile)) {
    fs.writeFileSync(
      envFile,
      [
        "# Aigarth Cloud — example env",
        "# Copy to .env and fill in.",
        "",
        "AIGARTH_API_KEY=",
        "AIGARTH_JWT=",
        "",
        "# Per-service URLs (override defaults)",
        "# AIGARTH_IDENTITY_URL=http://localhost:7001",
        "# AIGARTH_QUBIC_URL=http://localhost:7002",
        "# AIGARTH_COMPUTE_URL=http://localhost:7003",
        "# AIGARTH_GATEWAY_URL=http://localhost:7004",
        "# AIGARTH_BILLING_URL=http://localhost:7005",
        "# AIGARTH_ANN_URL=http://localhost:7006",
        "# AIGARTH_MARKETPLACE_URL=http://localhost:7007",
        "",
      ].join("\n"),
    );
    console.log(green(`✓ Wrote ${envFile}`));
  }
  fs.writeFileSync(
    ".aigarth/config.json",
    JSON.stringify(
      {
        version: 1,
        services: {
          identity: "http://localhost:7001",
          qubic: "http://localhost:7002",
          compute: "http://localhost:7003",
          gateway: "http://localhost:7004",
          billing: "http://localhost:7005",
          ann: "http://localhost:7006",
          marketplace: "http://localhost:7007",
        },
      },
      null,
      2,
    ),
  );
  console.log(green(`✓ Wrote .aigarth/config.json`));
  console.log(dim(`\n  Next: \`aigarth login\` to save an API key.\n`));
}

// ----- Router -----

const sub = rest[0];
try {
  switch (command) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      console.log(HELP);
      break;
    case "login":
      await cmdLogin();
      break;
    case "whoami":
      await cmdWhoami();
      break;
    case "chat":
      await cmdChat();
      break;
    case "keys":
      await cmdKeys(sub);
      break;
    case "anns":
      await cmdAnns(sub);
      break;
    case "usage":
      await cmdUsage();
      break;
    case "init":
      await cmdInit();
      break;
    case "version":
    case "--version":
    case "-v":
      console.log("aigarth 0.2.0");
      break;
    default:
      console.error(red(`✗ unknown command: ${command}`));
      console.log(HELP);
      process.exit(1);
  }
} catch (err) {
  console.error(red(`\n✗ ${err?.message ?? err}`));
  process.exit(1);
}
