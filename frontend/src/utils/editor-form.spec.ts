import { describe, expect, it } from "vitest";
import {
  HABIT_FIELDS,
  HIERARCHY_FIELDS,
  TODO_FIELDS,
} from "../types/fixtures";
import type { HabitResponse } from "../types/habit";
import type { TodoResponse } from "../types/todo";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  canBecomeDaily,
  chosenCampaignId,
  emptyEditorForm,
  habitDraft,
  habitForm,
  habitSave,
  isCampaignTodo,
  placeBrings,
  placeBringsInEditor,
  questSections,
  scheduleFailure,
  todoForm,
} from "./editor-form";
import { emptyScheduleDraft } from "./habit-schedule";
import type { ParentChoice } from "./parent-choice";

const todo = (fields: Partial<TodoResponse> = {}): TodoResponse => ({
  ...TODO_FIELDS,
  id: 1,
  parentId: null,
  title: "Steuer",
  completed: false,
  completedAt: null,
  scheduledDate: null,
  timeOfDay: null,
  plannedDurationMinutes: null,
  timerEligible: true,
  ...fields,
});
const ownCampaign = { id: 1, title: "Steuer", color: null, icon: null };

const habit = (fields: Partial<HabitResponse> = {}): HabitResponse => ({
  ...HABIT_FIELDS,
  id: 10,
  title: "Joggen",
  isActive: true,
  plannedDurationMinutes: null,
  timerOccurrenceId: null,
  timerDurationMinutes: null,
  currentSchedule: null,
  upcomingSchedule: null,
  ...fields,
});

const hierarchy = (fields: Partial<HierarchyTodo>): HierarchyTodo => ({
  ...todo(),
  ...HIERARCHY_FIELDS,
  progress: {
    mode: "count",
    completed: 0,
    total: 0,
    percentage: 0,
    knownDurationMinutes: 0,
    todoCount: 0,
    doneCount: 0,
  },
  ...fields,
});
/** "Umzug" (category 5, Warum "Neue Stadt") and "Kisten" below it. */
const umzugWhy = { text: "Neue Stadt", fromId: 20, fromTitle: "Umzug" };
const umzug = hierarchy({ id: 20, title: "Umzug", categoryId: 5, why: "Neue Stadt" });
const kisten = hierarchy({
  id: 21,
  title: "Kisten",
  parentId: 20,
  inheritedWhy: umzugWhy,
});
const atUmzug: ParentChoice = { todo: umzug, path: ["Umzug"], campaign: umzug };
const atKisten: ParentChoice = {
  todo: kisten,
  path: ["Umzug", "Kisten"],
  campaign: umzug,
};
const loadedWhy = { text: "Gesund bleiben", fromId: 7, fromTitle: "Fit" };

describe("todoForm and habitForm", () => {
  it("fill a quest's fields and leave a daily's empty", () => {
    expect(
      todoForm(
        todo({
          scheduledDate: "2026-11-28",
          plannedDurationMinutes: 30,
          why: "weil",
          color: "pine",
          icon: "nope",
          weeklyTargetMinutes: 90,
        }),
      ),
    ).toEqual({
      ...emptyEditorForm(),
      title: "Steuer",
      date: "2026-11-28",
      duration: 30,
      why: "weil",
      color: "pine",
      icon: null,
      weeklyTarget: "1.5",
    });
  });

  it("fill a daily's fields and leave a quest's empty", () => {
    expect(
      habitForm(
        habit({ isActive: false, campaignId: 3, timeOfDay: "07:00", focusBlock: "never" }),
      ),
    ).toEqual({
      ...emptyEditorForm(),
      title: "Joggen",
      isActive: false,
      campaignId: 3,
      timeOfDay: "07:00",
      focusBlock: "never",
    });
  });
});

describe("questSections", () => {
  const all = { plan: true, duration: true, appointment: true, goal: true };
  const none = { plan: false, duration: false, appointment: false, goal: false };
  it.each([
    ["nothing loaded yet", null, all],
    ["a quest", todo(), all],
    ["a quest below a campaign", todo({ parentId: 2, campaign: { ...ownCampaign, id: 2 } }), all],
    ["a campaign", todo({ campaign: ownCampaign }), none],
    [
      "a campaign with a day",
      todo({ campaign: ownCampaign, scheduledDate: "2026-11-28" }),
      { ...none, plan: true },
    ],
    [
      "a campaign with a duration",
      todo({ campaign: ownCampaign, plannedDurationMinutes: 0 }),
      { ...none, duration: true },
    ],
    [
      "a campaign with an appointment",
      todo({ campaign: ownCampaign, timeOfDay: "09:00" }),
      { ...none, appointment: true },
    ],
    [
      "a campaign with a goal",
      todo({ campaign: ownCampaign, goalHabitId: 4 }),
      { ...none, goal: true },
    ],
    [
      "a campaign with a period",
      todo({ campaign: ownCampaign, periodEnd: "2026-12-31" }),
      { ...none, goal: true },
    ],
  ])("shows for %s what is set or plannable", (_, loaded, sections) => {
    expect(questSections(loaded)).toEqual(sections);
  });

  it("knows a campaign as the quest that is its own campaign", () => {
    expect(isCampaignTodo(todo({ campaign: ownCampaign }))).toBe(true);
    expect(isCampaignTodo(todo({ campaign: { ...ownCampaign, id: 2 } }))).toBe(false);
    expect(isCampaignTodo(null)).toBe(false);
  });
});

