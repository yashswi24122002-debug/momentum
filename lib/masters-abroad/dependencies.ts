import type { Task } from "@/lib/types/masters-abroad";

/** A task is blocked if it has any dependency that isn't done yet. */
export function isTaskBlocked(task: Pick<Task, "depends_on">, allTasks: Task[]): boolean {
  if (!task.depends_on || task.depends_on.length === 0) return false;
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  return task.depends_on.some((depId) => byId.get(depId)?.status !== "done");
}
