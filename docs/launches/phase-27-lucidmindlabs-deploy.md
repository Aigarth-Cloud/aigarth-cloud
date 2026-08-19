# Phase 27 — Aigarth Cloud Deploy to lucidmindlabs Hostinger KVM2

**Status:** Plan ready, awaiting VPS access
**Target VPS:** Hostinger KVM2 (2 vCPU, 8 GB RAM, 100 GB SSD)
**Target domain:** `aigarth-cloud.lucidmindlabs.com`
**Date drafted:** 2026-08-16
**Author:** Aigarth Cloud (Wesley Gervais, founder; build-in-public series)

> **This document is the deployment runbook for the orchestrator.** Read it
> end-to-end before touching the VPS. Do not skip the pre-flight checks. The
> goal is a clean, reproducible, reversible deploy of the entire Aigarth Cloud
> stack (12 services + 2 apps) on a single VPS that already hosts other
> lucidmindlabs projects.

---

## TL;DR

1. Verify pre-flight (VPS access, DNS, disk, memory, port availability).
2. Provision a non-root `aigarth` user, install Node 20 + pnpm 9 + Caddy + Postgres + NATS + Redis + MinIO.
3. Clone the repo, install, build all 13 packages.
4. Run the per-service database migrations.
5. Start every process with PM2 (auto-restart, log to disk).
6. Wire Caddy as the reverse proxy + Let's Encrypt for `aigarth-cloud.lucidmindlabs.com`.
7. Smoke test the public site, the dashboard, and every service `/healthz`.
8. Write a completion report to the dashboard command centre (`/deliveries/...`).
9. Hand the report back to the user.

Estimated wall clock: **90 to 120 minutes** for a clean run.

---

## 0. Pre-flight (verify, do not skip)

The other lucidmindlabs services are already running on this VPS. None of the
Aigarth ports or DNS may conflict with them. Confirm all of these before
touching anything.

- [ ] **SSH access works**: `ssh root@<VPS_IP>` accepts the key you have on hand.
- [ ] **OS is Ubuntu 22.04 or 24.04 LTS**: `lsb_release -a` (Hostinger defaults to Ubuntu 22.04 LTS).
- [ ] **Disk free**: at least 10 GB available. Our payload is ~1.3 GB after install + build; we want headroom for Postgres growth, MinIO, and logs.
  ```bash
  df -h /
  ```
- [ ] **Memory free**: at least 2 GB available. We estimate 1.5-2 GB resident at idle for the Aigarth stack.
  ```bash
  free -h
  ```
- [ ] **Other lucidmindlabs services are not on these ports.** Run:
  ```bash
  sudo ss -tlnp 2>/dev/null | grep -E ':(80|443|3000|3001|3002|3003|3004|3005|4000|5432|6379|7001|7002|7003|7004|7005|7006|7007|7008|7009|7010|7011|7012|9000|4222)\b' || echo "no conflict"
  ```
  If any port is in use, document it in the completion report and pick an alternative (see §3 below).
- [ ] **DNS exists for the subdomain.** If not yet, add an A record:
  ```
  Type: A
  Name: aigarth-cloud
  Value: <VPS_IP>
  TTL: 300
  ```
  in the lucidmindlabs.com DNS zone. Verify:
  ```bash
  dig +short aigarth-cloud.lucidmindlabs.com
  ```
  Should return the VPS IP within 60 seconds of propagation.
- [ ] **Repo is accessible from the VPS.** Either via HTTPS (e.g. `git@github.com:wescosmic/aigarth-cloud.git`) or via a tarball upload. Confirm the SSH key has read access.

If any check fails, **stop**. Document the gap in the completion report. Do not
proceed with a broken baseline.

---

## 1. Port allocation (default; adjust if conflicts)

| Port | Service | Notes |
|------|---------|-------|
| 80, 443 | Caddy | Public ingress for the Aigarth subdomain. |
| 3003 | apps/web | Public marketing site + customer dashboard (Next.js). |
| 4000 | apps/dashboard | Project tracker (Next.js, used by the team). |
| 4222 | NATS | Service-to-service event bus. |
| 5432 | Postgres | All Aigarth services. |
| 6379 | Redis | Cache + rate limiter. |
| 7001 | services/identity | |
| 7002 | services/qubic | |
| 7003 | services/compute | |
| 7004 | services/gateway | |
| 7005 | services/billing | |
| 7006 | services/ann | |
| 7007 | services/marketplace | |
| 7008 | services/tissue | |
| 7009 | services/dataset | |
| 7010 | services/economy | |
| 7011 | services/training | |
| 7012 | services/work | |
| 9000 | MinIO | Object storage. NOT exposed publicly; only reachable from `localhost`. |

