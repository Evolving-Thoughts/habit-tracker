import type { CampaignColor, CampaignIcon } from "../types/campaign";
import type { FocusBlockOverride } from "../types/focus-block";
import type {
  ChangeHabitScheduleInput,
  HabitResponse,
  UpdateHabitInput,
} from "../types/habit";
import type { InheritedWhy, TodoResponse } from "../types/todo";
import { isCampaignColor, isCampaignIcon } from "./campaign-style";
import { isValidIsoDate } from "./date";
import { habitChanges } from "./editor-changes";
import { scheduleRuleOf, type ScheduleDraft } from "./habit-schedule";
import { categoryOfChoice, type ParentChoice } from "./parent-choice";
import { minutesToHours } from "./quest-hours";
import { whyBelow } from "./why";

/*
 * The planner editor's form as plain data, and the rules that decide what it
 * shows and what a chosen place brings. The create forms share the place
 * rule; `editor-changes` turns the form into what is sent.
 */

/** Every field of the editor, for a quest and a daily alike. */
export type EditorForm = {
  title: string;
  categoryId: number | null;
  why: string;
  /** Minutes, as the field holds them. */
  duration: string | number;
  focusBlock: FocusBlockOverride;
  // A quest's
  /** YYYY-MM-DD or "". */
  date: string;
  /** HH:mm or "". */
  time: string;
  parentId: number | null;
  periodStart: string;
  periodEnd: string;
  goalHabitId: number | null;
  goalTarget: string | number;
  /** Hours, as the field shows them. */
  weeklyTarget: string | number;
  color: CampaignColor | null;
  icon: CampaignIcon | null;
  // A daily's
  isActive: boolean;
  campaignId: number | null;
  /** HH:mm or "". */
  timeOfDay: string;
};

export function emptyEditorForm(): EditorForm {
  return {
    title: "",
    categoryId: null,
    why: "",
    duration: "",
    focusBlock: "default",
    date: "",
    time: "",
    parentId: null,
    periodStart: "",
    periodEnd: "",
    goalHabitId: null,
    goalTarget: "",
    weeklyTarget: "",
    color: null,
    icon: null,
    isActive: true,
    campaignId: null,
    timeOfDay: "",
  };
}

/** The form of a loaded quest; a daily's fields stay empty. */
export function todoForm(todo: TodoResponse): EditorForm {
  return {
    ...emptyEditorForm(),
    title: todo.title,
    categoryId: todo.categoryId ?? null,
    why: todo.why ?? "",
    duration: todo.plannedDurationMinutes ?? "",
    focusBlock: todo.focusBlock ?? "default",
    date: todo.scheduledDate ?? "",
    time: todo.timeOfDay ?? "",
    parentId: todo.parentId,
    periodStart: todo.periodStart ?? "",
    periodEnd: todo.periodEnd ?? "",
    goalHabitId: todo.goalHabitId ?? null,
    goalTarget: todo.goalTarget ?? "",
    weeklyTarget: minutesToHours(todo.weeklyTargetMinutes),
    color: isCampaignColor(todo.color) ? todo.color : null,
    icon: isCampaignIcon(todo.icon) ? todo.icon : null,
  };
}

/** The form of a loaded daily; a quest's fields stay empty. */
export function habitForm(habit: HabitResponse): EditorForm {
  return {
    ...emptyEditorForm(),
    title: habit.title,
    categoryId: habit.categoryId ?? null,
    why: habit.why ?? "",
    duration: habit.plannedDurationMinutes ?? "",
    focusBlock: habit.focusBlock ?? "default",
    isActive: habit.isActive,
    campaignId: habit.campaignId ?? null,
    timeOfDay: habit.timeOfDay ?? "",
  };
}

/*
 * A campaign as it was opened: a top-level quest with quests below or a
 * colour, icon or goal (the server names it its own campaign).
 */
export function isCampaignTodo(todo: TodoResponse | null): boolean {
  return !!todo && todo.campaign?.id === todo.id;
}

/** Which of a quest's groups its editor shows. */
export type QuestSections = {
  plan: boolean;
  duration: boolean;
  appointment: boolean;
  goal: boolean;
};

/*
 * A campaign is planned through its quests: its form leaves out day,
 * duration, appointment and goal unless a value is already set there, so it
 * can be cleared. A quest shows them all.
 */
export function questSections(todo: TodoResponse | null): QuestSections {
  if (!isCampaignTodo(todo)) {
    return { plan: true, duration: true, appointment: true, goal: true };
  }
  const loaded = todo!;
  return {
    plan: !!loaded.scheduledDate,
    duration: loaded.plannedDurationMinutes != null,
    appointment: !!loaded.timeOfDay,
    goal:
      loaded.goalHabitId != null || !!loaded.periodStart || !!loaded.periodEnd,
  };
}

