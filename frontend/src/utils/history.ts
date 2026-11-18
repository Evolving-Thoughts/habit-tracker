import type { HistoryItem, HistoryPlannedItem } from "../types/history";
import { addDays, isValidIsoDate, weekStart } from "./date";
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

/** Only the non-zero counts: "2 erledigt · 1 offen", or "Nichts geplant". */
export function daySummary(counts: DayCounts): string {
  const parts = [
    counts.completed && `${counts.completed} erledigt`,
    counts.skipped && `${counts.skipped} übersprungen`,
    counts.open && `${counts.open} offen`,
    counts.events &&
      `${counts.events} ${counts.events === 1 ? "Termin" : "Termine"}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nichts geplant";
}
