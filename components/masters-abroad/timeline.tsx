"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { todayLocalISODate } from "@/lib/date";
import type { Task, University } from "@/lib/types/masters-abroad";

type TimelineItem = { date: string; label: string; sublabel: string; trusted: boolean };

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export function Timeline() {
  const [items, setItems] = useState<TimelineItem[] | null>(null);

  useEffect(() => {
    async function load() {
      const [tasksRes, universitiesRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/universities")]);
      const tasks: Task[] = (await tasksRes.json()).tasks ?? [];
      const universities: University[] = (await universitiesRes.json()).universities ?? [];

      const taskItems: TimelineItem[] = tasks
        .filter((t) => t.deadline && t.status !== "done")
        .map((t) => ({ date: t.deadline as string, label: t.title, sublabel: "Task", trusted: true }));

      const uniItems: TimelineItem[] = universities.flatMap((u) => {
        const entries: TimelineItem[] = [];
        if (u.deadline_uni_assist) {
          entries.push({ date: u.deadline_uni_assist, label: `${u.name} — uni-assist deadline`, sublabel: "University", trusted: u.verified });
        }
        if (u.deadline_direct) {
          entries.push({ date: u.deadline_direct, label: `${u.name} — direct deadline`, sublabel: "University", trusted: u.verified });
        }
        return entries;
      });

      setItems([...taskItems, ...uniItems].sort((a, b) => a.date.localeCompare(b.date)));
    }
    load();
  }, []);

  if (items === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const today = todayLocalISODate();
  const groups = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const monthKey = item.date.slice(0, 7);
    const list = groups.get(monthKey) ?? [];
    list.push(item);
    groups.set(monthKey, list);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/masters-abroad" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Timeline</h1>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No deadlines yet" description="Deadlines from your tasks and shortlisted universities will appear here." />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([monthKey, monthItems]) => (
            <div key={monthKey} className="space-y-2">
              <h2 className="text-sm font-medium text-text-secondary">
                {MONTH_FORMATTER.format(new Date(`${monthKey}-01T00:00:00`))}
              </h2>
              <div className="space-y-2">
                {monthItems.map((item, i) => (
                  <Card key={i} className="flex flex-row items-center gap-3 border-border bg-surface p-3">
                    <span className={`w-14 shrink-0 text-xs font-medium ${item.date < today ? "text-danger" : "text-primary"}`}>
                      {item.date.slice(8, 10)} {monthKey.slice(5, 7)}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-muted">{item.sublabel}</p>
                    </div>
                    {!item.trusted && <StatusBadge label="Unverified" tone="warning" />}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