/*
 * An open quest with nothing below it can become a daily; a campaign never.
 * `hasChildren` is null until "Gehört zu" has read the tree: no switch yet.
 */
export function canBecomeDaily(
  todo: TodoResponse | null,
  hasChildren: boolean | null,
): boolean {
  return (
    !!todo && !todo.completed && !isCampaignTodo(todo) && hasChildren === false
  );
}

/*
 * The campaign a quest's chosen place belongs to: the choice's campaign once
 * "Gehört zu" has loaded, else the loaded quest's own (unless it is one
 * itself). None at the top.
 */
export function chosenCampaignId(
  parentId: number | null,
  choices: ParentChoice[],
  loaded: TodoResponse | null,
): number | null {
  if (parentId === null) return null;
  const choice = choices.find((entry) => entry.todo.id === parentId);
  if (choice) return choice.campaign.id;
  const campaign = loaded?.campaign;
  return campaign && campaign.id !== loaded?.id ? campaign.id : null;
}

/** What a daily made from a quest starts with. */
export type HabitDraft = {
  title: string;
  why: string;
  categoryId: number | null;
  campaignId: number | null;
};

/** The quest's form as a daily: title, reason, category and campaign. */
export function habitDraft(
  form: Pick<EditorForm, "title" | "why" | "categoryId">,
  campaignId: number | null,
): HabitDraft {
  return {
    title: form.title.trim(),
    why: form.why.trim(),
    categoryId: form.categoryId,
    campaignId,
  };
}

/** The category an entry holds and the Warum it inherits. */
export type Assignment = {
  categoryId: number | null;
  inheritedWhy: InheritedWhy | null;
};

/*
 * A chosen place ("Gehört zu" of a quest, the Kampagne of a daily) brings
 * its Warum, inherited live and never copied, and its category unless the
 * entry has one already. Without a place nothing is inherited and the
 * category stays.
 */
export function placeBrings(
  choice: ParentChoice | null,
  categoryId: number | null,
): Assignment {
  return {
    inheritedWhy: choice ? whyBelow(choice.todo) : null,
    categoryId:
      choice && categoryId === null ? categoryOfChoice(choice) : categoryId,
  };
}

/*
 * A place chosen in the editor, as `placeBrings`, except for the Warum:
 * back at the place it was loaded with, the entry inherits what the server
 * said (`loadedWhy`). With `keepLoadedWhy` (a daily that named no campaign:
 * a goal counting it lends its Warum) that answer also stays when the new
 * place brings none.
 */
export function placeBringsInEditor(
  choice: ParentChoice | null,
  categoryId: number | null,
  {
    returned,
    loadedWhy,
    keepLoadedWhy = false,
  }: {
    returned: boolean;
    loadedWhy: InheritedWhy | null;
    keepLoadedWhy?: boolean;
  },
): Assignment {
  const brought = placeBrings(choice, categoryId);
  return {
    categoryId: brought.categoryId,
    inheritedWhy: returned
      ? loadedWhy
      : (brought.inheritedWhy ?? (keepLoadedWhy ? loadedWhy : null)),
  };
}

/** A rhythm change being edited: off, or the new rule from a day on. */
export type ScheduleEdit = {
  change: boolean;
  effectiveFrom: string;
  draft: ScheduleDraft;
};

/** A daily's save: its own fields, then a new rhythm; null skips a step. */
export type HabitSave = {
  metadata: UpdateHabitInput | null;
  schedule: ChangeHabitScheduleInput | null;
};

/*
 * A daily is saved in up to two requests: its changed fields, then a new
 * rhythm. Both are validated before either is sent; each throws the message
 * the form shows. A new rhythm starts today or later.
 */
export function habitSave(
  form: EditorForm,
  loaded: HabitResponse,
  schedule: ScheduleEdit,
  today: string,
): HabitSave {
  const metadata = habitChanges(form, loaded);
  let change: ChangeHabitScheduleInput | null = null;
  if (schedule.change) {
    if (!isValidIsoDate(schedule.effectiveFrom) || schedule.effectiveFrom < today)
      throw new Error("Bitte wähle heute oder ein zukünftiges gültiges Datum.");
    change = {
      effectiveFrom: schedule.effectiveFrom,
      schedule: scheduleRuleOf(schedule.draft),
    };
  }
  return {
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    schedule: change,
  };
}

/*
 * The rhythm change failed: after the daily's own fields were saved, the
 * message says so and that the rhythm can be saved again; otherwise it is
 * the failure itself.
 */
export function scheduleFailure(error: unknown, metadataSaved: boolean): string {
  const detail = error instanceof Error ? error.message : "Unbekannter Fehler";
  return metadataSaved
    ? `Stammdaten gespeichert, Zeitplanänderung fehlgeschlagen: ${detail}. Du kannst die Zeitplanänderung erneut speichern.`
    : detail;
}
