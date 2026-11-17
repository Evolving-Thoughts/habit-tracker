import type { CreateTodoInput } from "../types/todo";

/** Raw values of any quest form (create, Questlog editor, planner editor). */
export type TodoFormValues = {
  title: string;
  /** YYYY-MM-DD of the planned day, or "" for the Questlog. */
  date: string;
  /** HH:mm of an appointment, or "" when only the day is planned. */
  time: string;
  duration: string | number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The one validation for quest forms. */
export function buildTodoInput(values: TodoFormValues): CreateTodoInput {
  const title = values.title.trim();
  if (!title) throw new Error("Bitte gib einen Titel ein.");
  if (title.length > 200)
    throw new Error("Der Titel darf höchstens 200 Zeichen enthalten.");

  const scheduledDate = values.date || null;
  if (scheduledDate !== null && !DAY.test(scheduledDate))
    throw new Error("Bitte gib einen gültigen Tag ein.");
  // Browsers without a time picker hand over seconds as well.
  const timeOfDay = values.time ? values.time.slice(0, 5) : null;
  if (timeOfDay !== null && !TIME.test(timeOfDay))
    throw new Error("Bitte gib eine gültige Uhrzeit ein.");
  if (timeOfDay !== null && scheduledDate === null)
    throw new Error("Ein fester Termin braucht einen Tag.");

  let plannedDurationMinutes: number | null = null;
  if (String(values.duration).trim() !== "") {
    const minutes = Number(values.duration);
    if (!Number.isInteger(minutes) || minutes < 1)
      throw new Error("Die Dauer muss eine ganze Zahl ab 1 Minute sein.");
    plannedDurationMinutes = minutes;
  }

  return { title, scheduledDate, timeOfDay, plannedDurationMinutes };
}
