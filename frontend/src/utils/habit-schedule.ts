import type { HabitScheduleType } from "../types/day-planner";
import type {
  HabitScheduleRule,
  MissedOccurrencePolicy,
  Weekday,
} from "../types/habit";
import { WEEKDAY_OPTIONS } from "./habit";

/** What a schedule form holds; every field survives switching the type. */
export type ScheduleDraft = {
  type: HabitScheduleType;
  intervalDays: string | number;
  weeklyTarget: string | number;
  weekdays: Weekday[];
  missedPolicy: MissedOccurrencePolicy;
};

export function emptyScheduleDraft(): ScheduleDraft {
  return {
    type: "interval",
    intervalDays: 1,
    weeklyTarget: 3,
    weekdays: [],
    missedPolicy: "carry_over",
  };
}

export function scheduleDraftOf(rule: HabitScheduleRule): ScheduleDraft {
  return {
    ...emptyScheduleDraft(),
    type: rule.type,
    ...(rule.type === "interval" ? { intervalDays: rule.intervalDays } : {}),
    ...(rule.type === "weekly_target"
      ? { weeklyTarget: rule.weeklyTarget, missedPolicy: "skip" as const }
      : { missedPolicy: rule.missedOccurrencePolicy }),
    ...(rule.type === "fixed_weekdays" ? { weekdays: [...rule.weekdays] } : {}),
  };
}

export function positiveInteger(
  value: string | number,
  message: string,
  maximum?: number,
): number {
  const number = Number(value);
  if (
    !Number.isInteger(number) ||
    number < 1 ||
    (maximum !== undefined && number > maximum)
  ) {
    throw new Error(message);
  }
  return number;
}

/** The checked rule of a draft; throws the message to show the user. */
export function scheduleRuleOf(draft: ScheduleDraft): HabitScheduleRule {
  switch (draft.type) {
    case "interval":
      return {
        type: "interval",
        intervalDays: positiveInteger(
          draft.intervalDays,
          "Das Intervall muss eine ganze Zahl ab 1 Tag sein.",
        ),
        missedOccurrencePolicy: draft.missedPolicy,
      };
    case "fixed_weekdays":
      if (!draft.weekdays.length)
        throw new Error("Bitte wähle mindestens einen Wochentag.");
      return {
        type: "fixed_weekdays",
        weekdays: WEEKDAY_OPTIONS.filter((option) =>
          draft.weekdays.includes(option.value),
        ).map((option) => option.value),
        missedOccurrencePolicy: draft.missedPolicy,
      };
    case "weekly_target":
      return {
        type: "weekly_target",
        weeklyTarget: positiveInteger(
          draft.weeklyTarget,
          "Das Wochenziel muss zwischen 1 und 7 liegen.",
          7,
        ),
      };
  }
}
