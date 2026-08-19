/**
 * Minimal Express chat demo using @aigarth/sdk.
 *
 * Run:
 *   AIGARTH_API_KEY=... node server.mjs
 *
 * Or set in .env and use `node --env-file=.env server.mjs` (Node 20+).
 *
 * Endpoints:
 *   GET  /                  → chat UI (HTML)
 *   POST /api/chat          → { message, model? } → { reply, usage }
 *   POST /api/chat/stream   → Server-Sent Events stream
 *   GET  /api/whoami        → { id, email, name } | 401
 *
 * Note on imports: per AGENTS.md, we import the SDK via the
 * relative dist path with explicit `.js` extensions. The
 * `@aigarth/sdk` alias resolves to the same dist files but
 * with `.js` extensions stripped (so Next.js can bundle them),
 * which breaks plain Node ESM consumers. The relative path
 * bypasses the alias and lets Node resolve the `.js` files.
 */

import express from "express";
import { Aigarth, AuthenticationError } from "../../packages/sdk/dist/index.js";

const PORT = Number(process.env.PORT ?? 8787);

const client = new Aigarth({
  // Defaults are fine for local dev. Override via env if needed.
  apiKey: process.env.AIGARTH_API_KEY ?? "demo-key",
  services: {
    gateway: process.env.AIGARTH_GATEWAY_URL ?? "http://localhost:7004",
    identity: process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001",
  },
});

const app = express();
app.use(express.json());

// ---------- UI ----------

app.get("/", (_req, res) => {
  res.type("html").send(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Aigarth chat — sample</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root { color-scheme: light dark; --fg: #111; --bg: #fff; --accent: #2e7d32; }
      @media (prefers-color-scheme: dark) { :root { --fg: #fef8e8; --bg: #0d121c; --accent: #25cad9; } }
      body { font: 16px/1.5 -apple-system, system-ui, sans-serif; color: var(--fg); background: var(--bg); margin: 0; }
      main { max-width: 640px; margin: 0 auto; padding: 2rem 1.25rem; }
      h1 { font-weight: 600; letter-spacing: -0.02em; }
      #log { display: flex; flex-direction: column; gap: 0.75rem; margin: 1.5rem 0; min-height: 200px; }
      .msg { padding: 0.75rem 1rem; border-radius: 12px; max-width: 80%; }
      .user { background: var(--accent); color: #fff; align-self: flex-end; }
      .assistant { background: rgba(127,127,127,0.1); align-self: flex-start; }
      form { display: flex; gap: 0.5rem; }
      input { flex: 1; padding: 0.75rem 1rem; border-radius: 999px; border: 1px solid rgba(127,127,127,0.3); background: transparent; color: inherit; font: inherit; }
      button { padding: 0.75rem 1.25rem; border-radius: 999px; border: 0; background: var(--accent); color: #fff; font: inherit; cursor: pointer; }
      small { opacity: 0.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>Aigarth chat</h1>
      <p><small>Streaming via <code>@aigarth/sdk</code> → <code>client.chat.create({ stream: true })</code></small></p>
      <div id="log"></div>
      <form id="form">
        <input id="input" placeholder="Ask anything…" autocomplete="off" autofocus>
        <button>Send</button>
      </form>
    </main>
    <script>
      const log = document.getElementById('log');
      const form = document.getElementById('form');
      const input = document.getElementById('input');

      function append(role, text) {
        const div = document.createElement('div');
        div.className = 'msg ' + role;
        div.textContent = text;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
        return div;
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        append('user', text);
        const assistantEl = append('assistant', '');
        try {
          const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message: text }),
          });
          if (!res.ok) {
            assistantEl.textContent = 'Error: ' + (await res.text());
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\\n\\n')) !== -1) {
              const raw = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              for (const line of raw.split('\\n')) {
                if (line.startsWith('data:')) {
                  const data = line.slice(5).trim();
                  if (data === '[DONE]') return;
                  try {
                    const { delta } = JSON.parse(data);
                    if (delta) assistantEl.textContent += delta;
                  } catch { /* ignore */ }
                }
              }
            }
          }
        } catch (err) {
          assistantEl.textContent = 'Error: ' + err.message;
        }
      });
    </script>
  </body>
</html>
  `);
});

// ---------- API ----------

app.post("/api/chat", async (req, res) => {
  const { message, model } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message required" });
  }
  try {
    const completion = await client.chat.create({
      model: model ?? "aigarth-meridian-1",
      messages: [{ role: "user", content: message }],
    });
    return res.json({
      reply: completion.choices[0]?.message?.content ?? "",
      usage: completion.usage,
    });
  } catch (err) {
    return mapError(res, err);
  }
});

app.post("/api/chat/stream", async (req, res) => {
  const { message, model } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message required" });
  }
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const stream = await client.chat.create({
      model: model ?? "aigarth-meridian-1",
      messages: [{ role: "user", content: message }],
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.get("/api/whoami", async (_req, res) => {
  try {
    const me = await client.identity.whoami();
    res.json({ id: me.id, email: me.email, name: me.name });
  } catch (err) {
    return mapError(res, err);
  }
});

function mapError(res, err) {
  if (err instanceof AuthenticationError) {
    return res.status(401).json({ error: "auth failed" });
  }
  console.error("chat error:", err);
  return res.status(500).json({ error: err?.message ?? "unknown" });
}

app.listen(PORT, () => {
  console.log(`aigarth-node-chat listening on http://localhost:${PORT}`);
  console.log(`gateway: ${client.services.gateway}`);
  console.log(`identity: ${client.services.identity}`);
});
