import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function MastersAbroadPage() {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">
        Masters Abroad
      </h1>
      <EmptyState
        icon={GraduationCap}
        title="No application tasks yet"
        description="Seed the default task template to start tracking documents, deadlines, and your university shortlist."
      />
    </div>
  );
}
