"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Plus, X, Download, Sparkles, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { fetcher } from "@/lib/swr-fetcher";
import { previewResumePdf } from "@/lib/jobs/resume-pdf";
import type { ResumeContent } from "@/lib/types/resume";

const EMPTY: ResumeContent = {
  name: "",
  email: "",
  github: "",
  mobile: "",
  linkedin: "",
  location: "",
  education: [],
  skills: [],
  experience: [],
  projects: [],
  honors: [],
};

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-text-secondary">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function ResumeProfileEditor() {
  const { data, mutate } = useSWR<{ profile: (ResumeContent & { id: string }) | null }>("/api/resume-profile", fetcher);
  const [resume, setResume] = useState<ResumeContent | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  // Seed local editable state from the fetched profile once — after that
  // every edit is local until Save, same pattern as other forms in this
  // app that pre-fill from a fetch.
  if (!hydrated && data !== undefined) {
    setHydrated(true);
    setResume(data.profile ? { ...data.profile } : EMPTY);
  }

  async function save() {
    if (!resume) return;
    if (!resume.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/resume-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resume),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save — try again.");
      return;
    }
    const { profile } = await res.json();
    mutate({ profile }, { revalidate: false });
    toast.success("Saved.");
  }

  async function runImport() {
    if (!importText.trim()) return;
    setImporting(true);
    const res = await fetch("/api/resume-profile/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: importText }),
    });
    setImporting(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't parse that — try again." }));
      toast.error(error);
      return;
    }
    const { profile } = await res.json();
    setResume(profile);
    setImportOpen(false);
    setImportText("");
    toast.success("Parsed — review it below, then Save.");
  }

  if (data === undefined || resume === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  function update<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    setResume((prev) => prev && { ...prev, [key]: value });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" render={<Link href="/jobs" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold text-text-primary">My Resume</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Sparkles className="size-3.5" />
            Import from text
          </Button>
          <Button variant="outline" size="sm" onClick={() => previewResumePdf(resume)}>
            <Download className="size-3.5" />
            Preview PDF
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </Button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        This is the canonical version of your resume — every JD-tailored version starts from this data and renders
        through the same fixed layout, so the format never changes, only the wording.
      </p>

      <SectionCard title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={resume.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={resume.email ?? ""} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile</Label>
            <Input value={resume.mobile ?? ""} onChange={(e) => update("mobile", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={resume.location ?? ""} onChange={(e) => update("location", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>GitHub</Label>
            <Input value={resume.github ?? ""} onChange={(e) => update("github", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>LinkedIn</Label>
            <Input value={resume.linkedin ?? ""} onChange={(e) => update("linkedin", e.target.value)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Education"
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => update("education", [...resume.education, { institution: "", detail: "", dates: "" }])}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        {resume.education.map((edu, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-text-muted hover:text-danger"
                onClick={() => update("education", resume.education.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Institution"
                value={edu.institution}
                onChange={(e) =>
                  update(
                    "education",
                    resume.education.map((x, j) => (j === i ? { ...x, institution: e.target.value } : x))
                  )
                }
              />
              <Input
                placeholder="Dates (e.g. 2020 – 2024)"
                value={edu.dates}
                onChange={(e) =>
                  update(
                    "education",
                    resume.education.map((x, j) => (j === i ? { ...x, dates: e.target.value } : x))
                  )
                }
              />
            </div>
            <Input
              placeholder="Detail (degree, CGPA, etc.)"
              value={edu.detail}
              onChange={(e) =>
                update(
                  "education",
                  resume.education.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x))
                )
              }
            />
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Skills"
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => update("skills", [...resume.skills, { category: "", items: [] }])}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        {resume.skills.map((group, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="w-40 shrink-0"
              placeholder="Category"
              value={group.category}
              onChange={(e) =>
                update(
                  "skills",
                  resume.skills.map((x, j) => (j === i ? { ...x, category: e.target.value } : x))
                )
              }
            />
            <Input
              placeholder="Comma-separated skills"
              value={group.items.join(", ")}
              onChange={(e) =>
                update(
                  "skills",
                  resume.skills.map((x, j) =>
                    j === i ? { ...x, items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x
                  )
                )
              }
            />
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-text-muted hover:text-danger"
              onClick={() => update("skills", resume.skills.filter((_, j) => j !== i))}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Experience"
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() =>
              update("experience", [...resume.experience, { company: "", location: "", role: "", dates: "", bullets: [] }])
            }
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        {resume.experience.map((job, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-text-muted hover:text-danger"
                onClick={() => update("experience", resume.experience.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Company"
                value={job.company}
                onChange={(e) =>
                  update("experience", resume.experience.map((x, j) => (j === i ? { ...x, company: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Location"
                value={job.location}
                onChange={(e) =>
                  update("experience", resume.experience.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Role"
                value={job.role}
                onChange={(e) =>
                  update("experience", resume.experience.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Dates"
                value={job.dates}
                onChange={(e) =>
                  update("experience", resume.experience.map((x, j) => (j === i ? { ...x, dates: e.target.value } : x)))
                }
              />
            </div>
            <Textarea
              placeholder="One bullet per line"
              rows={Math.max(3, job.bullets.length)}
              value={job.bullets.join("\n")}
              onChange={(e) =>
                update(
                  "experience",
                  resume.experience.map((x, j) =>
                    j === i ? { ...x, bullets: e.target.value.split("\n") } : x
                  )
                )
              }
            />
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Projects"
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => update("projects", [...resume.projects, { name: "", description: "", dates: "" }])}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        {resume.projects.map((project, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-text-muted hover:text-danger"
                onClick={() => update("projects", resume.projects.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Project name"
                value={project.name}
                onChange={(e) =>
                  update("projects", resume.projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Dates"
                value={project.dates}
                onChange={(e) =>
                  update("projects", resume.projects.map((x, j) => (j === i ? { ...x, dates: e.target.value } : x)))
                }
              />
            </div>
            <Textarea
              placeholder="Description"
              rows={2}
              value={project.description}
              onChange={(e) =>
                update("projects", resume.projects.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
              }
            />
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Honors and Awards">
        <Textarea
          placeholder="One per line"
          rows={Math.max(3, resume.honors.length)}
          value={resume.honors.join("\n")}
          onChange={(e) => update("honors", e.target.value.split("\n"))}
        />
      </SectionCard>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from pasted text</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-text-muted">
            Paste your resume&apos;s text (copy it out of your PDF) — it&apos;ll be parsed into the fields above for you
            to review before saving. Nothing is saved until you hit Save.
          </p>
          <Textarea
            rows={12}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste your resume text here…"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={runImport} disabled={importing || !importText.trim()}>
              {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {importing ? "Parsing…" : "Parse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
