import { Camera } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function ContentPage() {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Content</h1>
      <EmptyState
        icon={Camera}
        title="No content ideas yet"
        description="Generate today's ideas to get 3 Instagram content concepts matched to your photo library."
      />
    </div>
  );
}
