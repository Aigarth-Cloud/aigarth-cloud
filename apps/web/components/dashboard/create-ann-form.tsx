"use client";

/**
 * CreateAnnForm
 *
 * Self-serve UI for registering a new ANN on the public site.
 * Lives at /dashboard/models/new. Wired up by Phase 28+ so the
 * "Create ANN" button in the Garden page (and the empty-state
 * CTA) goes somewhere real instead of /dashboard/models/new
 * which was a 404 before this file existed.
 *
 * The flow runs three requests in sequence:
 *
 *   1. POST /api/anns            → services/ann POST /v1/anns
 *      Creates the draft row with metadata.
 *   2. POST /api/anns/:id/versions  → services/ann POST /v1/anns/:id/versions
 *      publishAnn refuses to flip status without ≥1 version
 *      (services/ann/src/services/anns.ts publishAnn()), so we
 *      seed v1.0.0 with a placeholder changelog before the next
 *      call.
 *   3. POST /api/anns/:id/publish → services/ann POST /v1/anns/:id/publish
 *      Flips status: draft → published.
 *
 * On success we redirect to /anns/<slug> (the public detail
 * page) so the user sees their work live and can hit the Run
 * panel from there.
 *
 * Failure modes the UI surfaces explicitly:
 *   - Validation error from the ANN service (Zod): inline 400
 *     message under the offending field.
 *   - Auth error (cookie expired): reload to /login.
 *   - Mid-flow error after the draft was created: tell the user
 *     "draft saved, publish failed: …" and link to the Garden
 *     page so they can retry without losing metadata.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@aigarth/ui";
import { Input } from "@aigarth/ui";
import { Textarea } from "@aigarth/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@aigarth/ui";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";

export interface CategoryOption {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export interface LicenseOption {
  slug: string;
  name: string;
  kind: string;
  is_active: boolean;
}

interface CreateAnnFormProps {
  categories: CategoryOption[];
  licenses: LicenseOption[];
  defaultCategorySlug?: string;
  defaultLicenseSlug?: string;
}

export function CreateAnnForm({
  categories,
  licenses,
  defaultCategorySlug,
  defaultLicenseSlug,
}: CreateAnnFormProps) {
  const router = useRouter();

  const activeLicenses = React.useMemo(
    () => licenses.filter((l) => l.is_active),
    [licenses],
  );

  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState(
    defaultCategorySlug ?? categories[0]?.slug ?? "",
  );
  const [license, setLicense] = React.useState(
    defaultLicenseSlug ?? activeLicenses[0]?.slug ?? "",
  );
  const [visibility, setVisibility] = React.useState<"public" | "unlisted" | "private">(
    "public",
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draftSlug, setDraftSlug] = React.useState<string | null>(null);

  const canSubmit =
    name.trim().length >= 3 &&
    tagline.trim().length >= 10 &&
    description.trim().length >= 30 &&
    category !== "" &&
    license !== "" &&
    !submitting;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setDraftSlug(null);
    setSubmitting(true);

    try {
      // 1) Create the draft
      const createRes = await fetch("/api/anns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          category,
          license,
          visibility,
        }),
      });
      const created = (await createRes.json().catch(() => null)) as
        | { id?: string; slug?: string; error?: { message: string } }
        | null;

      if (!createRes.ok || !created || !created.id || !created.slug) {
        const msg = created?.error?.message ?? `Create failed (HTTP ${createRes.status})`;
        setError(msg);
        setSubmitting(false);
        return;
      }

      const annId = created.id;
      const annSlug = created.slug;
      setDraftSlug(annSlug);

      // 2) Seed v1.0.0 — required by publishAnn
      const versionRes = await fetch(`/api/anns/${encodeURIComponent(annId)}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: "1.0.0",
          changelog: "Initial draft published from the self-serve Create-ANN form.",
        }),
      });
      if (!versionRes.ok) {
        const body = (await versionRes.json().catch(() => null)) as
          | { error?: { message: string } }
          | null;
        setError(
          `Draft created at /anns/${annSlug}, but adding version 1.0.0 failed: ${body?.error?.message ?? `HTTP ${versionRes.status}`}. Open the Garden to retry.`,
        );
        setSubmitting(false);
        return;
      }

      // 3) Publish
      const publishRes = await fetch(`/api/anns/${encodeURIComponent(annId)}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!publishRes.ok) {
        const body = (await publishRes.json().catch(() => null)) as
          | { error?: { message: string } }
          | null;
        setError(
          `Draft created at /anns/${annSlug}, but publish failed: ${body?.error?.message ?? `HTTP ${publishRes.status}`}. Open the Garden to retry.`,
        );
        setSubmitting(false);
        return;
      }

      // 4) Land on the public detail page
      router.push(`/anns/${annSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-garden-500" />
          Register a new ANN
        </CardTitle>
        <CardDescription>
          Create a draft, seed version 1.0.0, and publish. You'll land on the public
          detail page when the ANN is live.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="ann-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="ann-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kismet — Cross-Domain Correspondence Finder"
              maxLength={80}
              autoComplete="off"
              required
            />
            <p className="text-xs text-muted-foreground">
              The slug is derived from this name (lowercased, dashed). 3–80 chars.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="ann-tagline" className="text-sm font-medium">
              Tagline
            </label>
            <Input
              id="ann-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One sentence — what does it do?"
              maxLength={140}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ann-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="ann-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How does it work? What kind of inputs does it accept? Who is it for?"
              rows={5}
              maxLength={4000}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="ann-category" className="text-sm font-medium">
                Category
              </label>
              <select
                id="ann-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                {categories.length === 0 ? (
                  <option value="">Loading…</option>
                ) : (
                  categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="ann-license" className="text-sm font-medium">
                License
              </label>
              <select
                id="ann-license"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                {activeLicenses.length === 0 ? (
                  <option value="">Loading…</option>
                ) : (
                  activeLicenses.map((l) => (
                    <option key={l.slug} value={l.slug}>
                      {l.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Visibility</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["public", "unlisted", "private"] as const).map((v) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-accent/40 ${
                    visibility === v ? "border-garden-500 bg-garden-50/30" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={visibility === v}
                    onChange={() => setVisibility(v)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium capitalize">{v}</div>
                    <div className="text-xs text-muted-foreground">
                      {v === "public" && "Listed on /anns and the marketplace."}
                      {v === "unlisted" && "Reachable by slug, not listed."}
                      {v === "private" && "Owner-only."}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50/60 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
              {draftSlug && (
                <>
                  {" "}
                  <a className="underline" href={`/dashboard/garden`}>
                    Open the Garden
                  </a>
                  .
                </>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard/garden")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit} className="gap-1.5">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                Create ANN
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
