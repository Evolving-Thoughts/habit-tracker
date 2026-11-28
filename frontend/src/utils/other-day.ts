import type { DayPlannerItem } from "../types/day-planner";
import type { WeekPlanEntry, WeekPlanOwnEntry } from "../types/week-plan";
import type { DayTally } from "./day-tally";

/*
 * Heute on another day (‹ › in its head, docs/day-order.md › Andere Tage).
 * The day comes from the Plan's read (`GET /day-planner/plan`, one day), so
 * a past day shows what was done and a later day what is planned, with the
 * daily runs the schedule forecasts. Its cards wear Heute's look.
 */

/** "Gestern", "Morgen", "in 3 Tagen", "vor 5 Tagen"; null for today. */
export function relationLabel(date: string, today: string): string | null {
  const days = Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
  if (days === 0) return null;
  if (days === -1) return "Gestern";
  if (days === 1) return "Morgen";
  if (days === -2) return "Vorgestern";
  if (days === 2) return "Übermorgen";
  return days < 0 ? `vor ${-days} Tagen` : `in ${days} Tagen`;
}

/** The day counted like every view counts one. */
export function tallyOfEntries(entries: readonly WeekPlanEntry[]): DayTally {
  const tally: DayTally = { completed: 0, open: 0, carriedOver: 0, skipped: 0 };
  for (const entry of entries) {
    // A Google event is not the person's to do: it does not count.
    if (entry.type === "event") continue;
    if (entry.status === "completed") tally.completed += 1;
    else if (entry.status === "skipped") tally.skipped += 1;
    else tally[entry.isOverdue ? "carriedOver" : "open"] += 1;
  }
  return tally;
}

/**
 * A Plan entry in the shape of Heute's rows, so it shows on the same card.
 * What the Plan's read leaves out (Warum, category, worked minutes) stays
 * empty. A forecast run has no stored run yet: it carries 0, and nothing
 * ticks it (the card has no ring). What can be measured is the row's one
 * answer (`planRow`): an open quest, a run as the server says; the card
 * shows no ▶ here, the stopwatch stays with today.
 */
export function asPlannerItem(
  entry: WeekPlanOwnEntry,
  date: string,
): DayPlannerItem {
  const shared = {
    title: entry.title,
    timeOfDay: entry.timeOfDay,
    plannedDurationMinutes: entry.plannedDurationMinutes,
    campaign: entry.campaign,
    isOverdue: entry.isOverdue,
    categoryName: null,
    categoryColor: null,
    why: null,
    goal: null,
    workedMinutes: 0,
  };
  if (entry.type === "todo")
    return {
      ...shared,
      type: "todo",
      todoId: entry.todoId,
      status: entry.status,
      scheduledDate: entry.scheduledDate,
      completedAt: null,
      timerEligible: entry.status === "pending",
    };
  return {
    ...shared,
    type: "habit",
    habitId: entry.habitId,
    occurrenceId: entry.occurrenceId ?? 0,
    status: entry.status,
    scheduledDate: date,
    moveUntil: entry.moveUntil,
    scheduleType: "interval",
    timerEligible: entry.timerEligible,
    streak: entry.streak,
    monthChallenge: entry.monthChallenge,
  };
}
