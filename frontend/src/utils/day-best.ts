import type { DayBest } from "../types/day-best";
import { isValidIsoDate } from "./date";
import { monthLabel, shortDate, weekdayName } from "./history";

/**
 * The rules of "Das Beste des Tages" on the page: when Heute asks, what a
 * line is, the counter near its limit, and the timeline in months.
 */

/** The longest line, in characters (the server counts the same). */
export const DAY_BEST_MAX_LENGTH = 280;
/** From this many characters on the field shows how many are used. */
export const COUNTER_FROM = 240;
/** Without a setting of one's own Heute asks from 20:00. */
export const DEFAULT_CARD_TIME = "20:00";
/** Months loaded per step of the timeline. */
export const MONTHS_PER_PAGE = 3;

/** "20:00" → 1200; anything else counts as the default time. */
export function minutesOfTime(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return minutesOfTime(DEFAULT_CARD_TIME);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Heute shows the card from the card time to the end of the day. */
export function cardVisible(nowMinutes: number, cardTime: string): boolean {
  return nowMinutes >= minutesOfTime(cardTime);
}

/**
 * The minute at which the card appears, for the clock to wake at; null
 * once it shows.
 */
export function nextCardChange(
  nowMinutes: number,
  cardTime: string,
): number | null {
  const at = minutesOfTime(cardTime);
  return nowMinutes < at ? at : null;
}

/** One line as the server stores it: whitespace collapsed, trimmed. */
export function normalizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** "245 / 280" once the line is near its limit, else null. */
export function counterText(length: number): string | null {
  return length >= COUNTER_FROM ? `${length} / ${DAY_BEST_MAX_LENGTH}` : null;
}

/** Its spoken form: "Noch 35 von 280 Zeichen frei." */
export function counterLabel(length: number): string {
  const left = Math.max(0, DAY_BEST_MAX_LENGTH - length);
  return `Noch ${left} von ${DAY_BEST_MAX_LENGTH} Zeichen frei.`;
}

/** "2026-11" of a day. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** How many days the month has. */
export function daysInMonth(month: string): number {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, index!, 0)).getUTCDate();
}

/** First and last day of a month. */
export function monthRange(month: string): { from: string; to: string } {
  const days = String(daysInMonth(month)).padStart(2, "0");
  return { from: `${month}-01`, to: `${month}-${days}` };
}

/**
 * The days a month offers so far: all of a month that is over, up to today
 * in the running one. Honest about "12 von 23 Tagen" in the middle of it.
 */
export function daysSoFar(month: string, today: string): number {
  if (month === monthOf(today)) return Number(today.slice(8, 10));
  return daysInMonth(month);
}

/** "12 von 30 Tagen", "1 von 1 Tag". */
export function countLine(count: number, days: number): string {
  return `${count} von ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

export type MonthGroup = {
  /** "2026-11" */
  month: string;
  /** "November 2026" */
  label: string;
  /** Newest first. */
  entries: DayBest[];
};

/** Lines (any order) as months, newest month and newest day first. */
export function monthGroups(entries: readonly DayBest[]): MonthGroup[] {
  const byMonth = new Map<string, DayBest[]>();
  for (const entry of [...entries].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const month = monthOf(entry.date);
    const list = byMonth.get(month) ?? [];
    list.push(entry);
    byMonth.set(month, list);
  }
  return [...byMonth.entries()].map(([month, list]) => ({
    month,
    label: monthLabel(`${month}-01`),
    entries: list,
  }));
}

/**
 * The next months to load: up to `size` months with lines, older than the
 * ones already loaded (`loaded`, newest first) and not after `anchor`.
 */
export function nextMonths(
  withEntries: readonly string[],
  anchor: string,
  loaded: readonly string[],
  size = MONTHS_PER_PAGE,
): string[] {
  const oldest = loaded.at(-1) ?? null;
  return withEntries
    .filter((month) => month <= anchor && (oldest === null || month < oldest))
    .slice(0, size);
}

/** The same day a year earlier; 29 February has none. */
export function yearAgo(date: string): string | null {
  const earlier = `${Number(date.slice(0, 4)) - 1}`.padStart(4, "0");
  const result = `${earlier}${date.slice(4)}`;
  return isValidIsoDate(result) ? result : null;
}

/** `?monat=YYYY-MM` when it is a real month not after today's; else null. */
export function monthFromQuery(value: unknown, today: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    return null;
  return value <= monthOf(today) ? value : null;
}

/** `?tag=YYYY-MM-DD` when it is a real day not after today; else null. */
export function dayFromQuery(value: unknown, today: string): string | null {
  if (typeof value !== "string" || !isValidIsoDate(value)) return null;
  return value <= today ? value : null;
}

const SHORT_WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** "Mi" for the date block of a row. */
export function shortWeekday(date: string): string {
  return SHORT_WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!;
}

/** "Mittwoch, 18. Nov." as a row reads aloud and in the Wochenrückblick. */
export function dayName(date: string): string {
  return `${weekdayName(date)}, ${shortDate(date)}`;
}

/** The years a jump can lead to, newest first, from the months with lines. */
export function yearsOf(withEntries: readonly string[]): string[] {
  return [...new Set(withEntries.map((month) => month.slice(0, 4)))];
}
