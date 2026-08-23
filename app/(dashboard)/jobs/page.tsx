import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function JobsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Jobs</h1>
      <EmptyState
        icon={Briefcase}
        title="No job postings yet"
        description="Postings are aggregated daily from Greenhouse, Lever, RemoteOK, and Adzuna. Check back after the next run."
      />
    </div>
  );
}
