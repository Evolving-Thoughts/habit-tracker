export type HistoryItem = {
  type: "todo" | "habit";
  id: number;
  habitId: number | null;
  title: string;
  status: "completed" | "skipped";
  date: string;
  scheduledDate: string | null;
  resolvedAt: string | null;
  plannedDurationMinutes: number | null;
  deleted: boolean;
};
export type HistoryPlannedItem = {
  key: string;
  type: "todo" | "habit";
  id: number | null;
  habitId: number | null;
  title: string;
  date: string;
  scheduledDate: string;
  isOverdue: boolean;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  moveUntil: string | null;
};
export type HistoryWeeklyTarget = {
  key: string;
  habitId: number;
  title: string;
  target: number;
  completed: number;
  remaining: number;
  fromDate: string;
  untilDate: string;
};
export type HistoryResponse = {
  today: string;
  timeZone: string;
  startDate: string;
  endDate: string;
  weeklyTargets?: HistoryWeeklyTarget[];
  perfectWeek?: {
    perfect: boolean;
    categories: {
      id: number;
      name: string;
      target: number;
      completed: number;
      reached: boolean;
    }[];
  } | null;
  weekQuota?: { completed: number; total: number; percentage: number } | null;
  days: {
    date: string;
    items: HistoryItem[];
    planned?: HistoryPlannedItem[];
    external?: { id: number; title: string; start: string; end: string }[];
  }[];
};
export type HistoryFilter = "all" | "todos" | "habits";
export type HistoryViewMode = "day" | "week";
