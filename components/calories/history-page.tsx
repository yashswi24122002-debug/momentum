"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, X, Plane, ArrowUp, ArrowDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/swr-fetcher";
import { todayLocalISODate } from "@/lib/date";
import { cn } from "@/lib/utils";

const CHART_COLORS = {
  kcal: "#10b981",
  goal: "#6b7674",
  protein: "#38bdf8",
  carbs: "#f59e0b",
  fat: "#ef4444",
};
const AXIS_TICK = { fontSize: 10, fill: "#6b7674" };
const TOOLTIP_STYLE = { background: "#121716", border: "1px solid #232b29", fontSize: 12 };
const LEGEND_STYLE = { fontSize: 11, color: "#9ca8a4" };

type DayPoint = {
  date: string;
  leave: boolean;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  goal: number | null;
  protein_goal_g: number | null;
  carbs_goal_g: number | null;
  fat_goal_g: number | null;
};

const RANGE_OPTIONS = [7, 30, 90];
// Within this many kcal of goal either direction counts as "on track" — a
// day isn't a pass/fail against the exact number, just close enough.
const ADHERENCE_TOLERANCE_KCAL = 250;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function round(n: number): number {
  return Math.round(n);
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
    </div>
  );
}

export function HistoryPage() {
  const [days, setDays] = useState(30);
  const { data } = useSWR<{ days: DayPoint[] }>(
    `/api/calories/history?days=${days}&to=${todayLocalISODate()}`,
    fetcher
  );

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // "Trackable" mirrors the adherence stats below: a leave day, or a day
  // nothing was logged at all yet, isn't a real data point — nulled out so
  // the line chart bridges over it (connectNulls) instead of either
  // breaking or drawing a misleading dip to zero/way-under-goal.
  const chartData = data.days.map((d) => {
    const trackableDay = !d.leave && d.kcal !== null && d.kcal > 0 && d.goal !== null;
    return { ...d, label: d.date.slice(5), delta: trackableDay ? d.kcal! - d.goal! : null };
  });

  // Trackable = actually logged something that day (leave days are excused
  // entirely; a day with 0 kcal and not on leave just means nothing was
  // logged yet, not "hit goal", so it's excluded rather than counted as a
  // false win).
  const trackable = data.days.filter((d) => !d.leave && d.kcal !== null && d.kcal > 0 && d.goal !== null);
  const onTrackDays = trackable.filter((d) => Math.abs(d.kcal! - d.goal!) <= ADHERENCE_TOLERANCE_KCAL);
  const overDays = trackable.filter((d) => d.kcal! - d.goal! > ADHERENCE_TOLERANCE_KCAL);
  const underDays = trackable.filter((d) => d.goal! - d.kcal! > ADHERENCE_TOLERANCE_KCAL);
  const avgKcal = trackable.length ? round(trackable.reduce((s, d) => s + d.kcal!, 0) / trackable.length) : null;
  const avgGoal = trackable.length ? round(trackable.reduce((s, d) => s + d.goal!, 0) / trackable.length) : null;
  const leaveDays = data.days.filter((d) => d.leave).length;

  const weeklyBuckets = chunk(data.days, 7).map((bucket) => {
    const label = `${bucket[0].date.slice(5)}–${bucket[bucket.length - 1].date.slice(5)}`;
    const trackedInBucket = bucket.filter((d) => !d.leave && d.kcal !== null && d.kcal > 0 && d.goal !== null);
    const avgConsumed = trackedInBucket.length
      ? round(trackedInBucket.reduce((s, d) => s + d.kcal!, 0) / trackedInBucket.length)
      : null;
    const avgGoalInBucket = trackedInBucket.length
      ? round(trackedInBucket.reduce((s, d) => s + d.goal!, 0) / trackedInBucket.length)
      : null;
    return { label, avgConsumed, avgGoal: avgGoalInBucket };
  });

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">History</h1>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((n) => (
            <Button key={n} variant={days === n ? "default" : "outline"} size="sm" onClick={() => setDays(n)}>
              {n} days
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Adherence</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="On track" value={String(onTrackDays.length)} sub={`within ${ADHERENCE_TOLERANCE_KCAL} kcal`} />
          <StatTile label="Over goal" value={String(overDays.length)} sub={`by more than ${ADHERENCE_TOLERANCE_KCAL}`} />
          <StatTile label="Under goal" value={String(underDays.length)} sub={`by more than ${ADHERENCE_TOLERANCE_KCAL}`} />
          <StatTile label="Avg intake" value={avgKcal !== null ? `${avgKcal} kcal` : "—"} sub={avgGoal !== null ? `goal avg ${avgGoal}` : undefined} />
          <StatTile label="Leave days" value={String(leaveDays)} sub="excluded from stats" />
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Day by day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {chartData.map((d) => {
              const isFuture = d.date > todayLocalISODate();
              const isTrackable = !d.leave && !isFuture && d.kcal !== null && d.kcal > 0 && d.goal !== null;
              const noData = !d.leave && !isFuture && !isTrackable;
              const diff = isTrackable ? d.kcal! - d.goal! : 0;
              const onTrack = isTrackable && Math.abs(diff) <= ADHERENCE_TOLERANCE_KCAL;
              const over = isTrackable && diff > ADHERENCE_TOLERANCE_KCAL;
              const under = isTrackable && diff < -ADHERENCE_TOLERANCE_KCAL;
              return (
                <div
                  key={d.date}
                  title={d.date}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    isFuture && "bg-background",
                    d.leave && "bg-surface-hover",
                    noData && "bg-background",
                    onTrack && "bg-accent-muted-bg",
                    over && "bg-danger/10",
                    under && "bg-info/10"
                  )}
                >
                  {d.leave ? (
                    <Plane className="size-3.5 text-text-muted" />
                  ) : onTrack ? (
                    <Check className="size-3.5 text-primary" />
                  ) : over ? (
                    <ArrowUp className="size-3.5 text-danger" />
                  ) : under ? (
                    <ArrowDown className="size-3.5 text-info" />
                  ) : noData ? (
                    <X className="size-3.5 text-text-muted/50" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Calories vs goal</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b29" />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={{ color: "#e5e9e7" }}
                labelStyle={{ color: "#e5e9e7" }}
                formatter={(value, _name, props) => {
                  const point = props.payload as DayPoint;
                  if (point.leave) return ["On leave", "vs goal"];
                  if (typeof value !== "number") return ["Nothing logged", "vs goal"];
                  return [`${value > 0 ? "+" : ""}${value} kcal (goal ${point.goal})`, "vs goal"];
                }}
              />
              <ReferenceLine y={0} stroke={CHART_COLORS.goal} strokeDasharray="4 4" label={{ value: "Goal", position: "insideTopLeft", fill: "#9ca8a4", fontSize: 10 }} />
              <Line type="monotone" dataKey="delta" name="vs goal" stroke={CHART_COLORS.kcal} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-text-muted">
            Above the line is over goal, below is under — since your goal changes over time, this tracks the gap
            directly instead of drawing a wobbly goal line.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Macros vs goal (g)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b29" />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e5e9e7" }} labelStyle={{ color: "#e5e9e7" }} />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Line type="stepAfter" dataKey="protein_goal_g" name="Protein goal" stroke={CHART_COLORS.protein} strokeWidth={1} strokeDasharray="4 4" dot={false} connectNulls legendType="none" />
              <Line type="monotone" dataKey="protein_g" name="Protein" stroke={CHART_COLORS.protein} strokeWidth={2} dot={false} connectNulls />
              <Line type="stepAfter" dataKey="carbs_goal_g" name="Carbs goal" stroke={CHART_COLORS.carbs} strokeWidth={1} strokeDasharray="4 4" dot={false} connectNulls legendType="none" />
              <Line type="monotone" dataKey="carbs_g" name="Carbs" stroke={CHART_COLORS.carbs} strokeWidth={2} dot={false} connectNulls />
              <Line type="stepAfter" dataKey="fat_goal_g" name="Fat goal" stroke={CHART_COLORS.fat} strokeWidth={1} strokeDasharray="4 4" dot={false} connectNulls legendType="none" />
              <Line type="monotone" dataKey="fat_g" name="Fat" stroke={CHART_COLORS.fat} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-text-muted">Dashed lines are each macro&apos;s goal — solid is what you ate.</p>
        </CardContent>
      </Card>

      {weeklyBuckets.length > 1 && (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Weekly average</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232b29" />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e5e9e7" }} labelStyle={{ color: "#e5e9e7" }} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar dataKey="avgConsumed" name="Avg consumed" fill={CHART_COLORS.kcal} radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgGoal" name="Avg goal" fill={CHART_COLORS.goal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
