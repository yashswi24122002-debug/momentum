"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CITY_COST_OF_LIVING, matchCuratedUniversity } from "@/lib/masters-abroad/curated-universities";
import type { University } from "@/lib/types/masters-abroad";

const ROWS: { label: string; render: (u: University) => React.ReactNode }[] = [
  { label: "City", render: (u) => u.city ?? "—" },
  {
    label: "Cost of living",
    render: (u) => (u.city && CITY_COST_OF_LIVING[u.city]) || "Not in reference data",
  },
  { label: "Tuition", render: (u) => u.requirements?.tuition_estimate ?? "Unknown" },
  {
    label: "Program focus",
    render: (u) => matchCuratedUniversity(u.name)?.focusAreas.join(", ") ?? u.program_name ?? "—",
  },
  {
    label: "Fit score",
    render: (u) => (u.requirements?.fit_scores ? `${u.requirements.fit_scores.overall}/100` : "Not scored"),
  },
  { label: "uni-assist deadline", render: (u) => u.deadline_uni_assist ?? "Not set" },
  { label: "Direct deadline", render: (u) => u.deadline_direct ?? "Not set" },
  { label: "Verified", render: (u) => (u.verified ? "Yes" : "No — don't trust deadlines yet") },
];

export function ComparisonDialog({
  universities,
  open,
  onOpenChange,
}: {
  universities: University[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compare universities</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border p-2 text-left text-xs font-medium text-text-muted"> </th>
                {universities.map((u) => (
                  <th key={u.id} className="border-b border-border p-2 text-left text-xs font-medium text-text-primary">
                    {u.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="border-b border-border p-2 text-xs font-medium text-text-muted">{row.label}</td>
                  {universities.map((u) => (
                    <td key={u.id} className="border-b border-border p-2 text-xs text-text-secondary">
                      {row.render(u)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
