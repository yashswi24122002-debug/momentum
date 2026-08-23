import { Lightbulb } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function IdeasPage() {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Ideas</h1>
      <EmptyState
        icon={Lightbulb}
        title="No ideas generated yet"
        description="Generate today's ideas to get 3 project concepts sourced from trending tech signals."
      />
    </div>
  );
}
