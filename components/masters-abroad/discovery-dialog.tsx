"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { DiscoveryProfile } from "@/lib/types/masters-abroad";

const PROFILE_STORAGE_KEY = "momentum:masters-abroad:profile";

const EMPTY_PROFILE: DiscoveryProfile = {
  gpa: "",
  work_experience: "",
  budget: "",
  specialization: "",
  city_preference: "",
};

function loadProfile(): DiscoveryProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? { ...EMPTY_PROFILE, ...JSON.parse(raw) } : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

const FIELDS: { key: keyof DiscoveryProfile; label: string; placeholder: string }[] = [
  { key: "gpa", label: "GPA", placeholder: "e.g. 7.5/10" },
  { key: "work_experience", label: "Work experience", placeholder: "e.g. 2 years as a SOC analyst" },
  { key: "budget", label: "Budget", placeholder: "e.g. €15,000/year" },
  { key: "specialization", label: "Specialization interest", placeholder: "e.g. offensive security" },
  { key: "city_preference", label: "City preference", placeholder: "e.g. Munich, Berlin (optional)" },
];

export function DiscoveryDialog({
  open,
  onOpenChange,
  onDiscover,
  discovering,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscover: (profile: DiscoveryProfile) => void;
  discovering: boolean;
}) {
  const [profile, setProfile] = useState<DiscoveryProfile>(() => (typeof window !== "undefined" ? loadProfile() : EMPTY_PROFILE));

  function handleDiscover() {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Not persisted, but discovery still proceeds this once.
    }
    onDiscover(profile);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discover universities</DialogTitle>
          <DialogDescription>
            Your profile is saved locally so you only need to fill this in once — edit anytime before discovering.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Input
                value={profile[f.key]}
                onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleDiscover} disabled={discovering}>
            {discovering ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {discovering ? "Finding…" : "Discover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
