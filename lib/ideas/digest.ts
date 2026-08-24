import { startOfWeekMonday, addDays, parseLocalISODate } from "@/lib/date";
import type { Idea, IdeaReport } from "@/lib/types/ideas";

export type WeeklyDigest = {
  generated: number;
  approved: number;
  rejected: number;
  staleBacklog: { reportId: string; ideaId: string; daysUntouched: number }[];
};

/**
 * Ideas Tool PRD §2 step 7: "computed on page load, not emailed." Approved
 * count uses idea_reports.created_at (the moment of approval) since the
 * ideas table itself has no approved-at timestamp; rejected count falls
 * back to date_generated as the closest available signal.
 */
export function computeWeeklyDigest(
  ideas: Idea[],
  reports: IdeaReport[],
  today: string
): WeeklyDigest {
  const weekStart = startOfWeekMonday(parseLocalISODate(today));

  const generated = ideas.filter((i) => i.date_generated >= weekStart).length;
  const approved = reports.filter((r) => r.created_at.slice(0, 10) >= weekStart).length;
  const rejected = ideas.filter((i) => i.status === "rejected" && i.date_generated >= weekStart).length;

  const staleCutoff = addDays(today, -7);
  const staleBacklog = reports
    .filter((r) => r.lifecycle_status === "backlog" && r.updated_at.slice(0, 10) <= staleCutoff)
    .map((r) => {
      const days = Math.round(
        (parseLocalISODate(today).getTime() - parseLocalISODate(r.updated_at.slice(0, 10)).getTime()) /
          86_400_000
      );
      return { reportId: r.id, ideaId: r.idea_id, daysUntouched: days };
    });

  return { generated, approved, rejected, staleBacklog };
}
