"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetcher } from "@/lib/swr-fetcher";
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
  // Only fetches while the dialog is open (null key disables the request);
  // SWR's cache means re-opening the dialog later shows resumes instantly
  // instead of re-fetching every time.
  const { data } = useSWR<{ resumes: ResumeWithUrl[] }>(open ? "/api/resumes" : null, fetcher);
  const resumes = data?.resumes ?? [];
  const [resumeId, setResumeId] = useState<string>(NO_RESUME);

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