If the pre-flight `ss` output shows any of these in use, pick a different port
in the same range (e.g. `3003 → 3103`, `7012 → 7112`) and update the
`.env.production` file accordingly. Note the change in the completion
report.

---

## 2. Provisioning (system level)

Run all of this as `root` (or with `sudo`). The Aigarth processes themselves
will run as the `aigarth` user.

### 2.1. Create the `aigarth` user

```bash
sudo useradd -m -s /bin/bash aigarth
sudo mkdir -p /opt/aigarth /var/log/aigarth /var/lib/aigarth
sudo chown -R aigarth:aigarth /opt/aigarth /var/log/aigarth /var/lib/aigarth
```

### 2.2. Install Node 20 LTS + pnpm 9

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # must print v20.x or v22.x
sudo npm install -g pnpm@9
pnpm -v   # must print 9.x or 10.x
```

### 2.3. Install Caddy (reverse proxy + Let's Encrypt)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 2.4. Install Postgres, NATS, Redis, MinIO

Postgres:

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres createuser -s aigarth
sudo -u postgres createdb aigarth -O aigarth
sudo -u postgres psql -c "ALTER USER aigarth WITH PASSWORD 'CHANGE_ME_FOR_PROD';"
```

NATS (latest stable binary):

```bash
curl -sf https://binaries.nats.dev/nats-io/nats-server/v2@latest | sudo sh
sudo mv nats-server-*/nats-server /usr/local/bin/
sudo useradd -r nats -s /sbin/nologin
sudo tee /etc/systemd/system/nats.service > /dev/null <<'EOF'
[Unit]
Description=NATS Server
After=network.target
[Service]
User=nats
ExecStart=/usr/local/bin/nats-server -p 4222 -l /var/log/aigarth/nats.log
Restart=always
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable nats
sudo systemctl start nats
```

Redis:

```bash
sudo apt install -y redis-server
sudo sed -i 's/^supervised .*/supervised systemd/' /etc/redis/redis.conf
sudo systemctl enable redis-server
sudo systemctl restart redis-server
```

MinIO (object storage):

```bash
wget -q https://dl.min.io/server/minio/release/linux-amd64/minio -O /tmp/minio
sudo mv /tmp/minio /usr/local/bin/minio
sudo chmod +x /usr/local/bin/minio
sudo useradd -r minio-user -s /sbin/nologin
sudo mkdir -p /var/lib/minio /var/log/aigarth/minio
sudo chown -R minio-user:minio-user /var/lib/minio /var/log/aigarth/minio
sudo tee /etc/systemd/system/minio.service > /dev/null <<'EOF'
[Unit]
Description=MinIO
After=network.target
[Service]
User=minio-user
Environment="MINIO_ROOT_USER=aigarth"
Environment="MINIO_ROOT_PASSWORD=CHANGE_ME_FOR_PROD"
ExecStart=/usr/local/bin/minio server /var/lib/minio --address ":9000" --console-address ":9001"
Restart=always
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio
```

Generate a strong password for `MINIO_ROOT_PASSWORD` and store it in
`/opt/aigarth/.env.production` (see §5). Do not commit it to git.

### 2.5. Verify all four are up

```bash
sudo systemctl is-active postgresql nats redis-server minio
# expect: active active active active

sudo -u postgres psql -c "SELECT version();" aigarth
# expect: PostgreSQL 14.x or 15.x ...

curl -sf http://localhost:9000/minio/health/live && echo "minio ok"
```

---

## 3. Source + build

All of this runs as the `aigarth` user.

### 3.1. Clone the repo

```bash
sudo -u aigarth -H bash -lc 'cd /opt/aigarth && \
  git clone <REPO_URL> aigarth-cloud && \
  cd aigarth-cloud && \
  git checkout main'
```

`<REPO_URL>` is `git@github.com:wescosmic/aigarth-cloud.git` (or whatever
the user provides). Use the SSH key you have on hand.

