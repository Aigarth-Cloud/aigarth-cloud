import { redirect } from "next/navigation";
import { Key, Copy, Eye, EyeOff, MoreHorizontal, Plus, Shield } from "lucide-react";
import { Badge } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";
import { ApiKeysClient } from "./client";

export default async function APIKeysPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;
  let keys: Awaited<ReturnType<typeof a.keys.list>>["data"] = [];
  let loadError: string | null = null;
  try {
    const res = await a.keys.list();
    keys = res.data;
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description="Manage keys for your projects. Each key can be scoped, rotated, and revoked independently."
      />

      {loadError ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Could not load keys: {loadError}
        </div>
      ) : (
        <ApiKeysClient initialKeys={keys} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-garden-500" />
            <h3 className="font-semibold">Best practices</h3>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>• Use separate keys for each environment (dev, staging, prod)</li>
            <li>• Scope keys to the minimum required permissions</li>
            <li>• Rotate keys every 90 days</li>
            <li>• Store keys in environment variables, never in source</li>
            <li>• Revoke any key you suspect has been exposed</li>
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Key format</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Aigarth issues keys as <code className="rounded bg-muted px-1 py-0.5 text-xs">ak_live_&lt;8-char-prefix&gt;.&lt;43-char-secret&gt;</code>.
            The full secret is shown <strong>once</strong> at creation. After that only the prefix and last 4 are retrievable.
          </p>
          <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs">
            <div className="font-mono">
              <span className="text-muted-foreground">prefix: </span>a1b2c3d4
              <br />
              <span className="text-muted-foreground">last4:  </span>udaw
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
