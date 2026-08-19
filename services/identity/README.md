# `@aigarth/identity`

Identity service. Phase 1 of the Aigarth roadmap.

Owns:

- **Users** — sign-up, email verification, password (Argon2id)
- **Sessions** — JWT access + refresh tokens, server-side session table for revocation
- **Organisations** — tenants (personal + team)
- **Memberships** — user ↔ org, with roles and custom scopes
- **Teams** — sub-groupings within an org
- **API keys** — long-lived programmatic keys (prefixed `ak_live_…`), scoped, rotatable, revocable
- **Qubic wallet linking** — signed-nonce verification (Qubic mainnet/testnet)
- **MFA** — TOTP and WebAuthn
- **Audit log** — append-only, every state-changing event

## Endpoints (Sprint 1)

| Method | Path                          | Auth   | Purpose                  |
| ------ | ----------------------------- | ------ | ------------------------ |
| GET    | `/healthz`                    | none   | Liveness                 |
| GET    | `/readyz`                     | none   | Readiness (DB reachable) |
| POST   | `/v1/auth/signup`             | none   | Create account           |
| POST   | `/v1/auth/login`              | none   | Issue session + JWT      |
| POST   | `/v1/auth/logout`             | none\* | Revoke session (by jti)  |
| POST   | `/v1/auth/verify-email`       | none   | Consume email token      |
| POST   | `/v1/auth/forgot-password`    | none   | Issue reset token        |
| POST   | `/v1/auth/reset-password`     | none   | Consume reset token      |
| GET    | `/v1/me`                      | bearer | Current user + orgs      |

\* `logout` only needs the `jti`; the JWT isn't verified.

## Endpoints (Sprint 2 — pending)

- `POST   /v1/orgs`                        — create org
- `GET    /v1/orgs/:orgId`                  — read org
- `POST   /v1/orgs/:orgId/members`          — invite/add member
- `PATCH  /v1/orgs/:orgId/members/:id`      — change role
- `DELETE /v1/orgs/:orgId/members/:id`      — remove
- `POST   /v1/orgs/:orgId/api-keys`         — create
- `POST   /v1/api-keys/:id/rotate`          — rotate
- `DELETE /v1/api-keys/:id`                 — revoke
- `POST   /v1/wallets/link/start`           — start wallet link
- `POST   /v1/wallets/link/finish`          — finish (verify signed nonce)
- `POST   /v1/mfa/totp/enroll`              — start TOTP enrollment
- `POST   /v1/mfa/totp/verify`              — complete TOTP enrollment
- `POST   /v1/mfa/webauthn/register/start`  — WebAuthn ceremony
- `POST   /v1/mfa/webauthn/register/finish` — WebAuthn ceremony
- `GET    /v1/audit-logs`                   — read org audit log

## Local development

```sh
# 1. Bring up Postgres
pnpm stack:up

# 2. Set up environment
cp ../../.env.example .env  # or create from scratch

# 3. Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste into JWT_SECRET in .env

# 4. Apply migrations (creates the schema in Postgres)
pnpm db:generate  # generates SQL files from schema.ts
pnpm db:migrate   # applies them

# 5. Seed an admin user
ADMIN_EMAIL=admin@aigarth.local ADMIN_PASSWORD=changeme pnpm db:seed

# 6. Start the service
pnpm dev  # port 7001
```

## Quick test

```sh
# Signup
curl -X POST http://localhost:7001/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correct-horse-battery-staple","name":"Alice"}'

# Login
curl -X POST http://localhost:7001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correct-horse-battery-staple"}'

# /me
curl http://localhost:7001/v1/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Architecture notes

- **Argon2id** for passwords (OWASP recommended). Parameters from env so
  we can rotate cost without a code change.
- **JWTs are short-lived (15m).** Refresh tokens are also JWTs but
  scoped to a server-side `sessions` row so we can revoke immediately
  (logout, password reset, admin action).
- **Audit log is append-only.** No `UPDATE` or `DELETE` in the
  application code.
- **Case-insensitive email uniqueness** via a `lower(email)` unique index.
- **Personal org on signup** so every user has a default billing /
  ownership context immediately.
- **Token storage**: verification and reset tokens are stored as
  `sha256(token)`. The plaintext is only in the email.

## Phase 1 exit criteria

A user can sign up, create an org, add members, issue an API key, and
call a placeholder `/v1/me` endpoint.

Sprint 1 (this) gets us through signup, login, `/me`.
Sprint 2 adds orgs, members, API keys, wallet linking, MFA, audit-log writes.