### 3.2. Install dependencies

```bash
sudo -u aigarth -H bash -lc 'cd /opt/aigarth/aigarth-cloud && \
  pnpm install --frozen-lockfile=false'
```

Expected time: 3-5 minutes. Expect ~750 MB of `node_modules` to land.

### 3.3. Write the production env file

```bash
sudo -u aigarth -H bash -lc 'cd /opt/aigarth/aigarth-cloud && \
  cp .env.example .env.production'
```

Then **edit** `.env.production` and replace every placeholder with the
production values:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 32+ random chars. Generate: `openssl rand -hex 32` |
| `INTERNAL_TOKEN` | 32+ random chars. Generate: `openssl rand -hex 32` |
| `DATABASE_URL` | `postgres://aigarth:CHANGE_ME_FOR_PROD@localhost:5432/aigarth` |
| `ANN_SERVICE_URL` | `http://localhost:7006` |
| `BILLING_SERVICE_URL` | `http://localhost:7005` |
| `MARKETPLACE_SERVICE_URL` | `http://localhost:7007` |
| `WORK_SIGNING_KEY` | 32+ random chars. Generate: `openssl rand -hex 32` |
| `BILLING_INTERNAL_TOKEN` | same as `INTERNAL_TOKEN` |
| `MARKETPLACE_INTERNAL_TOKEN` | same as `INTERNAL_TOKEN` |
| `MINIO_ROOT_USER` | `aigarth` |
| `MINIO_ROOT_PASSWORD` | the password you set in §2.4 |
| `S3_ENDPOINT` | `http://localhost:9000` |
| `S3_BUCKET` | `aigarth-uploads` |
| `WORK_LEASE_DURATION_MS` | `30000` |
| `WORK_HEARTBEAT_INTERVAL_MS` | `5000` |
| `WORK_OFFLINE_AFTER_MS` | `30000` |
| `WORKER_DEFAULT_CONCURRENCY_CAP` | `2` |
| `WORKER_HARD_MAX_CONCURRENCY` | `5` |
| `REPUTATION_DECAY_MALICIOUS` | `0.1` |
| `REPUTATION_FLOOR` | `0.5` |
| `SCHEDULER_TICK_MS` | `5000` |
| `CHALLENGER_TICK_MS` | `60000` |
| `CHALLENGE_RATIO` | `0.01` |
| `CORS_ORIGINS` | `https://aigarth-cloud.lucidmindlabs.com` |

Lock down permissions: `chmod 600 .env.production`.

### 3.4. Build

```bash
sudo -u aigarth -H bash -lc 'cd /opt/aigarth/aigarth-cloud && \
  pnpm --filter @aigarth/web build && \
  pnpm --filter @aigarth/dashboard build && \
  pnpm -r --filter "./services/*" build'
```

Expected time: 4-8 minutes. The `apps/web` build is the slowest.

### 3.5. Database migrations

Each service has its own `pnpm db:migrate`. Run them in dependency order:

```bash
sudo -u aigarth -H bash -lc 'cd /opt/aigarth/aigarth-cloud && \
  for svc in identity ann tissue training billing marketplace dataset economy compute gateway qubic work; do \
    echo "--- migrating @aigarth/$svc ---"; \
    pnpm --filter @aigarth/$svc db:migrate 2>&1 || echo "FAILED: $svc"; \
  done'
```

If any service fails, stop. Read the migration error, fix or escalate.

---

## 4. Process management with PM2

PM2 is the simplest way to keep 12 services + 2 apps running with auto-restart,
log rotation, and start-at-boot.

### 4.1. Install PM2 globally

```bash
sudo npm install -g pm2
```

### 4.2. Create the ecosystem file

`/opt/aigarth/ecosystem.config.cjs` (owned by `aigarth`):

