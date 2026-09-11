import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, FileCode2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { CreateAnnForm, type CategoryOption, type LicenseOption } from "@/components/dashboard/create-ann-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawCategory {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
}
interface RawLicense {
  slug: string;
  name: string;
  kind: string;
  is_active: boolean;
}

export default async function NewAnnPage() {
  // Middleware should already have bounced unauth'd users to
  // /login. The redundant `getSession()` check is just a
  // belt-and-braces guard against a race where the cookie
  // expired between the middleware hit and the page render.
  const a = getAigarth();
  if (!a) redirect("/login");

  // Server-side fetch of categories + licenses so the form
  // hydrates with real options on first paint. If the ANN
  // service is down (cold start, etc.) we fall back to a small
  // built-in list so the form is still usable — the
  // Create-ANN call itself will surface the upstream error.
  let categories: CategoryOption[] = [];
  let licenses: LicenseOption[] = [];
  try {
    const [c, l] = await Promise.all([
      a
        .request<{ data: RawCategory[] }>("/v1/categories", { method: "GET" }, a.services.ann)
        .catch(() => ({ data: [] as RawCategory[] })),
      a
        .request<{ data: RawLicense[] }>("/v1/licenses", { method: "GET" }, a.services.ann)
        .catch(() => ({ data: [] as RawLicense[] })),
    ]);
    categories = (c.data ?? []).map((x) => ({
      slug: x.slug,
      name: x.name,
      description: x.description,
      icon: x.icon,
    }));
    licenses = (l.data ?? []).map((x) => ({
      slug: x.slug,
      name: x.name,
      kind: x.kind,
      is_active: x.is_active,
    }));
  } catch {
    // Best-effort; the form will show empty dropdowns and the
    // user can retry once the ANN service warms up.
  }

  // Sensible defaults if the catalog is cold
  const fallbackCategories: CategoryOption[] = [
    { slug: "research", name: "Research", description: "Experimental models", icon: null },
    { slug: "vision", name: "Vision", description: null, icon: null },
    { slug: "language", name: "Language", description: null, icon: null },
    { slug: "reasoning", name: "Reasoning", description: null, icon: null },
  ];
  const fallbackLicenses: LicenseOption[] = [
    { slug: "open", name: "Open", kind: "open", is_active: true },
    { slug: "commercial", name: "Commercial", kind: "commercial", is_active: true },
    { slug: "restricted", name: "Restricted", kind: "restricted", is_active: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create an ANN"
        description="Plant a new intelligence. You'll land on its public detail page when it's live."
        action={
          <Link
            href="/dashboard/garden"
            className="inline-flex items-center gap-1.5 text-sm text-garden-600 hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Back to the Garden
          </Link>
        }
      />

      <CreateAnnForm
        categories={categories.length > 0 ? categories : fallbackCategories}
        licenses={licenses.length > 0 ? licenses : fallbackLicenses}
      />

      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <FileCode2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Prefer to script it?</p>
            <p>
              The same flow is available over the public API. Sign up, then POST to{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                https://api.aigarth.cloud/v1/anns
              </code>{" "}
              with a Bearer token from your session cookie. The full reference lives at{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                docs/API-SPEC.md
              </code>{" "}
              and is also surfaced at{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                /docs/api
              </code>{" "}
              on the dashboard.
              <span className="ml-1 inline-flex items-center gap-1 align-middle text-xs">
                <ExternalLink className="h-3 w-3" />
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
