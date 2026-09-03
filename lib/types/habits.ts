export type Habit = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  active: boolean;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
  /** Weekdays this habit applies to, 0=Sun..6=Sat (matches Date#getDay()). All 7 = daily. */
  frequency_days: number[];
  color: string | null;
  /** "HH:MM:SS" (Postgres time), local IST — null means no reminder set. */
  reminder_time: string | null;
  /** "checkin" fires unconditionally with Yes/No actions; "nudge" only fires if not yet completed that day. */
  reminder_style: "checkin" | "nudge" | null;
  reminder_sent_on: string | null;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  logged_at: string;
  /** Marked as an excused day (sick, travel, etc.) — doesn't break a streak. */
  excused: boolean;
  note: string | null;
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
