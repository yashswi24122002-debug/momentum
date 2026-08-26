"use client";

import { Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { UNIVERSITY_STATUS_ORDER, UNIVERSITY_STATUS_LABELS, UNIVERSITY_STATUS_TONES } from "@/lib/masters-abroad/ui";
import type { University, UniversityStatus } from "@/lib/types/masters-abroad";

export function UniversityCard({
  university,
  onStatusChange,
  onToggleVerified,
}: {
  university: University;
  onStatusChange: (status: UniversityStatus) => void;
  onToggleVerified: () => void;
}) {
  return (
    <Card className="gap-2 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{university.name}</h3>
          {university.program_name && <p className="text-xs text-text-secondary">{university.program_name}</p>}
        </div>
        {university.source === "ai_suggested" && (
          <span className="flex items-center gap-1 rounded-full bg-accent-muted-bg px-2 py-0.5 text-[10px] text-primary">
            <Sparkles className="size-3" />
            AI suggested
          </span>
        )}
      </div>

      {university.city && <p className="text-xs text-text-muted">{university.city}</p>}
      {university.fit_notes && <p className="text-sm text-text-secondary">{university.fit_notes}</p>}

      {!university.verified && (
        <div className="flex items-center justify-between rounded-lg bg-warning/10 p-2 text-xs text-warning">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="size-3.5" />
            Unverified — deadlines shown aren&apos;t trustworthy yet.
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-warning hover:bg-warning/20" onClick={onToggleVerified}>
            Mark verified
          </Button>
        </div>
      )}
      {university.verified && (
        <span className="flex items-center gap-1.5 text-xs text-primary">
          <ShieldCheck className="size-3.5" />
          Verified against official site
        </span>
      )}

      <div className="flex items-center gap-2 pt-1">
        <StatusBadge label={UNIVERSITY_STATUS_LABELS[university.status]} tone={UNIVERSITY_STATUS_TONES[university.status]} />
        <Select value={university.status} onValueChange={(v) => v && onStatusChange(v as UniversityStatus)}>
          <SelectTrigger size="sm" className="ml-auto w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIVERSITY_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {UNIVERSITY_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
