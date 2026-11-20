export type HistoryItem = {
  type: "todo" | "habit";
  id: number;
  habitId: number | null;
  title: string;
  categoryName: string | null;
  /** A colour key from `campaign.ts`; null while the name picks one. */
  categoryColor: string | null;
  why: string | null;
  /** The campaign it works towards; null for a loose entry. */
  campaign: Campaign | null;
  status: "completed" | "skipped";
  date: string;
  scheduledDate: string | null;
  resolvedAt: string | null;
  plannedDurationMinutes: number | null;
  /** HH:mm of an appointment or timed daily, as it was planned. */
  timeOfDay: string | null;
  deleted: boolean;
};
export type HistoryPlannedItem = {
  key: string;
  type: "todo" | "habit";
  id: number | null;
  habitId: number | null;
  title: string;
  categoryName: string | null;
  /** A colour key from `campaign.ts`; null while the name picks one. */
  categoryColor: string | null;
  why: string | null;
  /** The campaign it works towards; null for a loose entry. */
  campaign: Campaign | null;
  date: string;
  scheduledDate: string;
  isOverdue: boolean;
  plannedDurationMinutes: number | null;
  /** HH:mm of an appointment or timed daily; null when only the day is set. */
  timeOfDay: string | null;
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
/** Colour and icon are keys from `campaign.ts`. */
export type Campaign = {
  id: number;
  title: string;
  color: string | null;
  icon: string | null;
};
/** One stretch of measured work, at its full length even across midnight. */
export type HistoryWorkLog = {
  id: number;
  title: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  source: "timer" | "manual";
  todoId: number | null;
  occurrenceId: number | null;
  habitId: number | null;
  campaign: Campaign | null;
};
/** A campaign's part of a day's work; `campaign: null` is work without one. */
export type HistoryWorkShare = { campaign: Campaign | null; minutes: number };
/** The Logbuch of a day, cut to the day; overlapping stretches count once. */
export type HistoryDayWork = {
  minutes: number;
  /** Day and week only. */
  campaigns?: HistoryWorkShare[];
  /** Day and week only. */
  logs?: HistoryWorkLog[];
};
/** Share of the week's due runs that were completed. */
export type WeekQuota = { completed: number; total: number; percentage: number };
/** Completions per category against its weekly target. */
export type PerfectWeek = {
  perfect: boolean;
  categories: {
    id: number;
    name: string;
    color: string | null;
    target: number;
    completed: number;
    reached: boolean;
  }[];
};
export type HistoryResponse = {
  today: string;
  timeZone: string;
  startDate: string;
  endDate: string;
  weeklyTargets?: HistoryWeeklyTarget[];
  perfectWeek?: PerfectWeek | null;
  weekQuota?: WeekQuota | null;
  days: {
    date: string;
    items: HistoryItem[];
    planned?: HistoryPlannedItem[];
    external?: { id: number; title: string; start: string; end: string }[];
    work: HistoryDayWork;
  }[];
};
export type HistoryFilter = "all" | "todos" | "habits";
export type HistoryViewMode = "day" | "week";
