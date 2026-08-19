# Phase 28 — Aigarth Cloud Halving-Day Launch (aigarth.cloud)

**Status:** Plan ready, awaiting SSH go-ahead
**Target VPS:** Hostinger KVM (existing lucidmindlabs platform host, `187.124.35.93`)
**Target domain:** `aigarth.cloud` (primary public brand)
**Mirror/redirect:** `aigarthcloud.lucidmindlabs.com` → `aigarth.cloud` (301)
**Subdomains:** `app.`, `docs.`, `api.`, `www.` (wildcard `*.aigarth.cloud`)
**Deadline:** Aug 19, 2026 EOD (Qubic second halving)
**Date drafted:** 2026-08-18

> **This is the deploy runbook for the orchestrator.** It supersedes
> `phase-27-lucidmindlabs-deploy.md` for the actual execution path. The
> Phase 27 plan is kept for reference (bare-metal + PM2 pattern), but the
> user explicitly chose **Docker** for this deploy and the existing
> LML platform already runs Docker on the same VPS, so we ship a
> production `docker-compose.production.yml` alongside the existing
> `lucidmindlabs/platform` compose.

---

## TL;DR

1. User adds `*.aigarth.cloud` A record in hPanel DNS.
2. User pastes the VPS ED25519 host fingerprint so plink stops prompting.
3. We generate the production secrets, write `/opt/aigarth/.env.production` on the VPS.
4. We run `scripts/build-prod-images.ps1` on the Mac → tarball.
5. We run `scripts/ship-to-vps.ps1 -VpsFingerprint <fp>` → upload, load, compose up.
6. We run the smoke tests (12 services + 2 apps + 1 gateway + dashboard /services page).
7. We write the dashboard command-centre entry.

Estimated wall-clock: **3 to 5 hours** if no build issues, **6 to 8 hours** if we hit a workspace-package snag.

---

## 0. Pre-flight (verify, do not skip)

The existing LML platform is already on this VPS at
`/opt/lucidmindlabs/platform`. None of the Aigarth resources may conflict
with it.

- [ ] **DNS for the wildcard.** Add in hPanel:
  ```
  Type: A
  Name: *.aigarth.cloud
  Value: 187.124.35.93
  TTL: 300
  ```
  Verify with `dig +short app.aigarth.cloud` (must return `187.124.35.93` within 60s).
- [ ] **Namecheap mirror.** Add in Namecheap for `aigarthcloud.lucidmindlabs.com`:
  ```
  Type: A
  Host: aigarthcloud
  Value: 187.124.35.93
  TTL: Automatic
  ```
  We don't need to verify here — Caddy will handle the 301 regardless.
- [ ] **SSH access works on port 22** (not 2222 — Hostinger hPanel shows a misleading port). Verify with the user-provided host fingerprint:
  ```bash
  plink -ssh -P 22 -hostkey <FINGERPRINT> -pw <PW> root@187.124.35.93 'uname -a'
  ```
  This is the same call the `ship-to-vps.ps1` script will make.
- [ ] **No port conflicts on the Aigarth-published host ports.** Run on the VPS:
  ```bash
  ss -tlnp 2>/dev/null | grep -E ':(3003|4000|7004|5433|6380|4223|9002)\b' || echo "no conflict"
  ```
  We publish 3003, 4000, 7004 to the host loopback (Caddy uses them).
  Postgres/Redis/NATS/MinIO are internal-only (no host port) so they
  cannot conflict. (LML platform runs its own infra on its own internal
  network.)
- [ ] **Disk free ≥ 8 GB.** Aigarth tarball is ~2.5 GB; Postgres + MinIO
  growth will fill the rest. Run `df -h /`.
- [ ] **Memory free ≥ 2 GB** (LML platform already eats some).
  We cap each Aigarth service to 256–512 MB, web/dashboard to 512 MB,
  Postgres to 1 GB, MinIO to 512 MB. The LML platform and the host
  need the remaining ~3 GB.
- [ ] **/etc/caddy/Caddyfile exists** and uses the `import` pattern, OR
  we add the import line as part of this deploy.

---

## 1. Image inventory

The production compose runs 14 Aigarth images + 4 third-party (Postgres, Redis, NATS, MinIO) + 1 minio/mc init.

