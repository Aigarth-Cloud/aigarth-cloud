"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle } from "@aigarth/ui";

type PolicyKind = "majority" | "unanimous" | "any" | "veto_aware" | "short_circuit";
type Access = "open" | "licensed";
type Visibility = "public" | "unlisted" | "private";
type MemberRole = "voting" | "veto" | "advisory";

interface CreatedTissue {
  id: string;
  slug: string;
  name: string;
  policy_kind: string;
  status: string;
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

function PlainSelect({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Create tissue form. Uses the SDK via dynamic import so the
 * @aigarth/sdk ESM doesn't get bundled into the initial page.
 */
export function CreateTissueForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [policyKind, setPolicyKind] = useState<PolicyKind>("veto_aware");
  const [threshold, setThreshold] = useState("0.5");
  const [access, setAccess] = useState<Access>("open");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTissue | null>(null);
  const [annSlug, setAnnSlug] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("voting");
  const [memberWeight, setMemberWeight] = useState("0.5");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);

  async function getClient() {
    const apiKey = await fetch("/api/sdk-key")
      .then((r) => r.json())
      .then((j) => j.key)
      .catch(() => null);
    if (!apiKey) throw new Error("No API key available");
    const mod = await import("../../../../../packages/sdk/dist/index.js");
    return new mod.Aigarth({ apiKey });
  }

  async function handleCreate() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    startTransition(async () => {
      try {
        const client = await getClient();
        const t = (await client.tissues.create({
          name: trimmedName,
          tagline: tagline.trim() || trimmedName,
          description: description.trim() || `A ${policyKind} tissue.`,
          visibility,
          access,
          policy: {
            kind: policyKind,
            threshold: Number(threshold) || 0.5,
          },
        })) as unknown as CreatedTissue;
        setCreated(t);
        if (access === "open") {
          await client.tissues.publish(t.slug).catch(() => null);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
      }
    });
  }

  async function handleAddMember() {
    setMemberError(null);
    setMemberSuccess(null);
    if (!created) return;
    if (!annSlug.trim()) {
      setMemberError("ANN slug is required");
      return;
    }
    startTransition(async () => {
      try {
        const client = await getClient();
        await client.tissues.addMember(created.slug, {
          annSlug: annSlug.trim(),
          role: memberRole,
          authorityWeight: Number(memberWeight) || 0.5,
        });
        setMemberSuccess(`Added ${annSlug.trim()} as ${memberRole}.`);
        setAnnSlug("");
        router.refresh();
      } catch (e) {
        setMemberError(e instanceof Error ? e.message : "Add member failed");
      }
    });
  }

  async function handlePublish() {
    if (!created) return;
    startTransition(async () => {
      try {
        const client = await getClient();
        await client.tissues.publish(created.slug);
        setCreated({ ...created, status: "active" });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Publish failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New tissue</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Pick a name, set the policy, then add the ANNs that participate.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <Label htmlFor="tissue-name">Name</Label>
            <Input
              id="tissue-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Risk Council"
              disabled={isPending || !!created}
            />
          </div>
          <div>
            <Label htmlFor="tissue-tagline">Tagline</Label>
            <Input
              id="tissue-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Multi-ANN safety review"
              disabled={isPending || !!created}
            />
          </div>
          <div>
            <Label htmlFor="tissue-description">Description</Label>
            <Textarea
              id="tissue-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional longer description"
              rows={3}
              disabled={isPending || !!created}
            />
          </div>
          <div>
            <Label htmlFor="tissue-policy">Consensus policy</Label>
            <PlainSelect
              id="tissue-policy"
              value={policyKind}
              onChange={(v) => setPolicyKind(v as PolicyKind)}
              disabled={isPending || !!created}
              options={[
                { value: "majority", label: "majority: most members agree" },
                { value: "unanimous", label: "unanimous: every member agrees" },
                { value: "any", label: "any: first non-zero wins" },
                { value: "veto_aware", label: "veto_aware: any veto blocks" },
                { value: "short_circuit", label: "short_circuit: first decisive wins" },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="tissue-threshold">Threshold (0.0–1.0)</Label>
            <Input
              id="tissue-threshold"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0.5"
              disabled={isPending || !!created}
            />
          </div>
          <div>
            <Label htmlFor="tissue-access">Access</Label>
            <PlainSelect
              id="tissue-access"
              value={access}
              onChange={(v) => setAccess(v as Access)}
              disabled={isPending || !!created}
              options={[
                { value: "open", label: "open: anyone can call" },
                { value: "licensed", label: "licensed: explicit grants only" },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="tissue-vis">Visibility</Label>
            <PlainSelect
              id="tissue-vis"
              value={visibility}
              onChange={(v) => setVisibility(v as Visibility)}
              disabled={isPending || !!created}
              options={[
                { value: "private", label: "private: owner only" },
                { value: "unlisted", label: "unlisted: link only" },
                { value: "public", label: "public: discoverable" },
              ]}
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <Button onClick={handleCreate} disabled={isPending || !name.trim() || !!created}>
            {isPending ? "Creating…" : created ? "Created" : "Create tissue"}
          </Button>
        </div>

        {created && (
          <div className="mt-6 space-y-3 border-t pt-5">
            <h4 className="text-sm font-medium">
              Add members to <span className="font-mono">{created.slug}</span>
            </h4>
            <div>
              <Label htmlFor="member-slug">ANN slug</Label>
              <Input
                id="member-slug"
                value={annSlug}
                onChange={(e) => setAnnSlug(e.target.value)}
                placeholder="ann_risk_v1"
                disabled={isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="member-role">Role</Label>
                <PlainSelect
                  id="member-role"
                  value={memberRole}
                  onChange={(v) => setMemberRole(v as MemberRole)}
                  options={[
                    { value: "voting", label: "voting" },
                    { value: "veto", label: "veto" },
                    { value: "advisory", label: "advisory" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="member-weight">Authority</Label>
                <Input
                  id="member-weight"
                  value={memberWeight}
                  onChange={(e) => setMemberWeight(e.target.value)}
                  placeholder="0.5"
                  disabled={isPending}
                />
              </div>
            </div>
            {memberError && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600">
                {memberError}
              </p>
            )}
            {memberSuccess && (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-600">
                {memberSuccess}
              </p>
            )}
            <Button onClick={handleAddMember} disabled={isPending || !annSlug.trim()}>
              {isPending ? "Adding…" : "Add member"}
            </Button>

            {created.status !== "active" && (
              <Button onClick={handlePublish} variant="outline" className="w-full" disabled={isPending}>
                Publish tissue
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              Once you have at least one member, the tissue can answer /decide. Set{" "}
              <span className="font-mono">access = licensed</span> first if you need to grant per-user access.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
