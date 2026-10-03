import type { HabitScheduleRule, Weekday } from "../types/habit";
const weekdays: { value: Weekday; label: string }[] = [
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
      return weekdays
        .filter((day) => rule.weekdays.includes(day.value))
        .map((day) => day.label)
        .join(", ");
  }
}
