"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayLocalISODate } from "@/lib/date";

const CHART_COLORS = { kcal: "#10b981", goal: "#6b7674", protein: "#38bdf8", carbs: "#f59e0b", fat: "#ef4444" };
const AXIS_TICK = { fontSize: 10, fill: "#6b7674" };
const TOOLTIP_STYLE = { background: "#121716", border: "1px solid #232b29", fontSize: 12 };

type DayPoint = { date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; goal: number | null };

export function HistoryPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ days: DayPoint[] } | null>(null);

  useEffect(() => {
    async function load() {
      setData(null);
      const res = await fetch(`/api/calories/history?days=${days}&to=${todayLocalISODate()}`);
      const json = await res.json();
      setData(json);
    }
    load();
  }, [days]);

  if (data === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const chartData = data.days.map((d) => ({ ...d, label: d.date.slice(5) }));

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">History</h1>
        <div className="flex gap-2">
          {[7, 30].map((n) => (
            <Button key={n} variant={days === n ? "default" : "outline"} size="sm" onClick={() => setDays(n)}>
              {n} days
            </Button>
          ))}
        </div>
      </div>

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
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="stepAfter" dataKey="goal" name="Goal" stroke={CHART_COLORS.goal} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
              <Line type="monotone" dataKey="kcal" stroke={CHART_COLORS.kcal} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Macros (g)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b29" />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="protein_g" name="Protein" stroke={CHART_COLORS.protein} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="carbs_g" name="Carbs" stroke={CHART_COLORS.carbs} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="fat_g" name="Fat" stroke={CHART_COLORS.fat} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
