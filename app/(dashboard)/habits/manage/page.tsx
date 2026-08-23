import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManageHabitsList } from "@/components/habits/manage-habits-list";

export default function ManageHabitsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/habits" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Manage habits</h1>
      </div>
      <ManageHabitsList />
    </div>
  );
}