```js
// PM2 process manager for the Aigarth Cloud stack.
// Run: pm2 start /opt/aigarth/ecosystem.config.cjs
// Save: pm2 save (snapshots the running process list)
// Boot: pm2 startup (generates the systemd unit for start-at-boot)

const path = require("path");

const REPO = "/opt/aigarth/aigarth-cloud";
const LOG = "/var/log/aigarth";

const app = (script, name, port) => ({
  name,
  script: path.join(REPO, "services", name, "dist", "index.js"),
  cwd: path.join(REPO, "services", name),
  instances: 1, // single instance for low traffic; raise for hot services
  exec_mode: "fork",
  env_file: path.join(REPO, ".env.production"),
  env: { PORT: String(port) },
  out_file: path.join(LOG, `${name}.out.log`),
  error_file: path.join(LOG, `${name}.err.log`),
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  max_memory_restart: "300M",
  kill_timeout: 5000,
  wait_ready: false,
  autorestart: true,
});

module.exports = {
  apps: [
    // 12 services, ports 7001-7012
    app("identity", "identity", 7001),
    app("qubic", "qubic", 7002),
    app("compute", "compute", 7003),
    app("gateway", "gateway", 7004),
    app("billing", "billing", 7005),
    app("ann", "ann", 7006),
    app("marketplace", "marketplace", 7007),
    app("tissue", "tissue", 7008),
    app("dataset", "dataset", 7009),
    app("economy", "economy", 7010),
    app("training", "training", 7011),
    app("work", "work", 7012),
  ],
};
```

For the Next.js apps, add two more entries that use `next start` instead of
`node dist/index.js`. They get higher memory limits because Next.js
production builds are heavier than Fastify services:

```js
const nextApp = (name, port) => ({
  name,
  script: "node_modules/.bin/next",
  args: "start -p " + port,
  cwd: path.join(REPO, "apps", name),
  instances: 1,
  exec_mode: "fork",
  env_file: path.join(REPO, ".env.production"),
  env: { PORT: String(port), NODE_ENV: "production" },
  out_file: path.join(LOG, `${name}.out.log`),
  error_file: path.join(LOG, `${name}.err.log`),
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  max_memory_restart: "500M",
  kill_timeout: 10000,
  autorestart: true,
});

// add to the apps array:
nextApp("web", 3003),
nextApp("dashboard", 4000),
```

### 4.3. Start everything

```bash
sudo -u aigarth -H bash -lc 'pm2 start /opt/aigarth/ecosystem.config.cjs'
sudo -u aigarth -H bash -lc 'pm2 save'

# Start at boot (one-time):
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u aigarth --hp /home/aigarth
sudo systemctl enable pm2-aigarth
```

### 4.4. Verify

```bash
sudo -u aigarth -H bash -lc 'pm2 ls'
# expect: 14 rows, all "online"

curl -sf http://localhost:7001/healthz | head -c 200
curl -sf http://localhost:7012/healthz | head -c 200
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3003/
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:4000/
```

All five checks must return 200 (or valid JSON for the `/healthz` calls).

If a service is in `errored` or `stopped`, inspect the log:

```bash
sudo -u aigarth -H bash -lc 'pm2 logs <name> --lines 100 --nostream --raw'
```

---

## 5. Reverse proxy + TLS with Caddy

Caddy auto-issues Let's Encrypt certs and renews them. Zero config for
HTTPS.

### 5.1. Write the Caddyfile

`/etc/caddy/Caddyfile.d/aigarth-cloud.caddy`:

```
aigarth-cloud.lucidmindlabs.com {
    encode gzip zstd

    @marketing path / /blog* /roadmap /about /pricing /careers /contact /legal/*
    handle @marketing {
        reverse_proxy localhost:3003
    }

    @dashboard path /dashboard* /phases* /deliveries* /docs* /services* /api/services/*
    handle @dashboard {
        reverse_proxy localhost:4000
    }

    # All /v1/* and /v1/internal/* traffic goes to the gateway (services/gateway)
    @api path /v1/*
    handle @api {
        reverse_proxy localhost:7004
    }

    # Default: also reverse proxy to the marketing site (handles the rest
    # of the routes that don't match the rules above).
    handle {
        reverse_proxy localhost:3003
    }

    log {
        output file /var/log/aigarth/caddy.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
```

If the existing lucidmindlabs Caddyfile has a global site block, add this
file as an imported snippet:

```
# /etc/caddy/Caddyfile
import Caddyfile.d/*.caddy
```

Otherwise (Caddyfile is empty), just place the above block as the only site.

### 5.2. Reload Caddy

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
# expect: active (running)

