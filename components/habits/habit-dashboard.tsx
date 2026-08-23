"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { todayLocalISODate } from "@/lib/date";
import {
  weeklyCompletionTrend,
  dailyProductivity,
  doneNotDone,
  habitStreaks,
  habitCompletionRates,
  weekdayCompletionRates,
} from "@/lib/habits/stats";
import type { Habit, HabitLog } from "@/lib/types/habits";

const CHART_COLORS = { primary: "#10b981", muted: "#232b29", info: "#38bdf8" };

export function HabitDashboard() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [logs, setLogs] = useState<HabitLog[] | null>(null);
  const today = todayLocalISODate();

  useEffect(() => {
    async function load() {
      const [habitsRes, logsRes] = await Promise.all([
        fetch("/api/habits"),
        fetch(`/api/habits/logs?from=2000-01-01&to=${today}`),
      ]);
      setHabits((await habitsRes.json()).habits ?? []);
      setLogs((await logsRes.json()).logs ?? []);
    }
    load();
  }, [today]);

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

  if (habits === null || logs === null) {
    return (
      <div className="space-y-4">
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

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Completion trend (12 weeks)</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid stroke={CHART_COLORS.muted} vertical={false} />
              <XAxis dataKey="weekStart" tick={{ fontSize: 10, fill: "#6b7674" }} tickFormatter={(v) => v.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#6b7674" }} width={30} />
              <Tooltip
                contentStyle={{ background: "#121716", border: "1px solid #232b29", fontSize: 12 }}
                formatter={(v) => [`${v}%`, "Completion"]}
              />
              <Line type="monotone" dataKey="completionPct" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Daily productivity (30 days)</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productivity}>
              <CartesianGrid stroke={CHART_COLORS.muted} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7674" }} tickFormatter={(v) => v.slice(8)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#6b7674" }} width={30} />
              <Tooltip contentStyle={{ background: "#121716", border: "1px solid #232b29", fontSize: 12 }} />
              <Bar dataKey="completed" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Done vs. not done (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={64}>
                  <Cell fill={CHART_COLORS.primary} />
                  <Cell fill={CHART_COLORS.muted} />
                </Pie>
                <Tooltip contentStyle={{ background: "#121716", border: "1px solid #232b29", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Current streaks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {streaks.map((s) => (
              <div key={s.habitId} className="flex items-center justify-between text-sm">
                <span className="text-text-primary">{s.habitName}</span>
                <span className="font-mono text-primary">{s.current}d</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

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

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="font-medium text-text-primary">{value}</p>
    </div>
  );
}
