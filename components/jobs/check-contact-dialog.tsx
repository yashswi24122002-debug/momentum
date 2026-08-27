"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck, Loader2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { HunterContact } from "@/lib/integrations/hunter";

export function CheckContactDialog({
  open,
  onOpenChange,
  onSelectContact,
  jobId,
  jobTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectContact: (contact: HunterContact | null) => void;
  jobId: string;
  jobTitle: string;
}) {
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<string | null>(null);
  const [contacts, setContacts] = useState<HunterContact[]>([]);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const res = await fetch(`/api/jobs/${jobId}/check-contact`, { method: "POST" });
      const json = await res.json();
      setDomain(json.domain ?? null);
      setContacts(json.contacts ?? []);
      setLoading(false);
    }
    load();
  }, [open, jobId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Available contacts — {jobTitle}</DialogTitle>
          <DialogDescription>
            {domain ? `Publicly discoverable emails at ${domain}, via Hunter.io.` : "Looking up publicly discoverable contacts…"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No public contacts found"
            description="Hunter.io couldn't find any discoverable emails at this domain. You can still draft outreach and add a contact manually."
          />
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.email} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                  </p>
                  {c.position && <p className="truncate text-xs text-text-secondary">{c.position}</p>}
                  <p className="truncate text-xs text-text-muted">{c.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {c.verificationStatus === "valid" && (
                      <span className="flex items-center gap-1 text-[10px] text-primary">
                        <ShieldCheck className="size-3" />
                        Verified
                      </span>
                    )}
                    {c.linkedin && (
                      <a
                        href={c.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
                <Button size="sm" onClick={() => onSelectContact(c)}>
                  Draft to this person
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          {contacts.length === 0 && !loading && (
            <Button variant="outline" onClick={() => onSelectContact(null)}>
              Draft anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
