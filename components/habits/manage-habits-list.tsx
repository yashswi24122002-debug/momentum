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
import { GripVertical, Archive, Plus, BellRing, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FrequencyPicker } from "@/components/habits/frequency-picker";
import { ColorPicker } from "@/components/habits/color-picker";
import { PushNotificationToggle } from "@/components/habits/push-notification-toggle";
import { ALL_WEEKDAYS, scheduleLabel } from "@/lib/habits/schedule";
import type { Habit } from "@/lib/types/habits";

type ReminderUpdate = Partial<Pick<Habit, "frequency_days" | "color" | "reminder_time" | "reminder_style">>;

function SortableHabitRow({
  habit,
  onRename,
  onArchive,
  onUpdate,
}: {
  habit: Habit;
  onRename: (id: string, name: string) => void;
  onArchive: (id: string) => void;
  onUpdate: (id: string, updates: ReminderUpdate) => void;
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
      className="flex flex-col gap-3 border-border bg-surface p-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-text-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: habit.color ?? "var(--brand)" }}
        />
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
      </div>

      <div className="flex flex-wrap items-center gap-3 pl-6">
        <div className="flex items-center gap-2">
          <FrequencyPicker
            value={habit.frequency_days}
            onChange={(frequency_days) => onUpdate(habit.id, { frequency_days })}
          />
          <span className="text-[11px] text-text-muted">{scheduleLabel(habit.frequency_days)}</span>
        </div>
      </div>
      <div className="pl-6">
        <ColorPicker value={habit.color} onChange={(color) => onUpdate(habit.id, { color })} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-6">
        <BellRing className="size-3.5 text-text-muted" />
        <Input
          type="time"
          value={habit.reminder_time?.slice(0, 5) ?? ""}
          onChange={(e) =>
            onUpdate(habit.id, { reminder_time: e.target.value || null, reminder_style: e.target.value ? habit.reminder_style ?? "nudge" : null })
          }
          className="w-28"
        />
        {habit.reminder_time && (
          <>
            <Select
              value={habit.reminder_style ?? "nudge"}
              onValueChange={(v) => v && onUpdate(habit.id, { reminder_style: v as "checkin" | "nudge" })}
            >
              <SelectTrigger size="sm" className="w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nudge">Nudge if not done</SelectItem>
                <SelectItem value="checkin">Check-in (Yes/No)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-text-muted hover:text-danger"
              onClick={() => onUpdate(habit.id, { reminder_time: null, reminder_style: null })}
            >
              <X className="size-4" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

export function ManageHabitsList() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState<number[]>(ALL_WEEKDAYS);
  const [newColor, setNewColor] = useState<string | null>(null);
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
      body: JSON.stringify({ name: newName.trim(), frequency_days: newFrequency, color: newColor }),
    });

    if (!res.ok) {
      toast.error("Couldn't add that habit — try again.");
      return;
    }

    const { habit } = await res.json();
    setHabits((prev) => [...(prev ?? []), habit]);
    setNewName("");
    setNewFrequency(ALL_WEEKDAYS);
    setNewColor(null);
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

  async function updateHabit(id: string, updates: ReminderUpdate) {
    const previous = habits;
    setHabits((prev) => prev?.map((h) => (h.id === id ? { ...h, ...updates } : h)) ?? null);
    const res = await fetch(`/api/habits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      setHabits(previous);
      toast.error("Couldn't update that habit — try again.");
    }
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
      <PushNotificationToggle />

      <form onSubmit={addHabit} className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New habit name"
          />
          <Button type="submit" size="icon">
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FrequencyPicker value={newFrequency} onChange={setNewFrequency} />
          <span className="text-[11px] text-text-muted">{scheduleLabel(newFrequency)}</span>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} />
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
                onUpdate={updateHabit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
