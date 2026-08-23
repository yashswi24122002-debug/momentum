"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Archive, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Habit } from "@/lib/types/habits";

function SortableHabitRow({
  habit,
  onRename,
  onArchive,
}: {
  habit: Habit;
  onRename: (id: string, name: string) => void;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: habit.id });
  const [name, setName] = useState(habit.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="flex flex-row items-center gap-2 border-border bg-surface p-3"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== habit.name) onRename(habit.id, name.trim());
        }}
        className="flex-1"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-text-muted hover:text-danger"
        onClick={() => onArchive(habit.id)}
      >
        <Archive className="size-4" />
      </Button>
    </Card>
  );
}

export function ManageHabitsList() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [newName, setNewName] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    fetch("/api/habits")
      .then((r) => r.json())
      .then((json) => setHabits(json.habits ?? []));
  }, []);

  async function addHabit(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (!res.ok) {
      toast.error("Couldn't add that habit — try again.");
      return;
    }

    const { habit } = await res.json();
    setHabits((prev) => [...(prev ?? []), habit]);
    setNewName("");
  }

  async function renameHabit(id: string, name: string) {
    setHabits((prev) => prev?.map((h) => (h.id === id ? { ...h, name } : h)) ?? null);
    const res = await fetch(`/api/habits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) toast.error("Couldn't rename that habit — try again.");
  }

  async function archiveHabit(id: string) {
    const previous = habits;
    setHabits((prev) => prev?.filter((h) => h.id !== id) ?? null);
    const res = await fetch(`/api/habits/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setHabits(previous);
      toast.error("Couldn't archive that habit — try again.");
    } else {
      toast.success("Habit archived — its history is preserved.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !habits) return;

    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    const reordered = arrayMove(habits, oldIndex, newIndex);
    setHabits(reordered);

    await Promise.all(
      reordered.map((habit, index) =>
        fetch(`/api/habits/${habit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: index }),
        })
      )
    );
  }

  if (habits === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addHabit} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New habit name"
        />
        <Button type="submit" size="icon">
          <Plus className="size-4" />
        </Button>
      </form>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {habits.map((habit) => (
              <SortableHabitRow
                key={habit.id}
                habit={habit}
                onRename={renameHabit}
                onArchive={archiveHabit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
