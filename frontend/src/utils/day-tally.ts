import type { DayPlannerItem } from "../types/day-planner";
import type { HistoryItem, HistoryPlannedItem } from "../types/history";

/**
 * How a day is counted, the same in Heute, the Kalender and its week and
 * month (DESIGN.md › Zählregel des Tages):
 *
 * - `completed`: quests and Daily runs completed on this day, wherever they
 *   were planned (a quest from yesterday done today counts today).
 * - `open`: what is still open and planned for this day itself.
 * - `carriedOver`: what is still open from an earlier day ("von früher");
 *   only today has any, since open work always moves on to today.
 * - `skipped`: Daily runs skipped on this day. They count neither as done
 *   nor as planned; a skip is a decision, not work that waits.
 *
 * Planned for the day is `completed + open`, so "1 von 7 erledigt" never
 * hides that something from earlier still waits ("· 1 von früher").
 */
export type DayTally = {
  completed: number;
  open: number;
  carriedOver: number;
  skipped: number;
};

/** Where a day lies from today; it decides which figures the line names. */
export type DayRelation = "past" | "today" | "future";

export function dayRelation(date: string, today: string): DayRelation {
  if (date < today) return "past";
  return date === today ? "today" : "future";
}

/** Heute's day as the planner answers it. */
export function tallyOfPlanner(items: readonly DayPlannerItem[]): DayTally {
  const tally: DayTally = { completed: 0, open: 0, carriedOver: 0, skipped: 0 };
  for (const item of items) {
    if (item.status === "completed") tally.completed += 1;
    else if (item.status === "skipped") tally.skipped += 1;
    else if (item.status === "pending")
      tally[item.isOverdue ? "carriedOver" : "open"] += 1;
  }
  return tally;
}

/** A day of the Kalender as `GET /history` answers it. */
export function tallyOfHistoryDay(day: {
  items: readonly HistoryItem[];
  planned?: readonly HistoryPlannedItem[];
}): DayTally {
  const planned = day.planned ?? [];
  return {
    completed: day.items.filter((item) => item.status === "completed").length,
    skipped: day.items.filter((item) => item.status === "skipped").length,
    open: planned.filter((item) => !item.isOverdue).length,
    carriedOver: planned.filter((item) => item.isOverdue).length,
  };
}

/**
 * The day in one line, or null when there is nothing to count. Today says
 * how much of the planned is done ("1 von 7 erledigt · 1 von früher"); a
 * past day only what was done, since nothing stays open there; a coming day
 * only what is planned ("3 geplant").
 */
export function tallyLine(tally: DayTally, relation: DayRelation): string | null {
  const planned = tally.completed + tally.open;
  const parts: string[] = [];
  if (relation === "today" && planned)
    parts.push(`${tally.completed} von ${planned} erledigt`);
  else if (relation !== "today" && tally.completed)
    parts.push(`${tally.completed} erledigt`);
  if (relation === "future" && tally.open) parts.push(`${tally.open} geplant`);
  if (tally.carriedOver) parts.push(`${tally.carriedOver} von früher`);
  if (tally.skipped) parts.push(`${tally.skipped} übersprungen`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * What a day holds besides its appointments, for the head of a column in
 * the Kalender week: quests and Daily runs without a time, done or still
 * open on that day, counted by the same rule (skipped runs count neither
 * way, and what waits from an earlier day is named apart).
 */
export type UntimedTally = {
  quests: number;
  dailies: number;
  carriedOver: number;
};

export function untimedOfHistoryDay(day: {
  items: readonly HistoryItem[];
  planned?: readonly HistoryPlannedItem[];
}): UntimedTally {
  const tally: UntimedTally = { quests: 0, dailies: 0, carriedOver: 0 };
  const count = (entry: { type: "todo" | "habit"; timeOfDay: string | null }) => {
    if (entry.timeOfDay !== null) return;
    if (entry.type === "todo") tally.quests += 1;
    else tally.dailies += 1;
  };
  for (const item of day.items) if (item.status === "completed") count(item);
  for (const item of day.planned ?? []) {
    if (item.isOverdue) tally.carriedOver += 1;
    else count(item);
  }
  return tally;
}

/** "5 Quests · 2 Dailies · 1 von früher", or null for a day without any. */
export function untimedLine(tally: UntimedTally): string | null {
  const parts: string[] = [];
  if (tally.quests)
    parts.push(`${tally.quests} ${tally.quests === 1 ? "Quest" : "Quests"}`);
  if (tally.dailies)
    parts.push(`${tally.dailies} ${tally.dailies === 1 ? "Daily" : "Dailies"}`);
  if (tally.carriedOver) parts.push(`${tally.carriedOver} von früher`);
  return parts.length ? parts.join(" · ") : null;
}
