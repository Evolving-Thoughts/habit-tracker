import type { MonthChallenge } from "../types/month-challenge";
import { APP_TIME_ZONE, getCurrentDateInTimeZone } from "./date";
import { monthLabel, shortDate } from "./history";

/**
 * The words of the Monats-Challenge: its progress while it runs, its result
 * once closed, and its months. Numbers, never warnings (DESIGN.md).
 */

/** From this day of the month on, next month's challenge can be set. */
export const PREPARE_FROM_DAY = 16;

/** The address of the challenge section in the Dailies. */
export const CHALLENGE_HREF = "#/dailies?abschnitt=challenge";

/** "November" for "2026-11". */
export function monthName(month: string): string {
  return monthLabel(`${month}-01`).split(" ")[0]!;
}

/** "November 2026" for "2026-11". */
export function monthTitle(month: string): string {
  return monthLabel(`${month}-01`);
}

/** "2026-11" of a day. */
export function monthKeyOf(day: string): string {
  return day.slice(0, 7);
}

/** The month after `month` ("2026-12" → "2027-01"). */
export function nextMonthKey(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return index === 12
    ? `${year! + 1}-01`
    : `${year}-${String(index! + 1).padStart(2, "0")}`;
}

/** Whether next month's challenge can be set already: in the second half. */
export function canPrepareNext(today: string): boolean {
  return Number(today.slice(8, 10)) >= PREPARE_FROM_DAY;
}

/** How many days are left in the month from `today`, today included. */
export function daysLeftInMonth(today: string): number {
  const [year, index] = today.split("-").map(Number);
  const last = new Date(Date.UTC(year!, index!, 0)).getUTCDate();
  return last - Number(today.slice(8, 10)) + 1;
}

/**
 * While it runs: "Tag 12 · 11 von 12 geschafft · noch 18". The second part
 * counts the runs decided so far (today's open run is not among them), the
 * last one what can still be done, today's open run included.
 */
export function progressLine(challenge: MonthChallenge): string {
  const decided = challenge.done + challenge.missed;
  const parts: string[] = [];
  if (challenge.day !== null) parts.push(`Tag ${challenge.day}`);
  if (decided > 0) parts.push(`${challenge.done} von ${decided} geschafft`);
  if (challenge.remaining > 0) parts.push(`noch ${challenge.remaining}`);
  return parts.join(" · ");
}

/**
 * The challenge in the meta line of its run on Heute (row and focus card):
 * "Monats-Challenge · Tag 2 · noch 4", the progress as `progressLine` has it.
 */
export function runLine(challenge: MonthChallenge): string {
  const progress = progressLine(challenge);
  return progress ? `Monats-Challenge · ${progress}` : "Monats-Challenge";
}

/** "1 Lauf", "3 Läufe". */
function runs(count: number): string {
  return `${count} ${count === 1 ? "Lauf" : "Läufe"}`;
}

/** The short result of a closed challenge for lists: "Geschafft" or "90 %". */
export function resultLabel(challenge: MonthChallenge): string {
  if (challenge.status === "succeeded") return "Geschafft";
  if (challenge.total === 0) return "Nichts fällig";
  return `${challenge.percent} %`;
}

/** The day an ended challenge ended, in Berlin. */
function endedOn(challenge: MonthChallenge): string | null {
  return challenge.endedAt
    ? getCurrentDateInTimeZone(APP_TIME_ZONE, new Date(challenge.endedAt))
    : null;
}

/**
 * The whole line under a challenge's title, whatever its state:
 * - running: its progress;
 * - to come: from when and how many runs;
 * - done: "Geschafft · 30 von 30";
 * - over below 100 %: "90 % geschafft (27 von 30)";
 * - ended early: "Beendet am 14. Nov. · 1 von 2 geschafft".
 */
export function statusLine(challenge: MonthChallenge): string {
  switch (challenge.status) {
    case "running":
      return progressLine(challenge);
    case "upcoming":
      return `Ab ${shortDate(challenge.startDate)} · ${runs(challenge.total)} fällig`;
    case "succeeded":
      return `Geschafft · ${challenge.done} von ${challenge.total}`;
    case "finished":
      return challenge.total === 0
        ? "Nichts war fällig"
        : `${challenge.percent} % geschafft (${challenge.done} von ${challenge.total})`;
    case "ended": {
      const day = endedOn(challenge);
      const when = day ? `Beendet am ${shortDate(day)}` : "Beendet";
      return challenge.total === 0
        ? when
        : `${when} · ${challenge.done} von ${challenge.total} geschafft`;
    }
  }
}

/** What the bar says to a screen reader: "11 von 30 Läufen geschafft". */
export function barText(challenge: MonthChallenge): string {
  return `${challenge.done} von ${challenge.total} ${challenge.total === 1 ? "Lauf" : "Läufen"} geschafft`;
}

/** The bar's filled share in percent, 0–100. */
export function barShare(challenge: MonthChallenge): number {
  return challenge.total > 0
    ? Math.min(100, (challenge.done / challenge.total) * 100)
    : 0;
}
