import type { HistoryItem } from "../types/history";
import {
  addDays,
  formatDateForGermanDisplay,
  isValidIsoDate,
  weekStart,
} from "./date";
export { addDays, weekStart };
export function dayLabel(date: string): string {
  const weekday = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return `${weekday}, ${formatDateForGermanDisplay(date)}`;
}
export function supportedHistoryDate(
  date: string,
  view: "day" | "week",
): boolean {
  if (!isValidIsoDate(date) || date < "1000-01-01") return false;
  const start = view === "week" ? weekStart(date) : date;
  return (
    start >= "1000-01-01" &&
    isValidIsoDate(addDays(start, view === "week" ? 7 : 1))
  );
}

export function daySummary(items: HistoryItem[]): string {
  const todos = items.filter((item) => item.type === "todo").length;
  const habits = items.filter(
    (item) => item.type === "habit" && item.status === "completed",
  ).length;
  const skipped = items.filter((item) => item.status === "skipped").length;
  return `${todos} ${todos === 1 ? "Todo" : "Todos"} erledigt · ${habits} ${habits === 1 ? "Habit" : "Habits"} erledigt · ${skipped} übersprungen`;
}
