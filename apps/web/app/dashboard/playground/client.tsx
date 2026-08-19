"use client";

import * as React from "react";
import { Loader2, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@aigarth/ui";

interface ModelOpt {
  id: string;
  name: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export function PlaygroundClient({
  models,
  defaultModelId,
}: {
  models: ModelOpt[];
  defaultModelId: string;
}) {
  const [messages, setMessages] = React.useState<Message[]>([
    { role: "system", content: "You are a concise, helpful assistant." },
  ]);
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState(defaultModelId);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setPending(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: next.filter((m) => m.role !== "system" || true),
          stream: true,
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.text();
        setError(`Request failed: ${res.status} ${body}`);
        setPending(false);
        return;
      }
      // Add empty assistant message to fill
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of raw.split("\n")) {
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data) as { delta?: string; error?: string };
                if (parsed.error) {
                  setError(parsed.error);
                } else if (parsed.delta) {
                  setMessages((prev) => {
                    const copy = [...prev];
                    const last = copy[copy.length - 1];
                    if (last && last.role === "assistant") {
                      copy[copy.length - 1] = { ...last, content: last.content + parsed.delta };
                    }
                    return copy;
                  });
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        // user-cancelled; leave partial message
      } else {
        setError((err as Error).message);
      }
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function clear() {
    setMessages([{ role: "system", content: "You are a concise, helpful assistant." }]);
    setError(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            {models.length === 0 ? (
              <option value="aigarth-meridian-1">aigarth-meridian-1</option>
            ) : (
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">System prompt</label>
          <textarea
            value={messages.find((m) => m.role === "system")?.content ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setMessages((prev) => {
                const sys = prev.find((m) => m.role === "system");
                if (sys) {
                  return prev.map((m) => (m.role === "system" ? { ...m, content: v } : m));
                }
                return [{ role: "system", content: v }, ...prev];
              });
            }}
            className="h-32 w-full rounded-md border bg-background p-2 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={clear}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear
        </Button>
      </aside>

      <div className="flex min-h-[480px] flex-col rounded-xl border bg-card">
        <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.filter((m) => m.role !== "system").length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Ask anything. Streaming will appear here.
            </div>
          )}
          {messages
            .filter((m) => m.role !== "system")
            .map((m, i, arr) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {m.content || (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
        {error && (
          <div className="border-t bg-red-500/10 px-4 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            placeholder="Type a message…"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          {pending ? (
            <Button type="button" variant="outline" onClick={cancel}>
              <Square className="mr-1.5 h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Send
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
