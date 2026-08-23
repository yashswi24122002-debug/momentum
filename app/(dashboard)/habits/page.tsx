import { CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function HabitsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Habits</h1>
      <EmptyState
        icon={CheckSquare}
        title="No habits yet"
        description="Add your first daily habit to start tracking your streaks and consistency."
      />
    </div>
  );
}
