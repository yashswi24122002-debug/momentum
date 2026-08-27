"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ResumeWithUrl } from "@/lib/types/jobs";

const NO_RESUME = "__none__";

export function DraftOutreachDialog({
  open,
  onOpenChange,
  onConfirm,
  drafting,
  jobTitle,
  preselectedContactName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (resumeId: string | null) => void;
  drafting: boolean;
  jobTitle: string;
  preselectedContactName?: string | null;
}) {
  const [resumes, setResumes] = useState<ResumeWithUrl[]>([]);
  const [resumeId, setResumeId] = useState<string>(NO_RESUME);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const res = await fetch("/api/resumes");
      const json = await res.json();
      setResumes(json.resumes ?? []);
    }
    load();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Draft outreach — {jobTitle}</DialogTitle>
          <DialogDescription>
            {preselectedContactName
              ? `Drafting to ${preselectedContactName}. You'll review before sending.`
              : "Looks up a likely contact via Hunter.io and drafts an email with Gemini. You'll review before sending."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Resume to reference (optional)</label>
          <Select value={resumeId} onValueChange={(v) => setResumeId(v ?? NO_RESUME)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_RESUME}>None</SelectItem>
              {resumes.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => onConfirm(resumeId === NO_RESUME ? null : resumeId)} disabled={drafting}>
            {drafting ? <Loader2 className="size-4 animate-spin" /> : null}
            Draft email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
