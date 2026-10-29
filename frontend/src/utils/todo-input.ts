import type { CreateTodoInput } from "../types/todo";
import { fromLocalInput } from "./date";

/** Raw values of any todo form (create, Dump editor, planner editor). */
export type TodoFormValues = {
  title: string;
  /** datetime-local value in Berlin time, or "" for none. */
  scheduledAt: string;
  duration: string | number;
  isFixed: boolean;
};

/**
 * The one validation for todo forms. `unchanged` keeps an existing instant
 * exactly (seconds included) when the user did not touch the date field.
 */
export function buildTodoInput(
  values: TodoFormValues,
  unchanged?: { localInput: string; iso: string | null },
): CreateTodoInput {
  const title = values.title.trim();
  if (!title) throw new Error("Bitte gib einen Titel ein.");
  if (title.length > 200)
    throw new Error("Der Titel darf höchstens 200 Zeichen enthalten.");

  let scheduledAt: string | null = null;
  if (unchanged && values.scheduledAt === unchanged.localInput) {
    scheduledAt = unchanged.iso;
  } else if (values.scheduledAt) {
    scheduledAt = fromLocalInput(values.scheduledAt);
    if (scheduledAt === null)
      throw new Error("Bitte gib einen gültigen Zeitpunkt ein.");
  }
  if (values.isFixed && scheduledAt === null)
    throw new Error("Ein fester Termin benötigt einen Zeitpunkt.");

  let plannedDurationMinutes: number | null = null;
  if (String(values.duration).trim() !== "") {
    const minutes = Number(values.duration);
    if (!Number.isInteger(minutes) || minutes < 1)
      throw new Error("Die Dauer muss eine ganze Zahl ab 1 Minute sein.");
    plannedDurationMinutes = minutes;
  }

  return { title, scheduledAt, plannedDurationMinutes, isFixed: values.isFixed };
}
