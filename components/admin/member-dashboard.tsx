"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { HabitDashboard } from "@/components/habits/habit-dashboard-lazy";
import { fetcher } from "@/lib/swr-fetcher";
import type { Habit, HabitLog } from "@/lib/types/habits";
import type { Idea } from "@/lib/types/ideas";
import type { ContentIdea } from "@/lib/types/content";
import type { University, Task } from "@/lib/types/masters-abroad";
import type { Profile, ToolKey } from "@/lib/types/admin";
import { LayoutGrid } from "lucide-react";

type OutreachRow = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  job_postings: { company: string; role_title: string } | null;
};

type MemberData = {
  enabledTools: ToolKey[];
  habits: Habit[];
  habitLogs: HabitLog[];
  ideas: Idea[];
  content: ContentIdea[];
  universities: University[];
  tasks: Task[];
  outreach: OutreachRow[];
  calories: { totalLogs: number; distinctDays: number; dailyGoal: number | null };
};

const STATUS_TONE: Record<string, StatusTone> = {
  pending: "neutral",
  draft: "neutral",
  researching: "neutral",
  not_started: "neutral",
  approved: "success",
  shortlisted: "info",
  applying: "info",
  in_progress: "info",
  scheduled: "info",
  applied: "success",
  decision: "success",
  done: "success",
  sent: "success",
  replied: "success",
  rejected: "danger",
  blocked: "danger",
};

function tone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "neutral";
}

function GroupedList<T extends { status: string }>({
  emptyLabel,
  items,
  renderTitle,
  renderMeta,
}: {
  emptyLabel: string;
  items: T[];
  renderTitle: (item: T) => string;
  renderMeta: (item: T) => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate text-text-primary">{renderTitle(item)}</p>
            <p className="truncate text-xs text-text-muted">{renderMeta(item)}</p>
          </div>
          <StatusBadge label={item.status.replace(/_/g, " ")} tone={tone(item.status)} />
        </div>
      ))}
    </div>
  );
}

// Pure data content, no page chrome (header/back button) — used both
// embedded inline (edit-user.tsx, alongside the admin controls) and, via
// MemberDashboard below, as a standalone page for a wider full-screen view.
export function MemberDashboardContent({ userId }: { userId: string }) {
  const { data } = useSWR<MemberData>(`/api/admin/users/${userId}/dashboard`, fetcher);

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const enabled = new Set(data.enabledTools);

  if (enabled.size === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No tools enabled yet"
        description="Turn on a tool for this member to see their data here."
      />
    );
  }

  const hasMastersAbroad = enabled.has("masters_abroad");

  return (
    <div className="flex flex-1 flex-col gap-6">
      {enabled.has("habits") && (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm text-text-secondary">
              <LayoutGrid className="size-3.5" />
              Habits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.habits.length === 0 ? (
              <EmptyState icon={LayoutGrid} title="No habits yet" description="This member hasn't added any habits." />
            ) : (
              <HabitDashboard preloadedHabits={data.habits} preloadedLogs={data.habitLogs} />
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {enabled.has("ideas") && (
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle className="text-sm text-text-secondary">Ideas ({data.ideas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupedList
                emptyLabel="No ideas generated yet."
                items={data.ideas}
                renderTitle={(i) => i.title}
                renderMeta={(i) => `${i.category} · ${i.effort_estimate} · ${i.date_generated}`}
              />
            </CardContent>
          </Card>
        )}

        {enabled.has("content") && (
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle className="text-sm text-text-secondary">Content ideas ({data.content.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupedList
                emptyLabel="No content ideas generated yet."
                items={data.content}
                renderTitle={(i) => i.title}
                renderMeta={(i) => `${i.format} · ${i.date_generated}`}
              />
            </CardContent>
          </Card>
        )}

        {hasMastersAbroad && (
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle className="text-sm text-text-secondary">Universities ({data.universities.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupedList
                emptyLabel="No universities added yet."
                items={data.universities}
                renderTitle={(u) => u.name}
                renderMeta={(u) => [u.program_name, u.city].filter(Boolean).join(" · ") || "—"}
              />
            </CardContent>
          </Card>
        )}

        {hasMastersAbroad && (
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle className="text-sm text-text-secondary">Masters tasks ({data.tasks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupedList
                emptyLabel="No tasks yet."
                items={data.tasks}
                renderTitle={(t) => t.title}
                renderMeta={(t) => [t.category, t.deadline].filter(Boolean).join(" · ") || "No deadline"}
              />
            </CardContent>
          </Card>
        )}

        {enabled.has("jobs") && (
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle className="text-sm text-text-secondary">Job outreach ({data.outreach.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupedList
                emptyLabel="No outreach drafted yet."
                items={data.outreach}
                renderTitle={(o) => (o.job_postings ? `${o.job_postings.role_title} @ ${o.job_postings.company}` : "Unknown posting")}
                renderMeta={(o) => (o.sent_at ? `Sent ${o.sent_at.slice(0, 10)}` : `Created ${o.created_at.slice(0, 10)}`)}
              />
            </CardContent>
          </Card>
        )}

        {enabled.has("calories") && (
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle className="text-sm text-text-secondary">Calorie tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Logs</span>
                <span className="text-text-primary">
                  {data.calories.totalLogs} entries over {data.calories.distinctDays} days
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Daily goal</span>
                <span className="text-text-primary">{data.calories.dailyGoal ? `${data.calories.dailyGoal} kcal` : "Not set"}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Standalone full-page version — same content, with its own header/back
// button, for when the inline column (edit-user.tsx) is too cramped or the
// admin wants to link directly to just this view.
export function MemberDashboard({ userId }: { userId: string }) {
  const { data } = useSWR<{ profile: Profile }>(`/api/admin/users/${userId}`, fetcher);
  const name = data?.profile?.display_name || data?.profile?.email || "";

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href={`/admin/users/${userId}`} />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">{name && `${name}'s data`}</h1>
      </div>
      <MemberDashboardContent userId={userId} />
    </div>
  );
}
