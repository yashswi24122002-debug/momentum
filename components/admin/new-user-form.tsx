"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function NewUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string; userId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), display_name: displayName.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't create that account — try again." }));
      toast.error(error);
      return;
    }
    const { user, tempPassword } = await res.json();
    setCreated({ email: email.trim(), tempPassword, userId: user.id });
  }

  async function handleCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(`Email: ${created.email}\nTemporary password: ${created.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-xl font-semibold text-text-primary">Account created</h1>
        <Card className="max-w-md gap-3 border-border bg-surface p-5">
          <p className="text-sm text-text-secondary">
            Send these credentials to your friend directly (WhatsApp/text) — this password is shown once and can&apos;t be retrieved again.
            They&apos;ll be forced to set their own password on first login.
          </p>
          <div className="space-y-1 rounded-lg bg-background p-3 font-mono text-sm">
            <p className="text-text-primary">Email: {created.email}</p>
            <p className="text-text-primary">Password: {created.tempPassword}</p>
          </div>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy credentials"}
          </Button>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => router.push(`/admin/users/${created.userId}`)}>Set up their access</Button>
            <Button variant="outline" onClick={() => router.push("/admin/users")}>
              Back to users
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/admin/users" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Invite a member</h1>
      </div>

      <Card className="max-w-md gap-4 border-border bg-surface p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Creating…" : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
