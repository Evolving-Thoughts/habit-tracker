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
export type HistoryResponse = {
  today: string;
  timeZone: string;
  startDate: string;
  endDate: string;
  days: { date: string; items: HistoryItem[] }[];
};
export type HistoryFilter = "all" | "todos" | "habits";
export type HistoryView = "day" | "week";
