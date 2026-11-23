import type { HabitResponse, UpdateHabitInput } from "../types/habit";
import type {
  CampaignInput,
  TodoGoalInput,
  TodoResponse,
  UpdateTodoInput,
} from "../types/todo";
import { positiveInteger } from "./habit-schedule";
import { hoursToMinutes } from "./quest-hours";
import { TIMER_DURATION_MESSAGE, TIMER_MAX_MINUTES } from "./timer-duration";
import { buildTodoInput } from "./todo-input";

/*
 * What the planner editor sends: only what changed against the entity as it
 * was loaded, so a plain edit never overwrites a field it did not touch
 * (another device may have changed it meanwhile). Each function validates
 * and throws the message the form shows.
 */

/** Category and reason, as both editors hold them. */
export type AssignmentFields = { categoryId: number | null; why: string };

/** Fokus-Sperre of a quest or daily: the default rule, always or never. */
type FocusBlockChoice = "default" | "always" | "never";

export type TodoFields = AssignmentFields & {
  title: string;
  /** YYYY-MM-DD or "". */
  date: string;
  /** HH:mm or "". */
  time: string;
  duration: string | number;
  parentId: number | null;
  periodStart: string;
  periodEnd: string;
  goalHabitId: number | null;
  goalTarget: string | number;
  /** Hours, as the field shows them. */
  weeklyTarget: string | number;
  color: string | null;
  icon: string | null;
  focusBlock?: FocusBlockChoice;
};

export type HabitFields = AssignmentFields & {
  title: string;
  isActive: boolean;
  campaignId: number | null;
  duration: string | number;
  /** HH:mm or "". */
  timeOfDay: string;
  focusBlock?: FocusBlockChoice;
};

/** The Fokus-Sperre choice, only when it changed (missing reads as default). */
function focusBlockChange(
  choice: FocusBlockChoice | undefined,
  loaded: { focusBlock?: FocusBlockChoice },
): { focusBlock?: FocusBlockChoice } {
  return choice !== undefined && choice !== (loaded.focusBlock ?? "default")
    ? { focusBlock: choice }
    : {};
}

/** Only the changed keys of `next` against `before` (missing counts as null). */
function changed<T extends object>(
  next: T,
  before: Partial<Record<keyof T, unknown>>,
): Partial<T> {
  const keys = Object.keys(next) as (keyof T)[];
  return Object.fromEntries(
    keys
      .filter((key) => next[key] !== (before[key] ?? null))
      .map((key) => [key, next[key]]),
  ) as Partial<T>;
}

export function assignmentChanges(
  fields: AssignmentFields,
  loaded: { categoryId?: number | null; why?: string | null },
): { categoryId?: number | null; why?: string | null } {
  const why = fields.why.trim();
  return {
    ...(fields.categoryId !== (loaded.categoryId ?? null)
      ? { categoryId: fields.categoryId }
      : {}),
    ...(why !== (loaded.why ?? "") ? { why: why || null } : {}),
  };
}

function goalChanges(fields: TodoFields, loaded: TodoResponse): TodoGoalInput {
  const goalTarget =
    fields.goalHabitId === null
      ? null
      : positiveInteger(
          fields.goalTarget,
          "Die Sollmenge muss eine ganze Zahl ab 1 sein.",
        );
  return changed(
    {
      periodStart: fields.periodStart || null,
      periodEnd: fields.periodEnd || null,
      goalHabitId: fields.goalHabitId,
      goalTarget,
    },
    loaded,
  );
}

/**
 * Colour, icon and weekly goal, and only at the top: below another quest it
 * carries none of these (the server clears them when a campaign moves below).
 */
function campaignChanges(
  fields: TodoFields,
  loaded: TodoResponse,
): CampaignInput {
  if (fields.parentId !== null) return {};
  return changed(
    {
      weeklyTargetMinutes: hoursToMinutes(fields.weeklyTarget),
      color: fields.color,
      icon: fields.icon,
    },
    loaded,
  );
}

/**
 * The quest's update. Title, day, time and duration always go along (the
 * shared quest validation); everything else only when it changed.
 */
export function todoChanges(
  fields: TodoFields,
  loaded: TodoResponse,
): UpdateTodoInput {
  return {
    ...buildTodoInput(fields),
    ...(fields.parentId !== loaded.parentId
      ? { parentId: fields.parentId }
      : {}),
    ...assignmentChanges(fields, loaded),
    ...goalChanges(fields, loaded),
    ...campaignChanges(fields, loaded),
    ...focusBlockChange(fields.focusBlock, loaded),
  };
}

/** The daily's own fields that changed; its schedule is saved apart. */
export function habitChanges(
  fields: HabitFields,
  loaded: HabitResponse,
): UpdateHabitInput {
  const input: UpdateHabitInput = assignmentChanges(fields, loaded);
  const title = fields.title.trim();
  if (!title || title.length > 200)
    throw new Error("Der Titel muss 1 bis 200 Zeichen enthalten.");
  if (title !== loaded.title) input.title = title;
  if (fields.isActive !== loaded.isActive) input.isActive = fields.isActive;
  if (fields.campaignId !== (loaded.campaignId ?? null))
    input.campaignId = fields.campaignId;
  const minutes = String(fields.duration).trim()
    ? positiveInteger(
        fields.duration,
        TIMER_DURATION_MESSAGE,
        TIMER_MAX_MINUTES,
      )
    : null;
  if (minutes !== (loaded.plannedDurationMinutes ?? null))
    input.plannedDurationMinutes = minutes;
  const time = fields.timeOfDay || null;
  if (time !== (loaded.timeOfDay ?? null)) input.timeOfDay = time;
  Object.assign(input, focusBlockChange(fields.focusBlock, loaded));
  return input;
}