sudo tail -f /var/log/aigarth/caddy.log
```

In another terminal:

```bash
curl -I https://aigarth-cloud.lucidmindlabs.com/
# expect: HTTP/2 200, server: Caddy, content-type: text/html
```

The first request triggers Let's Encrypt. Wait up to 60 seconds for the cert
to provision.

---

## 6. Smoke tests (full platform)

These must all return 200. Run them in order.

```bash
DOMAIN=https://aigarth-cloud.lucidmindlabs.com

# Public site (5 pages, 4 status codes)
echo "Public site smoke:"
for path in / /blog /blog/why-we-built-aigarth /roadmap /pricing; do
  code=$(curl -sk -o /dev/null -w '%{http_code}' "$DOMAIN$path")
  echo "  $path -> $code"
done

# Dashboard (5 pages)
echo "Dashboard smoke:"
for path in /dashboard /phases /deliveries /docs /services; do
  code=$(curl -sk -o /dev/null -w '%{http_code}' "$DOMAIN$path")
  echo "  $path -> $code"
done

# Service healthz (12 endpoints, served via the gateway at /v1/*)
echo "Service healthz:"
for port in 7001 7002 7003 7004 7005 7006 7007 7008 7009 7010 7011 7012; do
  out=$(curl -sf "http://localhost:$port/healthz" 2>&1)
  code=$?
  echo "  $port -> exit=$code body=$(echo $out | head -c 80)"
done

# Auth (signup form)
echo "Auth:"
code=$(curl -sk -o /dev/null -w '%{http_code}' "$DOMAIN/login")
echo "  /login -> $code"
code=$(curl -sk -o /dev/null -w '%{http_code}' "$DOMAIN/signup")
echo "  /signup -> $code"

# TLS
echo "TLS:"
echo | openssl s_client -servername aigarth-cloud.lucidmindlabs.com -connect aigarth-cloud.lucidmindlabs.com:443 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null
```

All status codes must be 200. If any is 4xx/5xx, check the corresponding
service's PM2 log.

---

## 7. Verification: build on the server, then test the suite

The platform's `pnpm test` runs against the in-memory test DB. It is safe
to run on the live server as a one-shot verification.

```bash
sudo -u aigarth -H bash -lc 'cd /opt/aigarth/aigarth-cloud && \
  pnpm -r --filter "./services/*" typecheck && \
  pnpm -r --filter "./services/*" test'
```

Expected: 600+ tests pass, all 12 services typecheck clean. Document the
result in the completion report.

If the test suite tries to connect to a real Postgres and fails, set
`INTEGRATION_DB_MODE=pg-mem` and re-run.

---

## 8. Rollback (if anything goes wrong)

The deploy is reversible. To roll back:

1. **Stop the Aigarth processes** (the rest of the lucidmindlabs stack is untouched):
   ```bash
   sudo -u aigarth -H bash -lc 'pm2 delete all'
   ```

2. **Tear down Caddy's Aigarth site block** (comment out the `import` line
   or remove `/etc/caddy/Caddyfile.d/aigarth-cloud.caddy`):
   ```bash
   sudo rm /etc/caddy/Caddyfile.d/aigarth-cloud.caddy
   sudo systemctl reload caddy
   ```

3. **Drop the Aigarth database** (does not touch the lucidmindlabs DB):
   ```bash
   sudo -u postgres dropdb aigarth
   sudo -u postgres dropuser aigarth
   ```

4. **Drop the Aigarth DNS record** (in the lucidmindlabs DNS zone):
   ```
   Type: A
   Name: aigarth-cloud
   Action: Delete
   ```

5. **Remove the Aigarth user + files** (only after the above is confirmed clean):
   ```bash
   sudo userdel -r aigarth
   sudo rm -rf /opt/aigarth /var/log/aigarth /var/lib/aigarth
   ```

The VPS is back to its pre-deploy state. The other lucidmindlabs services
were never touched.

---

## 9. Completion report template

Write the completion report to the dashboard command centre at
`/deliveries/phase-27-lucidmindlabs-deploy`. The report is a markdown file at
`docs/deliveries/phase-27-lucidmindlabs-deploy.md` (idempotent path; the
dashboard reads it via `getDoc`).

Use the structure below. The dashboard will surface it under
`/deliveries` automatically once it is registered with `upsertDoc`.

```md
# Phase 27 — Aigarth Cloud Deploy to lucidmindlabs

