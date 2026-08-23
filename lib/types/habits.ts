export type Habit = {
  id: string;
  name: string;
  category: string | null;
  active: boolean;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  logged_at: string;
};

export type WeeklyTodoTask = {
  text: string;
  done: boolean;
};

export type WeeklyTodo = {
  id: string;
  week_start_date: string;
  top_priority: string | null;
  top_3_tasks: WeeklyTodoTask[];
};
