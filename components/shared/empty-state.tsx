import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent-muted-bg">
        <Icon className="size-6 text-primary" />
      </div>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <p className="max-w-sm text-sm text-text-secondary">{description}</p>
    </div>
  );
}