**Status:** <Live | Partial | Rolled back>
**Date:** <YYYY-MM-DD>
**Author:** Aigarth Cloud (deployment orchestrator)
**VPS:** Hostinger KVM2 (2 vCPU, 8 GB RAM, 100 GB SSD)
**Domain:** aigarth-cloud.lucidmindlabs.com
**Deploy runbook:** docs/launches/phase-27-lucidmindlabs-deploy.md

## TL;DR

<One paragraph: shipped clean / shipped with caveats / rolled back.>

## Environment

- **VPS host:** <hostname or IP>
- **OS:** <Ubuntu 22.04 LTS, kernel x.y.z>
- **Node:** <v20.x.x>
- **pnpm:** <v9.x.x>
- **Caddy:** <v2.x.x>
- **Postgres:** <v15.x>
- **NATS:** <v2.x.x>
- **Redis:** <v7.x.x>
- **MinIO:** <RELEASE.YYYY-MM-DDTHH-MM-SSZ>
- **Memory at idle:** <X.X GB / 8 GB>
- **Disk at idle:** <XX GB / 100 GB>

## What was deployed

- 12 services on ports 7001-7012
- 2 Next.js apps (apps/web on 3003, apps/dashboard on 4000)
- 4 backing services (Postgres, NATS, Redis, MinIO)
- 1 reverse proxy (Caddy) with auto-TLS via Let's Encrypt

## Port conflicts (if any)

<List the ports that were adjusted from the default. If none, say "no
conflicts; the default allocation was used.">

## DNS

- **A record:** aigarth-cloud.lucidmindlabs.com -> <VPS_IP>
- **Propagation verified:** <yes/no, with timestamp>

## Smoke tests

- Public site (5 pages): <all 200 / list of failures>
- Dashboard (5 pages): <all 200 / list of failures>
- Service /healthz (12): <all 200 / list of failures>
- /login: <200 / 4xx>
- /signup: <200 / 4xx>
- TLS cert: <valid / failed>

## Test suite

- `pnpm -r --filter "./services/*" typecheck`: <exit 0 / N errors>
- `pnpm -r --filter "./services/*" test`: <N tests passed, N skipped>

## Issues encountered

- <numbered list of any non-blocking issues, or "none">

## Rollback status

- <"Not needed" / "Executed, see commit X for details">

## Next steps

- <numbered list of follow-ups>
- <link to dashboard /phases>
- <link to dashboard /deliveries>
```

### How to register the completion report

Run the dashboard registration script (created as part of this deploy plan):

```bash
cd /opt/aigarth/aigarth-cloud
pnpm --filter @aigarth/dashboard tsx \
  src/scripts/register-phase-27-deploy-completion.ts
```

The script uses `upsertDoc` from `apps/dashboard/src/lib/repo.ts` and is
idempotent. It writes the completion report markdown to
`docs/deliveries/phase-27-lucidmindlabs-deploy.md` and registers it with the
dashboard at `/deliveries/phase-27-lucidmindlabs-deploy`.

---

## 10. Where the orchestrator (Mavis) hands off to the deployment agent

When the user says "deploy in another chat" or "execute the deploy
runbook", the new agent should:

1. **Read this file end-to-end.** No skipping.
2. **Read** `docs/proposals/aigarth-cloud-evolution-pep-v0.2.md` for the
   product context.
3. **Read** `apps/web/app/(marketing)/roadmap/page.tsx` to see what the user
   sees on the public site (so the smoke tests cover the right pages).
4. **Run §0 Pre-flight.** If anything fails, stop and write the partial
   completion report to the dashboard.
5. **Run §2 through §6 in order.** Each section's verification gate
   (curl, typecheck, etc.) must pass before moving on.
6. **Run §6 smoke tests** and document the actual status codes in the
   completion report.
7. **Run §7 verification suite** and document the test count.
8. **Write the completion report** to
   `docs/deliveries/phase-27-lucidmindlabs-deploy.md` using the template
   in §9.
9. **Run the registration script** to wire the report into the dashboard
   command centre.
10. **Hand the report back to the user** with a one-paragraph summary and
    the dashboard URL.

If anything between §2 and §7 fails irrecoverably, **roll back via §8** and
write a `Rolled back` completion report. Do not leave a half-deployed state.

The plan is explicit. The build is yours.