describe("canBecomeDaily", () => {
  it.each([
    ["an open quest without quests below", todo(), false, true],
    ["before the tree is read", todo(), null, false],
    ["a quest with quests below", todo(), true, false],
    ["a done quest", todo({ completed: true }), false, false],
    ["a campaign", todo({ campaign: ownCampaign }), false, false],
    ["nothing loaded (a daily)", null, false, false],
  ])("%s: %s", (_, loaded, hasChildren, offered) => {
    expect(canBecomeDaily(loaded, hasChildren)).toBe(offered);
  });
});

describe("chosenCampaignId", () => {
  const below = todo({ parentId: 21, campaign: { ...ownCampaign, id: 20 } });
  it.each([
    ["none at the top", null, [atKisten], below, null],
    ["the chosen place's campaign", 21, [atUmzug, atKisten], todo(), 20],
    ["the loaded quest's before the places load", 21, [], below, 20],
    ["none while a campaign stays unloaded", 9, [], todo({ campaign: ownCampaign }), null],
  ])("%s", (_, parentId, choices, loaded, campaignId) => {
    expect(chosenCampaignId(parentId, choices, loaded)).toBe(campaignId);
  });

  it("hands the daily made from the quest its trimmed fields and that campaign", () => {
    expect(
      habitDraft({ title: " Laufen ", why: " fit ", categoryId: 3 }, 20),
    ).toEqual({ title: "Laufen", why: "fit", categoryId: 3, campaignId: 20 });
  });
});

describe("placeBrings", () => {
  it.each([
    ["a campaign brings its Warum and category", atUmzug, null, umzugWhy, 5],
    ["a sub-quest brings the campaign's category", atKisten, null, umzugWhy, 5],
    ["an own category wins", atUmzug, 3, umzugWhy, 3],
    ["no place inherits nothing and keeps the category", null, 3, null, 3],
  ])("%s", (_, choice, categoryId, inheritedWhy, category) => {
    expect(placeBrings(choice, categoryId)).toEqual({
      inheritedWhy,
      categoryId: category,
    });
  });

  it("takes a sub-quest's own category and Warum over the campaign's", () => {
    const own = hierarchy({ ...kisten, categoryId: 8, why: "Platz" });
    expect(
      placeBrings({ ...atKisten, todo: own }, null),
    ).toEqual({
      inheritedWhy: { text: "Platz", fromId: 21, fromTitle: "Kisten" },
      categoryId: 8,
    });
  });
});

describe("placeBringsInEditor", () => {
  it.each([
    ["a new place brings its Warum", atUmzug, false, false, umzugWhy],
    ["back at the loaded place: the server's Warum", atUmzug, true, false, loadedWhy],
    ["no place: nothing inherited", null, false, false, null],
    ["a daily without a campaign before keeps the goal's", null, false, true, loadedWhy],
    ["a campaign's own Warum wins over the goal's", atUmzug, false, true, umzugWhy],
  ])("%s", (_, choice, returned, keepLoadedWhy, inheritedWhy) => {
    expect(
      placeBringsInEditor(choice, null, { returned, loadedWhy, keepLoadedWhy })
        .inheritedWhy,
    ).toEqual(inheritedWhy);
  });

  it("brings the category as `placeBrings` does, also back at the loaded place", () => {
    const options = { returned: true, loadedWhy };
    expect(placeBringsInEditor(atUmzug, null, options).categoryId).toBe(5);
    expect(placeBringsInEditor(atUmzug, 3, options).categoryId).toBe(3);
  });
});

describe("habitSave", () => {
  const today = "2026-11-28";
  const form = habitForm(habit());
  const noChange = { change: false, effectiveFrom: today, draft: emptyScheduleDraft() };

  it("plans neither request for an untouched daily", () => {
    expect(habitSave(form, habit(), noChange, today)).toEqual({
      metadata: null,
      schedule: null,
    });
  });

  it("plans the changed fields and the new rhythm, in that order", () => {
    expect(
      habitSave(
        { ...form, title: "Laufen" },
        habit(),
        { ...noChange, change: true, effectiveFrom: "2026-12-01" },
        today,
      ),
    ).toEqual({
      metadata: { title: "Laufen" },
      schedule: {
        effectiveFrom: "2026-12-01",
        schedule: { type: "interval", intervalDays: 1, missedOccurrencePolicy: "carry_over" },
      },
    });
  });

  it.each([
    ["a past day", "2026-11-27"],
    ["no valid day", "2026-13-01"],
  ])("rejects a rhythm from %s before anything is sent", (_, effectiveFrom) => {
    expect(() =>
      habitSave(
        { ...form, title: "Laufen" },
        habit(),
        { ...noChange, change: true, effectiveFrom },
        today,
      ),
    ).toThrow("Bitte wähle heute oder ein zukünftiges gültiges Datum.");
  });

  it("checks the daily's own fields first", () => {
    expect(() =>
      habitSave(
        { ...form, title: " " },
        habit(),
        { ...noChange, change: true, effectiveFrom: "2026-11-27" },
        today,
      ),
    ).toThrow("Der Titel muss 1 bis 200 Zeichen enthalten.");
  });
});

describe("scheduleFailure", () => {
  it.each([
    [
      "says the fields were saved and the rhythm can be saved again",
      new Error("Konflikt"),
      true,
      "Stammdaten gespeichert, Zeitplanänderung fehlgeschlagen: Konflikt. Du kannst die Zeitplanänderung erneut speichern.",
    ],
    ["is the failure itself when nothing was saved before", new Error("Konflikt"), false, "Konflikt"],
    ["names an unknown failure", "kaputt", false, "Unbekannter Fehler"],
  ])("%s", (_, error, metadataSaved, message) => {
    expect(scheduleFailure(error, metadataSaved)).toBe(message);
  });
});
