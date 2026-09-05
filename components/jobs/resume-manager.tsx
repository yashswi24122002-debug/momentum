"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Upload, Loader2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/client";
import { fetcher } from "@/lib/swr-fetcher";
import type { ResumeWithUrl } from "@/lib/types/jobs";

const BUCKET = "documents";

export function ResumeManager() {
  const { data, mutate } = useSWR<{ resumes: ResumeWithUrl[] }>("/api/resumes", fetcher);
  const resumes = data?.resumes ?? null;
  const [uploading, setUploading] = useState(false);
  const [focusArea, setFocusArea] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    const supabase = createClient();

    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, storage_path: path, focus_area: focusArea.trim() || null }),
      });
      if (!res.ok) throw new Error("insert failed");

      const { resume } = await res.json();
      mutate((prev) => prev && { resumes: [resume, ...prev.resumes] }, { revalidate: false });
      setFocusArea("");
    } catch {
      toast.error("Upload failed — try again.");
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (resumes === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/jobs" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Resumes</h1>
      </div>

      <Card className="flex flex-row flex-wrap items-end gap-3 border-border bg-surface p-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Focus area (optional)</label>
          <Input
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="e.g. Full-stack, React-heavy"
          />
        </div>
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload resume
        </Button>
      </Card>

      {resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Upload a resume to reference when drafting outreach emails."
        />
      ) : (
        <div className="space-y-2">
          {resumes.map((resume) => (
            <Card key={resume.id} className="flex flex-row items-center gap-3 border-border bg-surface p-3">
              <FileText className="size-4 shrink-0 text-text-muted" />
              <div className="flex-1">
                <p className="text-sm text-text-primary">{resume.name}</p>
                {resume.focus_area && <p className="text-xs text-text-muted">{resume.focus_area}</p>}
              </div>
              {resume.signed_url && (
                <a href={resume.signed_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-primary">
                  <ExternalLink className="size-4" />
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