| Image | Source | Built by | Tag |
|---|---|---|---|
| `aigarth/identity` | Dockerfile.service | build-prod-images.ps1 | `latest` |
| `aigarth/qubic` | Dockerfile.service | " | `latest` |
| `aigarth/compute` | Dockerfile.service | " | `latest` |
| `aigarth/gateway` | Dockerfile.service | " | `latest` |
| `aigarth/billing` | Dockerfile.service | " | `latest` |
| `aigarth/ann` | Dockerfile.service | " | `latest` |
| `aigarth/marketplace` | Dockerfile.service | " | `latest` |
| `aigarth/tissue` | Dockerfile.service | " | `latest` |
| `aigarth/dataset` | Dockerfile.service | " | `latest` |
| `aigarth/economy` | Dockerfile.service | " | `latest` |
| `aigarth/training` | Dockerfile.service | " | `latest` |
| `aigarth/work` | Dockerfile.service | " | `latest` |
| `aigarth/web` | Dockerfile.app | " | `latest` |
| `aigarth/dashboard` | Dockerfile.app | " | `latest` |
| `aigarth/migrate` | Dockerfile.migrate | " | `latest` |
| `postgres:16-alpine` | Docker Hub | pulled at `up -d` | — |
| `redis:7-alpine` | Docker Hub | " | — |
| `nats:2.10-alpine` | Docker Hub | " | — |
| `minio/minio:latest` | Docker Hub | " | — |
| `minio/mc:latest` | Docker Hub | " | — |

---

## 2. Port allocation

| Port | Service | Notes |
|------|---------|-------|
| 80, 443 | Host Caddy | LML platform + Aigarth share the host Caddy. Aigarth is a Caddyfile snippet. |
| 3003 | aigarth-web | `127.0.0.1:3003:3003` published. |
| 4000 | aigarth-dashboard | `127.0.0.1:4000:4000` published. |
| 7004 | aigarth-gateway | `127.0.0.1:7004:7004` published. The host Caddy routes `/v1/*` here. |
| 7001-7012 | 12 services | Internal only; only `gateway:7004` is host-exposed. |
| 5432 | aigarth-postgres | Internal only. LML platform uses its own. |
| 6379 | aigarth-redis | Internal only. |
| 4222 | aigarth-nats | Internal only. |
| 9000 | aigarth-minio | Internal only. |
| 9001 | aigarth-minio console | Internal only. |

If `ss -tlnp` shows `3003`, `4000`, or `7004` already in use, shift the
Aigarth publish to `127.0.0.1:3033`, `127.0.0.1:4030`, `127.0.0.1:7044`
and update the Caddyfile snippet accordingly.

---

## 3. Source + build

All of this runs on the Mac (this Windows machine is fine — same Docker
Desktop engine, same `linux/amd64` target).

### 3.1. Pre-build checks

- [ ] `apps/web/next.config.mjs` and `apps/dashboard/next.config.mjs` have `output: "standalone"`. (Already done as of 2026-08-18.)
- [ ] `.dockerignore` is at the repo root. (Already done.)
- [ ] `Dockerfile.service`, `Dockerfile.app`, `Dockerfile.migrate` are at the repo root. (Already done.)
- [ ] `pnpm-lock.yaml` is committed and parses as valid JSON without a BOM:
  ```powershell
  $b = [System.IO.File]::ReadAllBytes('pnpm-lock.yaml')
  $b[0..2] | ForEach-Object { '{0:x2}' -f $_ } | Out-Host
  # expect: 7b 0a 20  (NOT ef bb bf)
  ```

### 3.2. Build

```powershell
.\scripts\build-prod-images.ps1
```

Expected time: **15-25 minutes** for a clean build (12 services + 2 apps + 1 migrate).
Tarball: `dist\aigarth-images-YYYYMMDD-HHMMSS.tar` (~2.5 GB).

---

## 4. Write the production env on the VPS

This step is **manual** because the secrets are sensitive. The
`infrastructure/env.production.example` is the template. The real file
goes at `/opt/aigarth/.env.production` with `chmod 600`.

```bash
# On the VPS, as root
mkdir -p /opt/aigarth
chmod 700 /opt/aigarth

# Generate the secrets
JWT_SECRET=$(openssl rand -hex 32)
INTERNAL_TOKEN=$(openssl rand -hex 32)
WORK_SIGNING_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)

# Write the file from the template, replacing placeholders
cat > /opt/aigarth/.env.production <<'EOF'
# (paste the template content; replace __GENERATE...__ placeholders
#  with the values above. Set POSTGRES_PASSWORD and MINIO_ROOT_PASSWORD
#  to the values above.)
EOF
chmod 600 /opt/aigarth/.env.production
```

---

## 5. Ship + deploy

### 5.1. Get the host fingerprint (one time)

Run on the VPS, paste the output back to the operator:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
# output: 256 SHA256:<base64> root@host (ED25519)
```

### 5.2. Run the ship script

```powershell
.\scripts\ship-to-vps.ps1 `
  -VpsFingerprint "SHA256:<base64>" `
  -VpsPassword '<PASSWORD>'
