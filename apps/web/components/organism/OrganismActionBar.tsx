"use client";

/**
 * OrganismActionBar — creator-only Fork / Mutate controls
 * (Phase 26.D, Garden Organism view).
 *
 *   Renders two buttons (Fork, Mutate) that hit the
 *   /v1/organisms/:slug/fork and /v1/organisms/:slug/mutate
 *   endpoints in services/ann. Only the creator of the
 *   organism sees the controls; non-creators get a small
 *   note ("Owned by ...").
 *
 *   Fork: creates a child organism. After a successful
 *   response, the user is redirected to the child's detail
 *   page.
 *
 *   Mutate: opens a small dialog. v1 ships a minimal text
 *   input ("mutation note") that becomes the payload's
 *   `note` field. The route's zod schema will accept the
 *   shape; a full mutation-policy editor is out of scope
 *   for this wave.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { GitFork, Wand2, AlertCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Textarea } from "@aigarth/ui";

interface OrganismActionBarProps {
  slug: string;
  /** The signed-in user's id. Compared to organism.creatorId. */
  currentUserId: string;
  /** The organism's creator. */
  creatorId: string;
  /** Base URL for the ann service. */
  annBaseUrl?: string;
  /** Bearer token to attach to mutation requests. */
  accessToken?: string;
}

export function OrganismActionBar({
  slug,
  currentUserId,
  creatorId,
  annBaseUrl = "http://localhost:7006",
  accessToken,
}: OrganismActionBarProps) {
  const router = useRouter();
  const isCreator = currentUserId === creatorId;
  const [forking, setForking] = React.useState(false);
  const [mutating, setMutating] = React.useState(false);
  const [forkError, setForkError] = React.useState<string | null>(null);
  const [mutateError, setMutateError] = React.useState<string | null>(null);
  const [mutateOpen, setMutateOpen] = React.useState(false);
  const [mutateNote, setMutateNote] = React.useState("");

  if (!isCreator) {
    return (
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          Owned by{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{creatorId}</code>.
          Fork and mutate are restricted to the creator.
        </CardContent>
      </Card>
    );
  }

  async function onFork() {
    setForking(true);
    setForkError(null);
    try {
      const res = await fetch(
        `${annBaseUrl}/v1/organisms/${encodeURIComponent(slug)}/fork`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Fork failed (${res.status})`);
      }
      const body = (await res.json()) as { slug?: string };
      if (body?.slug) {
        router.push(`/dashboard/garden/organism/${body.slug}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (e) {
      setForkError(e instanceof Error ? e.message : "Fork failed");
    } finally {
      setForking(false);
    }
  }

  async function onMutate() {
    setMutating(true);
    setMutateError(null);
    try {
      // v1: a minimal payload. The full mutation-policy editor
      // (rate, operators, recombination) is a follow-up.
      const payload = {
        genome: {
          version: Date.now(),
          mutation: { rate: 0.05, operators: ["gaussian"] },
          note: mutateNote.trim() || undefined,
        },
      };
      const res = await fetch(
        `${annBaseUrl}/v1/organisms/${encodeURIComponent(slug)}/mutate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Mutate failed (${res.status})`);
      }
      setMutateOpen(false);
      setMutateNote("");
      router.refresh();
    } catch (e) {
      setMutateError(e instanceof Error ? e.message : "Mutate failed");
    } finally {
      setMutating(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onFork}
            disabled={forking}
            data-testid="organism-fork"
          >
            <GitFork className="mr-1.5 h-3.5 w-3.5" />
            {forking ? "Forking…" : "Fork"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMutateOpen((v) => !v)}
            disabled={mutating}
            data-testid="organism-mutate-toggle"
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            {mutating ? "Mutating…" : "Mutate"}
          </Button>
        </div>

        {mutateOpen && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <label
              htmlFor="mutate-note"
              className="block text-[11px] text-muted-foreground"
            >
              Mutation note (optional)
            </label>
            <Textarea
              id="mutate-note"
              value={mutateNote}
              onChange={(e) => setMutateNote(e.target.value)}
              placeholder="Why are you mutating this organism? e.g. 'broader operator set'"
              rows={2}
              className="text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMutateOpen(false)}
                disabled={mutating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onMutate}
                disabled={mutating}
                data-testid="organism-mutate-submit"
              >
                {mutating ? "Mutating…" : "Apply mutation"}
              </Button>
            </div>
          </div>
        )}

        {forkError && (
          <p
            data-testid="organism-fork-error"
            className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-3 w-3" />
            {forkError}
          </p>
        )}
        {mutateError && (
          <p
            data-testid="organism-mutate-error"
            className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-3 w-3" />
            {mutateError}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">
          Fork creates a new child in the lineage; mutate bumps the genome
          version. Both are billed per compute in{" "}
          <code className="rounded bg-muted px-1 py-0.5">organisms.compute_consumed</code>.
        </p>
      </CardContent>
    </Card>
  );
}

// Re-export the input type so the server page can pass props
// without re-declaring the interface.
export type { OrganismActionBarProps };
