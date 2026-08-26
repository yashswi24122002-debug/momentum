"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, ListChecks, CalendarDays, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { addDays, todayLocalISODate } from "@/lib/date";
import type { Task, University } from "@/lib/types/masters-abroad";

const QUICK_LINKS = [
  { href: "/masters-abroad/universities", label: "Universities", icon: GraduationCap },
  { href: "/masters-abroad/tasks", label: "Tasks", icon: ListChecks },
  { href: "/masters-abroad/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/masters-abroad/documents", label: "Documents", icon: FileText },
];

export function MastersAbroadDashboard() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [universities, setUniversities] = useState<University[] | null>(null);

  useEffect(() => {
    async function load() {
      const [tasksRes, universitiesRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/universities")]);
      setTasks((await tasksRes.json()).tasks ?? []);
      setUniversities((await universitiesRes.json()).universities ?? []);
    }
    load();
  }, []);

  if (tasks === null || universities === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const today = todayLocalISODate();
  const in30Days = addDays(today, 30);
  const upcoming = tasks
    .filter((t) => t.deadline && t.status !== "done" && t.deadline >= today && t.deadline <= in30Days)
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string));

  const completedCount = tasks.filter((t) => t.status === "done").length;
  const completionPct = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
  const shortlistedCount = universities.filter((u) => u.status !== "researching").length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-xl font-semibold text-text-primary">Masters Abroad</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="items-center gap-1.5 border-border bg-surface p-4 text-center transition-colors hover:bg-surface-hover">
              <Icon className="size-5 text-primary" />
              <p className="text-sm font-medium text-text-primary">{label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Task completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-primary">
              {completedCount} of {tasks.length} done
            </span>
            <span className="font-semibold text-primary">{completionPct}%</span>
          </div>
          <Progress value={completionPct} />
          <p className="text-xs text-text-muted">{shortlistedCount} universit{shortlistedCount === 1 ? "y" : "ies"} beyond researching</p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Upcoming deadlines (next 30 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-text-secondary">Nothing due in the next 30 days.</p>
          ) : (
            upcoming.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg bg-background p-2.5 text-sm">
                <span className="text-text-primary">{task.title}</span>
                <span className="text-text-muted">{task.deadline}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
