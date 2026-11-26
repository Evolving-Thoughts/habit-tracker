import { HABIT_FIELDS } from "../types/fixtures";
import {
  config,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeHabitSchedule,
  createHabit,
  deleteHabit,
  getHabit,
  getHabits,
  updateHabit,
  updateOccurrenceStatus,
} from "../api/day-planner.api";
import type {
  HabitResponse,
  HabitScheduleRule,
  ScheduleVersionResponse,
} from "../types/habit";
import { getCategories } from "../api/categories.api";
import { getHistory } from "../api/history.api";
import type { HistoryResponse } from "../types/history";
import { HISTORY_ITEM_FIELDS, PLANNED_FIELDS } from "../types/fixtures";
import HabitsView from "./HabitsView.vue";
vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(async () => []),
}));
vi.mock("../api/history.api", () => ({ getHistory: vi.fn() }));
vi.mock("../api/todo-hierarchy.api", () => ({
  getTodoHierarchy: vi.fn(async () => []),
}));
vi.mock("../components/QuestNotes.vue", () => import("../test/quest-notes-stub"));
vi.mock("../api/day-planner.api", () => ({
  getHabits: vi.fn(),
  getHabit: vi.fn(),
  updateHabit: vi.fn(),
  changeHabitSchedule: vi.fn(),
  deleteHabit: vi.fn(),
  createHabit: vi.fn(),
  createTodo: vi.fn(),
  getTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
}));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());
/* The filter lives in the address: every mount gets a router at #/dailies. */
let router: Router;
beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/dailies", component: { template: "<div />" } }],
  });
  await router.push("/dailies");
  config.global.plugins = [router];
});
afterEach(() => {
  config.global.plugins = [];
});
function version(
  schedule: HabitScheduleRule = {
    type: "interval",
    intervalDays: 2,
    missedOccurrencePolicy: "carry_over",
  },
  effectiveFrom = "2026-10-02",
): ScheduleVersionResponse {
  return {
    id: 100,
    effectiveFrom,
    effectiveAt: `${effectiveFrom}T08:00:00Z`,
    endsAt: null,
    cancelledAt: null,
    firstDueDate: effectiveFrom,
    schedule,
  };
}
function habit(overrides: Partial<HabitResponse> = {}): HabitResponse {
  return {
    ...HABIT_FIELDS,
    id: 10,
    title: "Joggen",
    isActive: true,
    plannedDurationMinutes: null,
    timerOccurrenceId: null,
    timerDurationMinutes: null,
    currentSchedule: version(),
    upcomingSchedule: null,
    ...overrides,
  };
}
describe("HabitsView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    vi.mocked(getHabits).mockResolvedValue([]);
    vi.mocked(getHabit).mockResolvedValue(habit());
    vi.mocked(updateHabit).mockResolvedValue(habit());
    vi.mocked(changeHabitSchedule).mockResolvedValue(habit());
    vi.mocked(createHabit).mockResolvedValue(habit());
    vi.mocked(deleteHabit).mockResolvedValue(undefined);
  });
  it("shows loading and disables actions until the first request resolves", async () => {
    let resolve!: (value: HabitResponse[]) => void;
    vi.mocked(getHabits).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(HabitsView);
    expect(
      wrapper.find('.skeleton[aria-label="Dailies werden geladen"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get<HTMLButtonElement>(".create-button").element.disabled,
    ).toBe(true);
    resolve([]);
    await flushPromises();
    expect(wrapper.find(".skeleton").exists()).toBe(false);
  });
  it("waits with a refresh while a Daily editor is open, then loads once", async () => {
    vi.mocked(getHabits).mockResolvedValue([habit()]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    window.dispatchEvent(new Event("timer-data-changed"));
    await flushPromises();
    expect(getHabits).toHaveBeenCalledTimes(2);
    await wrapper
      .get('[data-habit-id="10"] [data-edit-button]')
      .trigger("click");
    await flushPromises();
    window.dispatchEvent(new Event("timer-data-changed"));
    await flushPromises();
    expect(getHabits).toHaveBeenCalledTimes(2);
    expect(wrapper.find("dialog").exists()).toBe(true);
    // The change heard meanwhile loads as soon as the editor is closed.
    await wrapper.get(".modal-dialog__close").trigger("click");
    await flushPromises();
    expect(getHabits).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new Event("timer-data-changed"));
    await flushPromises();
    expect(getHabits).toHaveBeenCalledTimes(4);
  });
  it("shows an empty state with no persistent creation form", async () => {
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.text()).toContain("Dein erstes Daily");
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(wrapper.find("form").exists()).toBe(false);
  });
  it("opens the Daily form with a starter idea filled in", async () => {
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    const ideas = wrapper.findAll(".habits-start__ideas button");
    expect(ideas.map((idea) => idea.text())).toEqual([
      "Wasser trinken",
      "10 Min. lesen",
      "Spazieren gehen",
    ]);
    await ideas[1]!.trigger("click");
    await flushPromises();
    const dialog = wrapper.get("dialog");
    expect(dialog.text()).toContain("Neues Daily");
    expect(
      dialog.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("10 Min. lesen");
  });
  it("explains the history marks once, above the first card", async () => {
    const recentDays = [
      { date: "2026-10-02", state: "done" as const },
      { date: "2026-10-03", state: "open" as const },
    ];
    vi.mocked(getHabits).mockResolvedValue([
      habit({ streak: { ...HABIT_FIELDS.streak, recentDays } }),
      habit({ id: 11, title: "Lesen", streak: { ...HABIT_FIELDS.streak, recentDays } }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    const legends = wrapper.findAll(".history-legend");
    expect(legends).toHaveLength(1);
    expect(legends[0]!.text()).toBe(
      "Letzte 14 Tage:✓erledigt−verpasst↷übersprungen○noch offen·kein Eintrag",
    );
    // The legend draws the strip's own marks.
    const stripMark = wrapper.get(".history .day-mark.done");
    const legendMark = legends[0]!.get(".day-mark.done");
    expect(legendMark.text()).toBe(stripMark.text());
  });
  it("groups active and paused habits and says their schedules in plain words", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit(),
      habit({
        id: 11,
        title: "Gitarre spielen",
        isActive: false,
        plannedDurationMinutes: null,
        timerOccurrenceId: null,
        timerDurationMinutes: null,
        currentSchedule: version({
          type: "fixed_weekdays",
          weekdays: ["thursday", "monday"],
          missedOccurrencePolicy: "skip",
        }),
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get('[data-group="none"]').text()).toContain("Joggen");
    expect(wrapper.get('[data-group="paused"]').text()).toContain(
      "Gitarre spielen",
    );
    expect(wrapper.text()).toContain("Mo, Do");
    expect(wrapper.text()).toContain("Alle 2 Tage");
    expect(wrapper.text()).not.toContain("Gültig seit");
    // Without a category the active ones stand under "Ohne Kategorie".
    expect(wrapper.get('[data-group="none"] h2').text()).toBe(
      "Ohne Kategorie 1",
    );
    expect(wrapper.findAll("[data-habit-id] h3")).toHaveLength(2);
    expect(wrapper.findAll("[data-habit-id]")).toHaveLength(2);
  });
  it("shows a future-only habit so it can be edited before it is due", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({
        currentSchedule: null,
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 3 },
          "2026-10-10",
        ),
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.text()).toContain("Ab 10.10.: 3× pro Woche");
    expect(
      wrapper.find('button[aria-label="Joggen bearbeiten"]').exists(),
    ).toBe(true);
  });
  it("shows current and upcoming schedules without replacing one with the other", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 4 },
          "2026-10-10",
        ),
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get(".habit-card__details").text()).toContain("Alle 2 Tage");
    expect(wrapper.get(".habit-card__next").text()).toBe(
      "Ab 10.10.: 4× pro Woche",
    );
  });
  it("shows the why, category, time and duration on the card", async () => {
    vi.mocked(getCategories).mockResolvedValue([{ id: 3, name: "Sport" }]);
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({
        why: "Damit ich fit bleibe",
        categoryId: 3,
        timeOfDay: "07:30",
        plannedDurationMinutes: 20,
        currentSchedule: version({ type: "weekly_target", weeklyTarget: 3 }),
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get(".habit-card__why").text()).toBe("Damit ich fit bleibe");
    expect(wrapper.get(".habit-card__details").text()).toBe(
      "Sport3× pro Woche07:30 Uhr20 Min.",
    );
    expect(wrapper.find(".category-mark").exists()).toBe(true);
  });
  it("shows an inherited why as a quiet line like the rest of the app", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({
        inheritedWhy: {
          text: "Für den Marathon",
          fromId: 4,
          fromTitle: "Lauf",
        },
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get(".habit-card__why").text()).toBe("Für den Marathon");
  });
  describe("status this week", () => {
    // Saturday, 3 October 2026 (see the clock above); the week is 28 Sep to 4 Oct.
    const TODAY = "2026-10-03";
    function week(
      days: Partial<Record<string, Partial<HistoryResponse["days"][number]>>>,
      weeklyTargets: HistoryResponse["weeklyTargets"] = [],
    ): HistoryResponse {
      return {
        today: TODAY,
        timeZone: "Europe/Berlin",
        startDate: "2026-09-28",
        endDate: "2026-10-04",
        weeklyTargets,
        days: [
          "09-28",
          "09-29",
          "09-30",
          "10-01",
          "10-02",
          "10-03",
          "10-04",
        ].map((day) => ({
          date: `2026-${day}`,
          items: [],
          planned: [],
          work: { minutes: 0 },
          ...days[`2026-${day}`],
        })),
      };
    }
    const run = (id: number, status: "completed" | "skipped") => ({
      ...HISTORY_ITEM_FIELDS,
      type: "habit" as const,
      id: 50 + id,
      habitId: id,
      title: "Daily",
      status,
      date: TODAY,
      scheduledDate: TODAY,
      resolvedAt: `${TODAY}T07:00:00Z`,
      plannedDurationMinutes: null,
      deleted: false,
    });
    const due = (id: number, date: string) => ({
      ...PLANNED_FIELDS,
      key: `habit:${id}:${date}`,
      type: "habit" as const,
      id: null,
      habitId: id,
      title: "Daily",
      date,
      scheduledDate: date,
      isOverdue: false,
      plannedDurationMinutes: null,
    });

    it("counts a weekly target and names today or the next due day", async () => {
      vi.mocked(getHabits).mockResolvedValueOnce([
        habit({
          id: 1,
          title: "Krafttraining",
          currentSchedule: version({ type: "weekly_target", weeklyTarget: 3 }),
        }),
        habit({ id: 2, title: "Lesen" }),
        habit({ id: 3, title: "Joggen" }),
        habit({ id: 4, title: "Gießen" }),
        habit({ id: 5, title: "Putzen" }),
        habit({ id: 6, title: "Pausiert", isActive: false }),
      ]);
      vi.mocked(getHistory).mockResolvedValueOnce(
        week(
          {
            [TODAY]: { items: [run(2, "completed")], planned: [due(3, TODAY)] },
            "2026-10-04": { planned: [due(4, "2026-10-04")] },
          },
          [
            {
              key: "weekly:1",
              habitId: 1,
              title: "Krafttraining",
              target: 3,
              completed: 2,
              remaining: 1,
              fromDate: TODAY,
              untilDate: "2026-10-04",
            },
          ],
        ),
      );
      const wrapper = mount(HabitsView);
      await flushPromises();
      expect(getHistory).toHaveBeenCalledWith(TODAY, "week", "habits");
      const status = (id: number) =>
        wrapper.find(`[data-habit-id="${id}"] .habit-card__status`);
      expect(status(1).text()).toBe("2 von 3 diese Woche");
      expect(status(2).text()).toBe("heute erledigt");
      expect(status(3).text()).toBe("heute fällig");
      expect(status(4).text()).toBe("morgen fällig");
      expect(status(5).text()).toBe("diese Woche nicht mehr fällig");
      expect(status(6).exists()).toBe(false);
    });

    it("gives today's run a ring: ticked through its occurrence, with undo", async () => {
      vi.mocked(updateOccurrenceStatus).mockResolvedValue(undefined);
      vi.mocked(getHabits).mockResolvedValue([
        habit({ id: 2, title: "Lesen" }),
        habit({ id: 3, title: "Joggen", timerOccurrenceId: 31 }),
        habit({ id: 4, title: "Gießen" }),
      ]);
      vi.mocked(getHistory).mockResolvedValue(
        week({
          [TODAY]: { items: [run(2, "completed")], planned: [due(3, TODAY)] },
        }),
      );
      const wrapper = mount(HabitsView);
      await flushPromises();
      const card = (id: number) => wrapper.get(`[data-habit-id="${id}"]`);
      // Done today: a filled ring that opens the run again.
      const done = card(2).get('[aria-label="Lesen heute wieder öffnen"]');
      expect(done.classes()).toContain("check-ring--checked");
      // Nothing due today: no ring, but its place, so the titles line up.
      expect(card(4).find(".check-ring").exists()).toBe(false);
      expect(card(4).find(".habit-card__ring").exists()).toBe(true);

      await card(3)
        .get('[aria-label="Joggen heute erledigen"]')
        .trigger("click");
      await flushPromises();
      expect(updateOccurrenceStatus).toHaveBeenCalledWith(31, "completed");
      expect(wrapper.get(".undo-toast").text()).toContain("„Joggen“ erledigt");
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Rückgängig")!
        .trigger("click");
      await flushPromises();
      expect(updateOccurrenceStatus).toHaveBeenLastCalledWith(31, "pending");

      await done.trigger("click");
      await flushPromises();
      expect(updateOccurrenceStatus).toHaveBeenLastCalledWith(52, "pending");
    });

    it("keeps the list without a status when the week does not load", async () => {
      vi.mocked(getHabits).mockResolvedValueOnce([habit()]);
      vi.mocked(getHistory).mockRejectedValueOnce(new Error("offline"));
      const wrapper = mount(HabitsView);
      await flushPromises();
      expect(wrapper.text()).toContain("Joggen");
      expect(wrapper.find(".habit-card__status").exists()).toBe(false);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });
  it("offers a retry when loading fails", async () => {
    vi.mocked(getHabits)
      .mockRejectedValueOnce(new Error("Backend nicht erreichbar"))
      .mockResolvedValueOnce([habit()]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    const retry = wrapper
      .findAll(".alert button")
      .find((button) => button.text() === "Erneut versuchen");
    await retry!.trigger("click");
    await flushPromises();
    expect(wrapper.find(".alert").exists()).toBe(false);
    expect(wrapper.find('[data-habit-id="10"]').exists()).toBe(true);
  });
  it("handles a habit with no schedule", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({ currentSchedule: null }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get(".habit-card__details").text()).toBe(
      "Noch kein Zeitplan",
    );
  });
  it("shows an initial load error without an empty state", async () => {
    vi.mocked(getHabits).mockRejectedValueOnce(
      new Error("Backend nicht erreichbar"),
    );
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );
    expect(wrapper.text()).not.toContain("Dein erstes Daily");
  });
  it("preserves loaded habits when a refresh fails", async () => {
    vi.mocked(getHabits)
      .mockResolvedValueOnce([habit()])
      .mockRejectedValueOnce(new Error("Aktualisieren fehlgeschlagen"));
    const wrapper = mount(HabitsView);
    await flushPromises();
    window.dispatchEvent(new Event("timer-data-changed"));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Aktualisieren fehlgeschlagen",
    );
    expect(wrapper.find('[data-habit-id="10"]').exists()).toBe(true);
  });
  it("opens the Daily form directly and reloads after future habit creation", async () => {
    const future = habit({
      currentSchedule: null,
      upcomingSchedule: version(
        {
          type: "interval",
          intervalDays: 1,
          missedOccurrencePolicy: "carry_over",
        },
        "2026-10-10",
      ),
    });
    vi.mocked(getHabits)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([future]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper.get('button[aria-label="Daily erstellen"]').trigger("click");
    expect(wrapper.find(".create-habit").exists()).toBe(true);
    expect(wrapper.find('[data-test="choose-todo"]').exists()).toBe(false);
    await wrapper.get('dialog input[name="title"]').setValue("Joggen");
    await wrapper.get('dialog input[name="startDate"]').setValue("2026-10-10");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(createHabit).toHaveBeenCalledWith({
      title: "Joggen",
      startDate: "2026-10-10",
      schedule: {
        type: "interval",
        intervalDays: 1,
        missedOccurrencePolicy: "carry_over",
      },
    });
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(getHabits).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Ab 10.10.: Täglich");
    expect(wrapper.get('[role="status"]').text()).toBe("Daily erstellt.");
  });
  it("cancels creation without reloading", async () => {
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper.get(".create-button").trigger("click");
    await wrapper.get(".modal-dialog__close").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(createHabit).not.toHaveBeenCalled();
    expect(getHabits).toHaveBeenCalledTimes(1);
  });
  it("opens the editor from a tap on the card and from Bearbeiten in its menu", async () => {
    vi.mocked(getHabits).mockResolvedValue([habit()]);
    vi.mocked(getHabit).mockResolvedValue(habit());
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    const card = wrapper.get(".habit-card");
    expect(card.classes()).toContain("card-target");
    await card.get(".habit-card__details").trigger("click");
    await flushPromises();
    expect(wrapper.find(".item-editor").exists()).toBe(true);
    wrapper.unmount();

    const again = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    await again.get('[aria-label="Aktionen für Joggen"]').trigger("click");
    expect(
      again.findAll("[role=menuitem] .action-menu__label").map((l) => l.text()),
    ).toEqual(["Bearbeiten", "Löschen"]);
    await again.get("[role=menuitem]").trigger("click");
    await flushPromises();
    expect(again.find(".item-editor").exists()).toBe(true);
    again.unmount();
  });
  it("reactivates a paused habit through the existing editor", async () => {
    const paused = habit({ isActive: false });
    vi.mocked(getHabits)
      .mockResolvedValueOnce([paused])
      .mockResolvedValueOnce([habit()]);
    vi.mocked(getHabit).mockResolvedValueOnce(paused);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>('input[name="isActive"]').element.checked,
    ).toBe(false);
    expect(
      wrapper.get<HTMLButtonElement>(".create-button").element.disabled,
    ).toBe(true);
    await wrapper.get('input[name="isActive"]').setValue(true);
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(updateHabit).toHaveBeenCalledWith(10, { isActive: true });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.find(".item-editor").exists()).toBe(false);
    expect(wrapper.find('[data-group="paused"]').exists()).toBe(false);
    expect(wrapper.get('[data-group="none"]').text()).toContain("Joggen");
  });
  it("edits a planned version before the habit has started", async () => {
    const future = habit({
      currentSchedule: null,
      upcomingSchedule: version(
        { type: "weekly_target", weeklyTarget: 3 },
        "2026-10-10",
      ),
    });
    vi.mocked(getHabits).mockResolvedValue([future]);
    vi.mocked(getHabit).mockResolvedValueOnce(future);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="edit-upcoming"]').trigger("click");
    await wrapper.get('input[name="weeklyTarget"]').setValue("4");
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: { type: "weekly_target", weeklyTarget: 4 },
    });
    expect(getHabits).toHaveBeenCalledTimes(2);
  });
  it("removes a habit only after confirmation and reloads the list", async () => {
    vi.mocked(getHabits)
      .mockResolvedValueOnce([habit()])
      .mockResolvedValueOnce([]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="request-delete"]').trigger("click");
    expect(deleteHabit).not.toHaveBeenCalled();
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(deleteHabit).toHaveBeenCalledWith(10);
    expect(wrapper.find('[data-habit-id="10"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Dein erstes Daily");
  });
  it("keeps the editor and list when saving fails", async () => {
    vi.mocked(getHabits).mockResolvedValue([habit()]);
    vi.mocked(updateHabit).mockRejectedValueOnce(
      new Error("Speichern fehlgeschlagen"),
    );
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('.item-editor [role="alert"]').text()).toBe(
      "Speichern fehlgeschlagen",
    );
    expect(wrapper.find('[data-habit-id="10"]').exists()).toBe(true);
    expect(getHabits).toHaveBeenCalledTimes(1);
  });
  it("cancels editing without a write or reload", async () => {
    vi.mocked(getHabits).mockResolvedValue([habit()]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    const button = wrapper
      .findAll(".item-editor button")
      .find((button) => button.text() === "Abbrechen");
    await button!.trigger("click");
    expect(wrapper.find(".item-editor").exists()).toBe(false);
    expect(updateHabit).not.toHaveBeenCalled();
    expect(getHabits).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal locked during refresh and restores focus to the saved habit", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([habit()]);
    let finish!: (value: HabitResponse[]) => void;
    vi.mocked(getHabits).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get<HTMLButtonElement>(
      '[data-habit-id="10"] [data-edit-button]',
    );
    button.element.focus();
    await button.trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('dialog input[name="title"]').element,
    );
    await wrapper.get('dialog input[name="title"]').setValue("Neuer Name");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(true);
    expect(
      wrapper.get<HTMLButtonElement>(".modal-dialog__close").element.disabled,
    ).toBe(true);
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(updateHabit).toHaveBeenCalledTimes(1);
    finish([habit({ title: "Neuer Name" })]);
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(
      wrapper.get('[data-habit-id="10"] [data-edit-button]').element,
    );
    wrapper.unmount();
  });
  it("returns focus to plus after deleting the last habit", async () => {
    vi.mocked(getHabits)
      .mockResolvedValueOnce([habit()])
      .mockResolvedValueOnce([]);
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-edit-button]").trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="request-delete"]').trigger("click");
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get(".create-button").element);
    wrapper.unmount();
  });
  it("keeps creation open and locked until the refreshed list arrives", async () => {
    let finish!: (value: HabitResponse[]) => void;
    vi.mocked(getHabits)
      .mockReturnValueOnce(Promise.resolve([]))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    const plus = wrapper.get<HTMLButtonElement>(".create-button");
    plus.element.focus();
    await plus.trigger("click");
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(
      wrapper.get<HTMLButtonElement>(".modal-dialog__close").element.disabled,
    ).toBe(true);
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(createHabit).toHaveBeenCalledTimes(1);
    finish([habit()]);
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get(".create-button").element);
    wrapper.unmount();
  });
  describe("categories, filter and series", () => {
    const campaign = { id: 7, title: "Marathon", color: null, icon: null };
    beforeEach(() => {
      vi.mocked(getCategories).mockResolvedValue([
        { id: 2, name: "Sport", color: "pine" },
        { id: 1, name: "Lernen", color: null },
      ]);
      vi.mocked(getHabits).mockResolvedValue([
        habit({ id: 1, title: "Vokabeln", categoryId: 1 }),
        habit({ id: 2, title: "Laufen", categoryId: 2, campaign }),
        habit({ id: 3, title: "Lesen" }),
      ]);
    });

    it("groups the Dailies by category with its mark, then those without", async () => {
      const wrapper = mount(HabitsView);
      await flushPromises();
      const groups = wrapper.findAll("[data-group]");
      expect(groups.map((group) => group.get("h2").text())).toEqual([
        "Sport 1",
        "Lernen 1",
        "Ohne Kategorie 1",
      ]);
      expect(
        groups[0]!.get("h2 .category-mark").attributes("style"),
      ).toContain("var(--color-mark-pine)");
      expect(groups[2]!.find("h2 .category-mark").exists()).toBe(false);
    });

    it("filters by category and campaign through the address", async () => {
      const wrapper = mount(HabitsView);
      await flushPromises();
      await wrapper.get('select[name="filterCategory"]').setValue("2");
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({ kategorie: "2" });
      expect(wrapper.findAll("[data-habit-id]").map((row) => row.text())).toEqual([
        expect.stringContaining("Laufen"),
      ]);

      await router.replace({ query: { kampagne: "ohne" } });
      await flushPromises();
      expect(
        wrapper.get<HTMLSelectElement>('select[name="filterCampaign"]').element
          .value,
      ).toBe("ohne");
      expect(wrapper.findAll("[data-habit-id]")).toHaveLength(2);

      await router.replace({ query: { kampagne: "7", kategorie: "1" } });
      await flushPromises();
      expect(wrapper.text()).toContain("Keine Dailies für diesen Filter.");
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Alle zeigen")!
        .trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({});
      expect(wrapper.findAll("[data-habit-id]")).toHaveLength(3);
    });

    it("says each series with its record, a broken one as a plain number", async () => {
      vi.mocked(getHabits).mockResolvedValue([
        habit({ id: 1, streak: { current: 12, best: 21, unit: "runs" } }),
        habit({ id: 2, streak: { current: 0, best: 4, unit: "weeks" } }),
        habit({ id: 3 }),
      ]);
      const wrapper = mount(HabitsView);
      await flushPromises();
      const streak = (id: number) =>
        wrapper.find(`[data-habit-id="${id}"] .habit-card__streak`);
      expect(streak(1).text()).toBe("12 in Folge · Rekord 21");
      expect(streak(2).text()).toBe("0 Wochen in Folge · Rekord 4 Wochen");
      expect(streak(3).exists()).toBe(false);
    });
  });
});
