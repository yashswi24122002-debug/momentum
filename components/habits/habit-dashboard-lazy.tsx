"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is a genuinely heavy dependency with no SSR value here (pure
// client-side charts, no meaningful server-rendered content) — code-split
// it into its own chunk instead of bundling it into every page that could
// reach this route.
export const HabitDashboard = dynamic(() => import("@/components/habits/habit-dashboard").then((m) => m.HabitDashboard), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  ),
});
