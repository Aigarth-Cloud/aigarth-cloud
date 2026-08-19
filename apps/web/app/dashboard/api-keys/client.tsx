"use client";

import * as React from "react";
import { Copy, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Input } from "@aigarth/ui";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  secret_last4: string;
  scopes: string[];
  status: "active" | "revoked";
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

function fmtTime(iso: string | null): string {
  if (!iso) return " ";
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function ApiKeysClient({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = React.useState<KeyRow[]>(initialKeys);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showKeyFor, setShowKeyFor] = React.useState<string | null>(null);
  const [justIssued, setJustIssued] = React.useState<{ full_key: string; prefix: string; last4: string; name: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        scopes: String(fd.get("scopes") ?? "chat:read,chat:write").split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as {
      ok: boolean;
      full_key?: string;
      prefix?: string;
      secret_last4?: string;
    };
    if (data.full_key) {
      setJustIssued({
        full_key: data.full_key,
        prefix: data.prefix ?? "",
        last4: data.secret_last4 ?? "",
        name: String(fd.get("name") ?? "key"),
      });
    }
    setCreateOpen(false);
    // Refresh list to include the new key (without the secret).
    window.location.reload();
  }

  async function onRevoke(id: string) {
    if (!window.confirm("Revoke this key? It will stop working immediately.")) return;
    const res = await fetch(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Failed (${res.status})`);
      return;
    }
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: "revoked" as const } : k)));
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {keys.length} {keys.length === 1 ? "key" : "keys"}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Generate key
        </Button>
      </div>

      {justIssued && (
        <div className="rounded-md border border-garden-500/40 bg-garden-500/10 p-4">
          <div className="text-sm font-medium text-garden-700 dark:text-garden-300">
            ✓ Key created: {justIssued.name}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Save this somewhere safe. It will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded bg-background p-2 font-mono text-xs">
            <span className="flex-1 break-all">{justIssued.full_key}</span>
            <button
              onClick={() => copy(justIssued.full_key)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Copy"
            >
              {copied ? "Copied!" : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Key</th>
                <th className="px-6 py-3 text-left">Scopes</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Last used</th>
                <th className="px-6 py-3 text-left">Created</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No keys yet. Generate one to get started.
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const masked = `ak_live_${k.prefix}${"•".repeat(8)}.${"•".repeat(k.secret_last4.length)}`;
                  const reveal = `ak_live_${k.prefix}${"•".repeat(8)}.${k.secret_last4}`;
                  return (
                    <tr key={k.id} className="border-b border-border/50 last:border-0">
                      <td className="px-6 py-4 font-medium">{k.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs">
                            {showKeyFor === k.id ? reveal : masked}
                          </code>
                          <button
                            onClick={() => setShowKeyFor(showKeyFor === k.id ? null : k.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Toggle reveal"
                          >
                            {showKeyFor === k.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.length === 0 ? (
                            <span className="text-xs text-muted-foreground">none</span>
                          ) : (
                            k.scopes.map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px]">
                                {s}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={k.status === "active" ? "success" : "secondary"}>
                          {k.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{fmtTime(k.last_used_at)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{fmtTime(k.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        {k.status === "active" && (
                          <button
                            onClick={() => onRevoke(k.id)}
                            className="text-muted-foreground hover:text-red-500"
                            aria-label="Revoke"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onCreate}
            className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">Generate a new API key</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input name="name" required placeholder="e.g. production-api" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Scopes (comma-separated)</label>
              <Input
                name="scopes"
                defaultValue="chat:read,chat:write"
                placeholder="chat:read,chat:write,embeddings:write"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Common scopes: chat:read, chat:write, embeddings:read, embeddings:write, models:read, usage:read
              </p>
            </div>
            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
