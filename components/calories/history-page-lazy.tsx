"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Same reasoning as habit-dashboard-lazy.tsx — recharts code-split out of
// the main bundle, no SSR needed for a pure client-side chart page.
export const HistoryPage = dynamic(() => import("@/components/calories/history-page").then((m) => m.HistoryPage), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  ),
});