```

The script:
1. Pre-flights with `whoami`.
2. Uploads the tarball to `/opt/aigarth/`.
3. Uploads the compose file to `/opt/aigarth/infrastructure/`.
4. Uploads the Caddyfile snippet to `/etc/caddy/Caddyfile.d/aigarth.caddy`.
5. Verifies `/opt/aigarth/.env.production` exists.
6. Runs `docker load -i /opt/aigarth/<tarball>`.
7. Brings up infra (`postgres`, `redis`, `nats`, `minio`, `minio-init`).
8. Waits for infra healthy.
9. Runs `docker compose run --rm migrate`.
10. Brings up all 14 Aigarth services + 2 apps.
11. Reloads host Caddy.
12. Prints the final `docker compose ps` state.

If the host Caddyfile does not yet `import` the snippet directory, add:
```caddyfile
import /etc/caddy/Caddyfile.d/*.caddy
```
to the global scope of `/etc/caddy/Caddyfile`, then `systemctl reload caddy`.

---

## 6. Smoke tests

Run after the script reports done. The cert may take up to 60s to issue.

```powershell
$Domain = "https://aigarth.cloud"

# Public site (5 pages)
$paths = @("/", "/blog", "/blog/qubic-halving-epoch-227", "/roadmap", "/pricing")
foreach ($p in $paths) {
    $code = (Invoke-WebRequest -Uri "$Domain$p" -UseBasicParsing -SkipHttpErrorCheck).StatusCode
    Write-Host "  $p -> $code"
}

# Dashboard (5 pages)
$dpaths = @("/dashboard", "/phases", "/deliveries", "/docs", "/services")
foreach ($p in $dpaths) {
    $code = (Invoke-WebRequest -Uri "$Domain$p" -UseBasicParsing -SkipHttpErrorCheck).StatusCode
    Write-Host "  $p -> $code"
}

# Auth pages
foreach ($p in @("/login", "/signup")) {
    $code = (Invoke-WebRequest -Uri "$Domain$p" -UseBasicParsing -SkipHttpErrorCheck).StatusCode
    Write-Host "  $p -> $code"
}

# API gateway (1 endpoint)
$code = (Invoke-WebRequest -Uri "https://api.aigarth.cloud/healthz" -UseBasicParsing -SkipHttpErrorCheck).StatusCode
Write-Host "  /api.aigarth.cloud/healthz -> $code (expect 503; not yet wired)"

# Mirror redirect
$resp = Invoke-WebRequest -Uri "https://aigarthcloud.lucidmindlabs.com/" -UseBasicParsing -SkipHttpErrorCheck -MaximumRedirection 0
Write-Host "  aigarthcloud.lucidmindlabs.com -> $($resp.StatusCode) Location:$($resp.Headers.Location)"

# Service healthz (12) — via the gateway
foreach ($port in 7001..7012) {
    $url = "http://localhost:$port/healthz"
    # (run this on the VPS, not the Mac)
}

# TLS cert
$cert = [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$t = New-Object System.Net.WebClient
$t.DownloadString("https://aigarth.cloud/") | Out-Null
```

On the VPS, the dashboard `/services` page (https://aigarth.cloud/services) is
the canonical "all 18 targets" view. It must show green for all 12 services
+ 2 apps + 4 internal checks (postgres, redis, nats, minio) once the
dashboard backend pings them.

---

## 7. Rollback (if anything goes wrong)

The deploy is reversible. **The LML platform is never touched.**

1. Stop Aigarth containers:
   ```bash
   cd /opt/aigarth && docker compose -f infrastructure/docker-compose.production.yml down
   ```
2. Remove the Caddy snippet:
   ```bash
   rm /etc/caddy/Caddyfile.d/aigarth.caddy
   systemctl reload caddy
   ```
3. (Optional) Remove the Aigarth volumes:
   ```bash
   docker volume rm aigarth-cloud-prod_aigarth-pgdata \
                     aigarth-cloud-prod_aigarth-redisdata \
                     aigarth-cloud-prod_aigarth-natsdata \
                     aigarth-cloud-prod_aigarth-miniodata
   ```
4. (Optional) Remove the user files:
   ```bash
   rm -rf /opt/aigarth
   ```
5. Remove the hPanel DNS wildcard:
   ```
   Type: A
   Name: *.aigarth.cloud
   Action: Delete
   ```

The VPS is back to its pre-deploy state. The LML platform is untouched.

---

## 8. Completion report

Write to `docs/deliveries/phase-28-aigarth-cloud-halving-launch.md` using
the same template Phase 27 uses. Then register via the dashboard's
`register-phase-28-launch.ts` script (to be created as part of this
phase).

---

## 9. Open questions for the user (before execution)

1. **ED25519 host fingerprint** — paste the output of `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` so plink can be called non-interactively.
2. **Wildcard DNS** — add the `*.aigarth.cloud` A record in hPanel now.
3. **aigarthcloud.lucidmindlabs.com** — add the A record in Namecheap (the Caddy 301 will work as soon as it resolves).
4. **Disable password auth after deploy?** — recommend yes. Add `PasswordAuthentication no` to `/etc/ssh/sshd_config.d/00-no-passwords.conf` and `systemctl reload sshd`. Requires an SSH key already in `root`'s authorized_keys.

If any of these are not in place, the deploy will fail at the corresponding
gate. Confirm them, then say "go".
