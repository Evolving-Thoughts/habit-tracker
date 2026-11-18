import type { HistoryItem, HistoryPlannedItem } from "../types/history";
import { addDays, isValidIsoDate, weekStart } from "./date";
import { formatDuration } from "./today-agenda";
export { addDays, weekStart };

/* Own tables: ICU versions disagree on abbreviations ("Okt" vs "Okt."). */
const SHORT_MONTHS = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sept.",
  "Okt.",
  "Nov.",
  "Dez.",
];
const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const day = (date: string) => Number(date.slice(8, 10));
const monthIndex = (date: string) => Number(date.slice(5, 7)) - 1;

/** "7. Okt." */
export function shortDate(date: string): string {
  return `${day(date)}. ${SHORT_MONTHS[monthIndex(date)]}`;
}

/** "Donnerstag" */
export function weekdayName(date: string): string {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!;
}

/** "Donnerstag, 12. Nov." */
export function dayLabel(date: string): string {
  return `${weekdayName(date)}, ${shortDate(date)}`;
}

/** Ends a sentence once: "… am Mittwoch, 18. Nov." needs no second stop. */
export function fullStop(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

/** "12. November", for screen-reader labels of calendar cells. */
export function longDate(date: string): string {
  return `${day(date)}. ${MONTHS[monthIndex(date)]}`;
}

/** "November 2026" */
export function monthLabel(date: string): string {
  return `${MONTHS[monthIndex(date)]} ${date.slice(0, 4)}`;
}

/** "9.–15. Nov." or "30. Nov. – 6. Dez." for the week containing `date`. */
export function weekLabel(date: string): string {
  const start = weekStart(date);
  const end = addDays(start, 6);
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${day(start)}.–${shortDate(end)}`;
  return `${shortDate(start)} – ${shortDate(end)}`;
}

/** Whether the month, week or day shown around `date` contains `day`. */
export function rangeContains(
  view: "day" | "week" | "month",
  date: string,
  day: string,
): boolean {
  if (!isValidIsoDate(date)) return false;
  if (view === "month") return date.slice(0, 7) === day.slice(0, 7);
  if (view === "week") return weekStart(date) === weekStart(day);
  return date === day;
}

export function supportedHistoryDate(
  date: string,
  view: "day" | "week" | "month",
): boolean {
  if (!isValidIsoDate(date) || date < "1000-01-01") return false;
  if (view === "month") return date.slice(0, 7) <= "9999-11";
  const start = view === "week" ? weekStart(date) : date;
  return (
    start >= "1000-01-01" &&
    isValidIsoDate(addDays(start, view === "week" ? 7 : 1))
  );
}

export type DayCounts = {
  completed: number;
  skipped: number;
  open: number;
  events: number;
};

export function dayCounts(day: {
  items: HistoryItem[];
  planned?: HistoryPlannedItem[];
  external?: unknown[];
}): DayCounts {
  return {
    completed: day.items.filter((item) => item.status === "completed").length,
    skipped: day.items.filter((item) => item.status === "skipped").length,
    open: day.planned?.length ?? 0,
    events: day.external?.length ?? 0,
  };
}

/**
 * Appointments of a day for the month's marker: the app's own (quests with a
 * time, open or done) and the events from Google Kalender.
 */
export function appointmentCount(day: {
  items: HistoryItem[];
  planned?: HistoryPlannedItem[];
  external?: unknown[];
}): number {
  const timed = (entry: { type: string; timeOfDay: string | null }) =>
    entry.type === "todo" && entry.timeOfDay !== null;
  return (
    day.items.filter(timed).length +
    (day.planned ?? []).filter(timed).length +
    (day.external?.length ?? 0)
  );
}

/** Whether a day has anything to show: entries, events or measured work. */
export function hasEntries(day: {
  items: HistoryItem[];
  planned?: HistoryPlannedItem[];
  external?: unknown[];
  work: { minutes: number; logs?: unknown[] };
}): boolean {
  return (
    day.items.length > 0 ||
    (day.planned?.length ?? 0) > 0 ||
    (day.external?.length ?? 0) > 0 ||
    day.work.minutes > 0 ||
    (day.work.logs?.length ?? 0) > 0
  );
}

/**
 * Only the non-zero counts: "2 erledigt · 1 offen". A day without any says
 * "Nichts geplant", and when time was measured anyway it says that too
 * ("Nichts geplant · 2 Std. 10 Min. gemessen"), so the bar beside it does
 * not contradict the words.
 */
export function daySummary(counts: DayCounts, workedMinutes = 0): string {
  const parts = [
    counts.completed && `${counts.completed} erledigt`,
    counts.skipped && `${counts.skipped} übersprungen`,
    counts.open && `${counts.open} offen`,
    counts.events &&
      `${counts.events} ${counts.events === 1 ? "Termin" : "Termine"}`,
  ].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return workedMinutes > 0
    ? `Nichts geplant · ${formatDuration(workedMinutes)} gemessen`
    : "Nichts geplant";
}
