import type { HabitResponse, HabitScheduleRule, Weekday } from "../types/habit";
import type { HistoryResponse } from "../types/history";
import { addDays } from "./date";
import { weekdayName } from "./history";
/** Monday-first weekday options for every schedule form and label. */
export const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: "monday", label: "Montag" },
  { value: "tuesday", label: "Dienstag" },
  { value: "wednesday", label: "Mittwoch" },
  { value: "thursday", label: "Donnerstag" },
  { value: "friday", label: "Freitag" },
  { value: "saturday", label: "Samstag" },
  { value: "sunday", label: "Sonntag" },
];
export function formatHabitSchedule(rule: HabitScheduleRule): string {
  switch (rule.type) {
    case "interval":
      return rule.intervalDays === 1
        ? "Täglich"
        : `Alle ${rule.intervalDays} Tage`;
    case "weekly_target":
      return `${rule.weeklyTarget} Mal pro Woche`;
    case "fixed_weekdays":
      return WEEKDAY_OPTIONS
        .filter((day) => rule.weekdays.includes(day.value))
        .map((day) => day.label)
        .join(", ");
  }
}

/**
 * Where an active Daily stands this week, read from the calendar's week
 * (`GET /history?view=week&filter=habits`), so the Dailies say what Heute and
 * the calendar say: a weekly target counts its runs ("2 von 3 diese Woche"),
 * a schedule names today ("heute fällig", "heute erledigt") or its next day
 * this week. Null when there is nothing to say or the week did not load.
 */
export function dailyWeekStatus(
  habit: Pick<HabitResponse, "id" | "isActive" | "currentSchedule">,
  week: HistoryResponse | null,
  today: string,
): string | null {
  if (!week || !habit.isActive || !habit.currentSchedule) return null;
  if (habit.currentSchedule.schedule.type === "weekly_target") {
    const target = week.weeklyTargets?.find(
      (item) => item.habitId === habit.id,
    );
    return target
      ? `${target.completed} von ${target.target} diese Woche`
      : null;
  }
  const ofHabit = (entry: { type: string; habitId: number | null }) =>
    entry.type === "habit" && entry.habitId === habit.id;
  const day = week.days.find((item) => item.date === today);
  const resolved = day?.items.filter(ofHabit) ?? [];
  if (resolved.some((item) => item.status === "completed"))
    return "heute erledigt";
  if (day?.planned?.some(ofHabit)) return "heute fällig";
  if (resolved.length) return "heute übersprungen";
  const next = week.days.find(
    (item) => item.date > today && item.planned?.some(ofHabit),
  );
  if (!next) return "diese Woche nicht mehr fällig";
  return next.date === addDays(today, 1)
    ? "morgen fällig"
    : `${weekdayName(next.date)} fällig`;
}
