import { BarChart3, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DailyChecklist } from "@/components/habits/daily-checklist";
import { WeeklyTodoCard } from "@/components/habits/weekly-todo-card";

export default function HabitsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Habits</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" render={<Link href="/habits/grid" />} nativeButton={false}>
            <CalendarDays className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" render={<Link href="/habits/dashboard" />} nativeButton={false}>
            <BarChart3 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <DailyChecklist />
        <WeeklyTodoCard />
      </div>
    </div>
  );
}
