"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Copy, Check, Key, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { MemberDashboardContent } from "@/components/admin/member-dashboard";
import { fetcher } from "@/lib/swr-fetcher";
import { TOOL_ORDER, TOOL_LABELS, FEATURE_ORDER, FEATURE_LABELS } from "@/lib/admin/ui";
import type { Profile, ToolKey, FeatureKey } from "@/lib/types/admin";

type Detail = {
  profile: Profile;
  toolAccess: { tool_key: ToolKey; enabled: boolean }[];
  limits: { feature_key: FeatureKey; daily_limit: number | null }[];
  hasApiKey: boolean;
};

export function EditUser({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: detail, mutate: mutateDetail } = useSWR<Detail>(`/api/admin/users/${userId}`, fetcher);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [tools, setTools] = useState<Record<ToolKey, boolean>>({} as Record<ToolKey, boolean>);
  const [limits, setLimits] = useState<Record<FeatureKey, string>>({} as Record<FeatureKey, string>);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newTempPassword, setNewTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // These fields are user-editable, so they're only ever seeded from the
  // fetched detail once per userId — not resynced on every SWR revalidation
  // or optimistic mutate(), which would otherwise clobber unsaved edits.
  const initializedForUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!detail || initializedForUserId.current === userId) return;
    initializedForUserId.current = userId;

    setDisplayName(detail.profile?.display_name ?? "");
    setEmail(detail.profile?.email ?? "");

    const toolMap = {} as Record<ToolKey, boolean>;
    for (const t of TOOL_ORDER) toolMap[t] = detail.toolAccess?.find((a) => a.tool_key === t)?.enabled ?? false;
    setTools(toolMap);

    const limitMap = {} as Record<FeatureKey, string>;
    for (const f of FEATURE_ORDER) {
      const row = detail.limits?.find((l) => l.feature_key === f);
      limitMap[f] = row?.daily_limit === null || row?.daily_limit === undefined ? "" : String(row.daily_limit);
    }
    setLimits(limitMap);
  }, [detail, userId]);

  async function saveProfile() {
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, email }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't save — try again." }));
      toast.error(error);
      return;
    }
    const { profile } = await res.json();
    mutateDetail((prev) => (prev ? { ...prev, profile } : prev), { revalidate: false });
    toast.success("Saved.");
  }

  async function resetPassword() {
    setResetting(true);
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    setResetting(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't reset the password — try again." }));
      toast.error(error);
      return;
    }
    const { tempPassword } = await res.json();
    setNewTempPassword(tempPassword);
    mutateDetail((prev) => (prev ? { ...prev, profile: { ...prev.profile, must_change_password: true } } : prev), {
      revalidate: false,
    });
    toast.success("Password reset — send the new one to them now.");
  }

  async function handleCopyTempPassword() {
    if (!newTempPassword) return;
    await navigator.clipboard.writeText(newTempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveTools() {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${userId}/tool-access`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tools }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save tool access — try again.");
      return;
    }
    toast.success("Tool access updated.");
  }

  async function saveLimits() {
    setSaving(true);
    const payload: Record<FeatureKey, number | null> = {} as Record<FeatureKey, number | null>;
    for (const f of FEATURE_ORDER) payload[f] = limits[f].trim() === "" ? null : Number(limits[f]);
    const res = await fetch(`/api/admin/users/${userId}/limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limits: payload }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save limits — try again.");
      return;
    }
    toast.success("Usage limits updated.");
  }

  async function saveApiKey() {
    if (!apiKey.trim()) {
      toast.error("Enter a Gemini API key first.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/users/${userId}/api-key`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't save the API key — try again." }));
      toast.error(error);
      return;
    }
    setApiKey("");
    mutateDetail((prev) => (prev ? { ...prev, hasApiKey: true } : prev), { revalidate: false });
    toast.success("API key saved.");
  }

  async function removeApiKey() {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${userId}/api-key`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't remove the API key — try again.");
      return;
    }
    mutateDetail((prev) => (prev ? { ...prev, hasApiKey: false } : prev), { revalidate: false });
    toast.success("API key removed.");
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete this account — try again.");
      return;
    }
    toast.success("Account deleted.");
    router.push("/admin/users");
  }

  if (!detail) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/admin/users" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">{detail.profile.display_name || detail.profile.email}</h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[420px_1fr]">
        <div className="flex flex-col gap-6">
        <Card className="gap-3 border-border bg-surface p-5">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button size="sm" onClick={saveProfile} disabled={saving} className="w-fit">
            Save
          </Button>
        </Card>

        <Card className="gap-3 border-border bg-surface p-5">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-1.5 text-sm text-text-secondary">
              <KeyRound className="size-3.5" />
              Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            <p className="text-xs text-text-muted">
              Passwords are never stored in a way anyone can read back — not even the admin. Resetting sets a brand-new
              one you can hand to them; they&apos;ll be forced to change it on their next login.
            </p>
            {newTempPassword ? (
              <>
                <div className="rounded-lg bg-background p-3 font-mono text-sm text-text-primary">{newTempPassword}</div>
                <Button variant="outline" size="sm" onClick={handleCopyTempPassword}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy password"}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={resetPassword} disabled={resetting} className="w-fit">
                Reset password
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 border-border bg-surface p-5">
          <CardHeader className="p-0">
            <CardTitle className="text-sm text-text-secondary">Tool access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            {TOOL_ORDER.map((tool) => (
              <label key={tool} className="flex items-center gap-2 text-sm text-text-primary">
                <Checkbox checked={tools[tool]} onCheckedChange={(checked) => setTools((prev) => ({ ...prev, [tool]: Boolean(checked) }))} />
                {TOOL_LABELS[tool]}
              </label>
            ))}
            <Button size="sm" onClick={saveTools} disabled={saving} className="mt-2 w-fit">
              Save tool access
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-3 border-border bg-surface p-5">
          <CardHeader className="p-0">
            <CardTitle className="text-sm text-text-secondary">Daily AI usage limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-0">
            {FEATURE_ORDER.map((feature) => (
              <div key={feature} className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-primary">{FEATURE_LABELS[feature]}</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  className="w-28"
                  value={limits[feature] ?? ""}
                  onChange={(e) => setLimits((prev) => ({ ...prev, [feature]: e.target.value }))}
                />
              </div>
            ))}
            <p className="text-xs text-text-muted">Leave blank for unlimited.</p>
            <Button size="sm" onClick={saveLimits} disabled={saving} className="w-fit">
              Save limits
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-3 border-border bg-surface p-5">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Key className="size-3.5" />
              Gemini API key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            <p className="text-xs text-text-muted">
              {detail.hasApiKey ? "Key on file — this member's AI usage runs on their own key." : "No key set — this member's AI features are blocked until one is added."}
            </p>
            <div className="flex gap-2">
              <PasswordInput placeholder="Paste their Gemini API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <Button size="sm" onClick={saveApiKey} disabled={saving}>
                Save
              </Button>
            </div>
            {detail.hasApiKey && (
              <Button variant="outline" size="sm" onClick={removeApiKey} disabled={saving}>
                Remove key
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2 border-danger/30 bg-surface p-5">
          <CardTitle className="text-sm text-danger">Danger zone</CardTitle>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="w-fit">
            <Trash2 className="size-3.5" />
            Delete account
          </Button>
        </Card>
        </div>

        <MemberDashboardContent userId={userId} />
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete ${detail.profile.email}?`}
        description="This permanently removes their account and every piece of data they created across every tool. This can't be undone."
      />
    </div>
  );
}
