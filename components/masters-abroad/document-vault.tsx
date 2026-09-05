"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Upload, Loader2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/client";
import { fetcher } from "@/lib/swr-fetcher";
import type { DocumentWithUrl } from "@/lib/types/masters-abroad";

const BUCKET = "documents";

export function DocumentVault() {
  const { data, mutate } = useSWR<{ documents: DocumentWithUrl[] }>("/api/documents", fetcher);
  const documents = data?.documents;
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    let failures = 0;

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
        if (uploadError) throw uploadError;

        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, storage_path: path }),
        });
        if (!res.ok) throw new Error("insert failed");

        const { document } = await res.json();
        mutate((prev) => ({ documents: [document, ...(prev?.documents ?? [])] }), { revalidate: false });
      } catch {
        failures++;
      }
    }

    setUploading(false);
    if (failures > 0) toast.error(`${failures} file(s) failed to upload — try again.`);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (documents === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" render={<Link href="/masters-abroad" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold text-text-primary">Documents</h1>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Upload transcripts, certificates, and other application documents here." />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="flex flex-row items-center gap-3 border-border bg-surface p-3">
              <FileText className="size-4 shrink-0 text-text-muted" />
              <div className="flex-1">
                <p className="text-sm text-text-primary">{doc.name}</p>
                <p className="text-xs text-text-muted">v{doc.version}</p>
              </div>
              {doc.signed_url && (
                <a href={doc.signed_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-primary">
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
