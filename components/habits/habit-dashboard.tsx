"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/swr-fetcher";
import { todayLocalISODate } from "@/lib/date";
import { ContributionHeatmap } from "@/components/habits/contribution-heatmap";
import {
  weeklyCompletionTrend,
  dailyProductivity,
  doneNotDone,
  habitStreaks,
  habitCompletionRates,
  weekdayCompletionRates,
  completionByCategory,
  contributionHeatmap,
  overallStats,
} from "@/lib/habits/stats";
import type { Habit, HabitLog } from "@/lib/types/habits";

const CHART_COLORS = { primary: "#10b981", muted: "#232b29", info: "#38bdf8" };
const PALETTE = ["#10b981", "#38bdf8", "#f59e0b", "#ef4444", "#34d399", "#0ea5e9"];
const AXIS_TICK = { fontSize: 10, fill: "#6b7674" };
const TOOLTIP_STYLE = { background: "#121716", border: "1px solid #232b29", fontSize: 12 };
// Recharts colors each tooltip row using that series' own data color by
// default — invisible for a series like "Not done" whose color is nearly
// the same dark gray as the tooltip background. Force a fixed light color
// for every row instead of trusting per-series contrast.
const TOOLTIP_TEXT_STYLE = { color: "#e5e7eb" };

// Pass preloadedHabits/preloadedLogs to render another user's data (e.g. the
// admin's read-only member dashboard) instead of self-fetching the caller's
// own /api/habits — every chart and stat below is a pure function of these
// two arrays, so no other change is needed to reuse this for anyone's data.
export function HabitDashboard({
  preloadedHabits,
  preloadedLogs,
}: { preloadedHabits?: Habit[]; preloadedLogs?: HabitLog[] } = {}) {
  const today = todayLocalISODate();
  const skipFetch = Boolean(preloadedHabits && preloadedLogs);

  const { data: habitsData } = useSWR<{ habits: Habit[] }>(skipFetch ? null : "/api/habits", fetcher);
  const { data: logsData } = useSWR<{ logs: HabitLog[] }>(
    skipFetch ? null : `/api/habits/logs?from=2000-01-01&to=${today}`,
    fetcher
  );

  const habits = skipFetch ? preloadedHabits! : (habitsData?.habits ?? null);
  const logs = skipFetch ? preloadedLogs! : (logsData?.logs ?? null);

  const trend = useMemo(
    () => (habits && logs ? weeklyCompletionTrend(habits, logs, today) : []),
    [habits, logs, today]
  );
  const productivity = useMemo(
    () => (logs ? dailyProductivity(logs, today) : []),
    [logs, today]
  );
  const doneVsNot = useMemo(
    () => (habits && logs ? doneNotDone(habits, logs, today) : { done: 0, notDone: 0 }),
    [habits, logs, today]
  );
  const streaks = useMemo(
    () => (habits && logs ? habitStreaks(habits, logs, today) : []),
    [habits, logs, today]
  );
  const completionRates = useMemo(
    () => (habits && logs ? habitCompletionRates(habits, logs, today) : []),
    [habits, logs, today]
  );
  const weekdayRates = useMemo(
    () => (habits && logs ? weekdayCompletionRates(habits, logs, today) : []),
    [habits, logs, today]
  );
  const categoryRates = useMemo(
    () => (habits && logs ? completionByCategory(habits, logs, today) : []),
    [habits, logs, today]
  );
  const heatmapCells = useMemo(
    () => (habits && logs ? contributionHeatmap(habits, logs, today) : []),
    [habits, logs, today]
  );
  const stats = useMemo(
    () => (habits && logs ? overallStats(habits, logs, today) : null),
    [habits, logs, today]
  );

  if (habits === null || logs === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (habits.length === 0) {
    return <p className="text-sm text-text-secondary">Add habits to see insights here.</p>;
  }

  const bestHabit = completionRates.reduce((a, b) => (b.pct > a.pct ? b : a), completionRates[0]);
  const worstHabit = completionRates.reduce((a, b) => (b.pct < a.pct ? b : a), completionRates[0]);
  const bestDay = weekdayRates.reduce((a, b) => (b.pct > a.pct ? b : a), weekdayRates[0]);
  const worstDay = weekdayRates.reduce((a, b) => (b.pct < a.pct ? b : a), weekdayRates[0]);
  const longestCurrentStreak = streaks.reduce((a, b) => (b.current > a.current ? b : a), streaks[0]);

  const pieData = [
    { name: "Done", value: doneVsNot.done },
    { name: "Not done", value: doneVsNot.notDone },
  ];
  const habitBarData = [...completionRates].sort((a, b) => b.pct - a.pct);
  const streakBarData = [...streaks].sort((a, b) => b.longest - a.longest);

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Habits" value={String(stats.totalHabits)} />
          <StatCard label="Today" value={`${stats.todayPct}%`} />
          <StatCard label="This week" value={`${stats.weekPct}%`} />
          <StatCard label="Best active streak" value={`${stats.longestActiveStreak}d`} />
          <StatCard label="Total check-ins" value={String(stats.totalCheckins)} />
        </div>
      )}

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Activity ({heatmapCells.length / 7} weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          <ContributionHeatmap cells={heatmapCells} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Completion trend (12 weeks)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke={CHART_COLORS.muted} vertical={false} />
                <XAxis dataKey="weekStart" tick={AXIS_TICK} tickFormatter={(v) => v.slice(5)} />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} width={30} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} formatter={(v) => [`${v}%`, "Completion"]} />
                <Line type="monotone" dataKey="completionPct" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Completion by category (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryRates}
                  dataKey="pct"
                  nameKey="category"
                  innerRadius={40}
                  outerRadius={64}
                  label={(entry) => `${entry.name} ${entry.value}%`}
                  labelLine={false}
                >
                  {categoryRates.map((entry, i) => (
                    <Cell key={entry.category} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} formatter={(v) => [`${v}%`, "Completion"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Daily productivity (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivity}>
                <CartesianGrid stroke={CHART_COLORS.muted} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(v) => v.slice(8)} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} width={30} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} />
                <Bar dataKey="completed" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Completion by weekday (12 weeks)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayRates}>
                <CartesianGrid stroke={CHART_COLORS.muted} vertical={false} />
                <XAxis dataKey="weekday" tick={AXIS_TICK} />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} width={30} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} formatter={(v) => [`${v}%`, "Completion"]} />
                <Bar dataKey="pct" fill={CHART_COLORS.info} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Done vs. not done (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={64}>
                  <Cell fill={CHART_COLORS.primary} />
                  <Cell fill={CHART_COLORS.muted} />
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca8a5" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Current vs. longest streak</CardTitle>
          </CardHeader>
          <CardContent style={{ height: Math.max(56 * streakBarData.length, 160) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streakBarData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke={CHART_COLORS.muted} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
                <YAxis
                  type="category"
                  dataKey="habitName"
                  tick={AXIS_TICK}
                  width={90}
                  tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca8a5" }} />
                <Bar dataKey="current" name="Current" fill={CHART_COLORS.primary} radius={[0, 3, 3, 0]} />
                <Bar dataKey="longest" name="Longest" fill={CHART_COLORS.info} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Completion by habit (30 days)</CardTitle>
        </CardHeader>
        <CardContent style={{ height: Math.max(40 * habitBarData.length, 160) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={habitBarData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={CHART_COLORS.muted} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} />
              <YAxis
                type="category"
                dataKey="habitName"
                tick={AXIS_TICK}
                width={110}
                tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} formatter={(v) => [`${v}%`, "Completion"]} />
              <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
                {habitBarData.map((entry) => (
                  <Cell key={entry.habitId} fill={entry.pct >= 70 ? CHART_COLORS.primary : entry.pct >= 40 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Insights</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Insight label="Best habit" value={`${bestHabit.habitName} (${bestHabit.pct}%)`} />
          <Insight label="Needs attention" value={`${worstHabit.habitName} (${worstHabit.pct}%)`} />
          <Insight label="Best day" value={`${bestDay.weekday} (${bestDay.pct}%)`} />
          <Insight label="Toughest day" value={`${worstDay.weekday} (${worstDay.pct}%)`} />
          <Insight
            label="Longest current streak"
            value={`${longestCurrentStreak.habitName} — ${longestCurrentStreak.current}d`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border bg-surface py-3">
      <CardContent className="px-4">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="font-medium text-text-primary">{value}</p>
    </div>
  );
}
