# aigarth-node-chat

Minimal Express chat demo using [`@aigarth/sdk`](../../packages/sdk).

## Run

```bash
# 1. Make sure the local services are up:
#    pnpm dev (from the repo root, or run individual services)

# 2. Get an API key. Easiest: use the CLI:
pnpm --filter @aigarth/sdk cli login   # paste an existing ak_live_* key
# OR issue one via the gateway:
pnpm --filter @aigarth/sdk cli keys create "dev" --scopes chat:read,chat:write

# 3. Run the sample:
AIGARTH_API_KEY=ak_live_... \
  node --env-file=.env server.mjs     # Node 20+
# or:
AIGARTH_API_KEY=ak_live_... node server.mjs
```

Then open <http://localhost:8787>.

## Endpoints

| Method | Path                  | Body                                | Returns                                  |
| ------ | --------------------- | ----------------------------------- | ---------------------------------------- |
| GET    | `/`                   | —                                   | chat UI (HTML)                           |
| POST   | `/api/chat`           | `{ message, model? }`               | `{ reply, usage }`                       |
| POST   | `/api/chat/stream`    | `{ message, model? }`               | `text/event-stream` (SSE)                |
| GET    | `/api/whoami`         | —                                   | `{ id, email, name }`                    |

## What it shows

- One `Aigarth` client used to talk to two services (gateway + identity)
- A non-streaming chat call (`client.chat.create`)
- A streaming chat call (`client.chat.create({ stream: true })`)
- Auth-aware error handling (`AuthenticationError → 401`)
- A minimal SSE bridge from the SDK async iterable to a browser EventSource
