# Third-party ANN registration

This is the canonical guide for a third party (a human or another
agent) to create, register, version, publish, and call an ANN on
Aigarth Cloud.

The path used to be a dead end: signup worked, the JWT was real,
but every ANN route on `api.aigarth.cloud` returned 404 because
the public gateway only exposed its own OpenAI-compatible surface.
A reverse proxy at the gateway (Phase 28+) now forwards the ANN
service's public surface to the public internet, and the dashboard
ships a working Create-ANN form at `/dashboard/models/new`.

Two paths to the same end:

1. **Self-serve UI** — sign up on
   `https://aigarth.cloud/signup`, hit `/dashboard/models/new`,
   fill the form, land on the public detail page.
2. **Scripted** — call the public API directly. The example below
   does it with `curl`.

## End-to-end example (curl)

```bash
# 1) Create an account. The site sets a session cookie + returns
#    a JWT in the Set-Cookie header. The same JWT is the Bearer
#    token for the API. Allow ~60s on first hit (cold start).
curl -i -c /tmp/aigarth.cookies \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","name":"Your Name","password":"a-strong-password"}' \
  https://aigarth.cloud/api/auth/signup

# 2) Pull the JWT out of the cookie jar.
TOKEN=$(awk '/aigarth_session/ {print $7}' /tmp/aigarth.cookies | python -c '
import sys, urllib.parse, json
raw = sys.stdin.read().strip()
# The cookie value is URL-encoded JSON {"accessToken":"…"}
data = json.loads(urllib.parse.unquote(raw))
print(data["accessToken"])
')

# 3) Browse catalog metadata.
curl -H "authorization: Bearer $TOKEN" \
  https://api.aigarth.cloud/v1/categories
curl -H "authorization: Bearer $TOKEN" \
  https://api.aigarth.cloud/v1/licenses

# 4) Create a draft ANN.
curl -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "name": "Kismet",
    "tagline": "Evolutionary cross-domain correspondence finder",
    "description": "Discovers latent correspondences between mathematical representations.",
    "category": "research",
    "license": "open",
    "visibility": "public"
  }' \
  https://api.aigarth.cloud/v1/anns

# Capture the returned id and slug from the response.
ANN_ID=...
ANN_SLUG=...

# 5) Add version 1.0.0. publishAnn refuses to flip status without
#    ≥1 version, so this step is required.
curl -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"version":"1.0.0","changelog":"Initial draft."}' \
  "https://api.aigarth.cloud/v1/anns/$ANN_ID/versions"

# 6) Publish.
curl -H "authorization: Bearer $TOKEN" \
  -X POST \
  "https://api.aigarth.cloud/v1/anns/$ANN_ID/publish"

# 7) Confirm the public detail page reads the same data.
curl "https://api.aigarth.cloud/v1/anns/$ANN_SLUG"
# Or open https://aigarth.cloud/anns/$ANN_SLUG in a browser.
```

## What's exposed publicly

The proxy at the gateway forwards these prefixes to
`services/ann` (port 7006):

| Prefix             | Auth at ANN service | Notes                                                  |
|--------------------|---------------------|--------------------------------------------------------|
| `/v1/anns`         | Mixed (public GET, JWT for writes) | Full CRUD + execute + decide + benchmark + ratings |
| `/v1/categories`   | Public              | ANN categories                                         |
| `/v1/licenses`     | Public              | License types                                          |
| `/v1/me/*`         | JWT                 | "My ANNs", "My licenses", "My deployments"             |
| `/v1/organisms*`   | Mixed               | Phase 26 Organism primitive (read public, write auth)  |

Not proxied (must use the gateway's own surface):

| Surface                       | Why                                              |
|-------------------------------|--------------------------------------------------|
| `/v1/chat/completions`        | Gateway-owned (OpenAI-shaped + trinary framing)  |
| `/v1/models`, `/v1/keys`, `/v1/usage` | Gateway-owned state                      |
| `/v1/embeddings`, `/v1/images/*`     | Gateway-owned stubs                      |
| `/v1/internal/*`              | Internal-token only; never leak publicly          |

The proxy strips hop-by-hop headers, forwards
`authorization`/`cookie`/`idempotency-key`/`content-type`/
`accept-*`/`user-agent`/`x-forwarded-*`, and copies back
`content-type`/`cache-control`/`etag`/`location`/`retry-after`/
`x-ratelimit-*`/`idempotent-replay`/`vary`. See
`services/gateway/src/routes/ann-proxy.ts`.

## Limits

- 30 writes per minute per JWT (`X-RateLimit-*` headers surface
  the remaining budget). Reads are not limited.
- 2 MB request body. The ANN service caps at the same size.
- The gateway buffers the body — no streaming. Trinary
  streaming stays on the chat route.
- `ANN_SERVICE_URL` env var on the gateway must point at the
  internal ANN service URL (`http://ann:7006` in the docker
  compose, `http://localhost:7006` in `pnpm dev`).

## A "working" ANN needs more than the API

The public API lets a third party create, version, publish, and
call any registered ANN. To actually execute a custom
architecture, the ANN must also have an `ann_repositories` row
with a `manifest_hash` that matches an adapter in the
`registry.ts` list on the ANN service. The shipped
`btc-direction-predictor` adapter is the default and works for
any ANN registered through the SDK; a brand-new architecture
needs a server-side adapter registration.

See `services/ann/src/services/execution/adapters/registry.ts`
for the adapter list and
`services/ann/src/db/seed-btc-direction-predictor.ts` for the
end-to-end shape (manifest row + repository + published version).

## Verification (after deploy)

```bash
# Healthz first — the gateway should be up.
curl -i https://api.aigarth.cloud/healthz

# Categories should now return a list, not 404.
curl -i https://api.aigarth.cloud/v1/categories
```

If `/v1/categories` still 404s after a deploy, the proxy
module isn't loaded — check the gateway container logs for
`ann-proxy` registration and that `ANN_SERVICE_URL` is set.

## Ship to VPS

This is the deploy step:

```powershell
.\scripts\build-prod-images.ps1 -Only gateway,web
.\scripts\ship-to-vps.ps1
```

`build-prod-images.ps1` rebuilds the gateway image (which now
contains the `ann-proxy.js` dist) and the web image (which
contains the new `/api/anns`, `/api/categories`, `/api/licenses`,
and `/dashboard/models/new` routes). `ship-to-vps.ps1` then
ships the tarball to `187.124.35.93` and brings the stack back
up. The proxy is live the moment the new gateway container
passes its healthcheck.
