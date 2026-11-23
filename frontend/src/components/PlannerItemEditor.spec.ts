import { HABIT_FIELDS, TODO_FIELDS } from "../types/fixtures";
import {
  getDeletionPreview,
  getTodoHierarchy,
} from "../api/todo-hierarchy.api";
import { choose } from "../test/combobox";
import { hierarchyTodo } from "../test/hierarchy";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeHabitSchedule,
  deleteHabit,
  deleteTodo,
  getHabit,
  getTodo,
  updateHabit,
  updateTodo,
} from "../api/day-planner.api";
import type {
  HabitResponse,
  HabitScheduleRule,
  ScheduleVersionResponse,
} from "../types/habit";
import type { TodoResponse } from "../types/todo";
import { getCategories } from "../api/categories.api";
import { request } from "../api/http";
import PlannerItemEditor from "./PlannerItemEditor.vue";

vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(async () => [{ id: 7, name: "Sport" }]),
  createCategory: vi.fn(),
}));
vi.mock("../api/todo-hierarchy.api", () => ({
  getDeletionPreview: vi.fn(),
  getTodoHierarchy: vi.fn(async () => []),
}));
vi.mock("../api/day-planner.api", () => ({
  createHabit: vi.fn(),
  createTodo: vi.fn(),
  getTodo: vi.fn(),
  getHabit: vi.fn(),
  updateTodo: vi.fn(),
  updateHabit: vi.fn(),
  changeHabitSchedule: vi.fn(),
  deleteTodo: vi.fn(),
  deleteHabit: vi.fn(),
}));
vi.mock("../api/http", () => ({ request: vi.fn() }));
vi.mock("./QuestNotes.vue", () => import("../test/quest-notes-stub"));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

const todo: TodoResponse = {
  ...TODO_FIELDS,
  id: 1,
  parentId: null,
  title: "NestJS lernen",
  completed: false,
  completedAt: null,
  scheduledDate: "2026-10-02",
  timeOfDay: null,
  plannedDurationMinutes: 30,
  timerEligible: true,
};
const interval: HabitScheduleRule = {
  type: "interval",
  intervalDays: 2,
  missedOccurrencePolicy: "carry_over",
};
function version(
  schedule: HabitScheduleRule = interval,
  effectiveFrom = "2026-10-01",
): ScheduleVersionResponse {
  return {
    id: 100,
    effectiveFrom,
    effectiveAt: `${effectiveFrom}T08:00:00.000Z`,
    endsAt: null,
    cancelledAt: null,
    firstDueDate: effectiveFrom,
    schedule,
  };
}
function makeHabit(overrides: Partial<HabitResponse> = {}): HabitResponse {
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
function mountHabitEditor() {
  return mount(PlannerItemEditor, { props: { kind: "habit", entityId: 10 } });
}
async function editSchedule(wrapper: ReturnType<typeof mountHabitEditor>) {
  await flushPromises();
  await wrapper.get('input[name="changeSchedule"]').setValue(true);
}
async function save(wrapper: ReturnType<typeof mountHabitEditor>) {
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}

describe("PlannerItemEditor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDeletionPreview).mockResolvedValue({
      confirmationToken: "a".repeat(64),
      todos: [
        { id: 1, title: "NestJS lernen", parentId: null, completed: false },
      ],
      timers: [],
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    vi.mocked(getCategories).mockResolvedValue([{ id: 7, name: "Sport" }]);
    vi.mocked(request).mockResolvedValue([{ id: 3, title: "Joggen" }]);
    vi.mocked(getTodo).mockResolvedValue(todo);
    vi.mocked(getHabit).mockResolvedValue(makeHabit());
    vi.mocked(updateTodo).mockResolvedValue(todo);
    vi.mocked(updateHabit).mockResolvedValue(makeHabit());
    vi.mocked(changeHabitSchedule).mockResolvedValue(makeHabit());
    vi.mocked(deleteTodo).mockResolvedValue(undefined);
    vi.mocked(deleteHabit).mockResolvedValue(undefined);
  });

  it("updates or clears a Daily default duration without changing its schedule", async () => {
    vi.mocked(getHabit).mockResolvedValue(
      makeHabit({ plannedDurationMinutes: 10 }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>('input[name="duration"]').element.value,
    ).toBe("10");
    await wrapper.get('input[name="duration"]').setValue("");
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledWith(10, {
      plannedDurationMinutes: null,
    });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });
  it("sets the Fokus-Sperre of a quest and of a daily in their editors", async () => {
    vi.mocked(getTodo).mockResolvedValue({ ...todo, focusBlock: "never" });
    const quest = mount(PlannerItemEditor, {
      props: { kind: "todo", entityId: 1 },
    });
    await flushPromises();
    // A choice of its own keeps its group open.
    expect(
      quest.get<HTMLInputElement>("[data-test='focus-block-never']").element
        .checked,
    ).toBe(true);
    await quest.get("[data-test='focus-block-always']").setValue(true);
    await save(quest);
    expect(vi.mocked(updateTodo).mock.calls[0]![1]).toMatchObject({
      focusBlock: "always",
    });

    const daily = mountHabitEditor();
    await flushPromises();
    await daily.findAll("button").find((b) => b.text().startsWith("Fokus-Sperre"))!.trigger("click");
    await daily.get("[data-test='focus-block-never']").setValue(true);
    await save(daily);
    expect(updateHabit).toHaveBeenCalledWith(10, { focusBlock: "never" });
  });

  it("offers notes for a quest, and for a daily only when opened from a run", async () => {
    const quest = mount(PlannerItemEditor, {
      props: { kind: "todo", entityId: 1 },
    });
    const daily = mountHabitEditor();
    const run = mount(PlannerItemEditor, {
      props: { kind: "habit", entityId: 10, occurrenceId: 20 },
    });
    await flushPromises();
    expect(quest.get("[data-notes]").attributes("data-notes")).toBe("todo-1");
    expect(daily.find("[data-notes]").exists()).toBe(false);
    expect(run.get("[data-notes]").attributes("data-notes")).toBe(
      "occurrence-20",
    );
  });

  describe("Gehört zu", () => {
    beforeEach(() => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        hierarchyTodo({ id: 4, title: "Buch", why: "Erzählen", categoryId: 7 }),
        hierarchyTodo({
          id: 5,
          title: "Kapitel 2",
          parentId: 4,
          inheritedWhy: { text: "Erzählen", fromId: 4, fromTitle: "Buch" },
        }),
        hierarchyTodo({ id: 1, title: "NestJS lernen" }),
      ]);
    });
    const mountQuest = () =>
      mount(PlannerItemEditor, {
        props: { kind: "todo", entityId: 1, embedded: true },
      });

    it("moves the quest below a chosen one, inheriting its why and the campaign's category", async () => {
      const wrapper = mountQuest();
      await flushPromises();
      await choose(wrapper, "#planner-edit-parent", "Kapitel");
      expect(wrapper.get("blockquote").text()).toContain("Erzählen");
      await save(wrapper);
      expect(updateTodo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ parentId: 5, categoryId: 7 }),
      );
      expect(vi.mocked(updateTodo).mock.calls[0]![1]).not.toHaveProperty(
        "why",
      );
    });

    it("never offers the quest itself, and offers Keine to detach", async () => {
      vi.mocked(getTodo).mockResolvedValue({ ...todo, parentId: 4 });
      const wrapper = mountQuest();
      await flushPromises();
      const options = wrapper
        .findAll("#planner-edit-parent ~ ul [role=option]")
        .map((option) => option.text());
      expect(options).toEqual(["Keine (lose Quest)", "Buch", "Buch › Kapitel 2"]);
      await choose(wrapper, "#planner-edit-parent", "Keine");
      await save(wrapper);
      expect(updateTodo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ parentId: null }),
      );
    });

    it("sends no campaign fields once the quest goes below another one", async () => {
      const wrapper = mountQuest();
      await flushPromises();
      await wrapper.get('.item-editor__more button[aria-expanded]').trigger("click");
      await wrapper
        .get('.item-editor__more input[type="radio"][value="pine"]')
        .setValue(true);
      await choose(wrapper, "#planner-edit-parent", "Buch");
      expect(wrapper.find('input[name="weeklyTarget"]').exists()).toBe(false);
      await save(wrapper);
      const input = vi.mocked(updateTodo).mock.calls[0]![1];
      expect(input).toMatchObject({ parentId: 4 });
      expect(input).not.toHaveProperty("color");
    });
  });

  describe("campaign form", () => {
    const campaign = {
      ...todo,
      scheduledDate: null,
      plannedDurationMinutes: null,
      color: "pine",
      campaign: { id: 1, title: "NestJS lernen", color: "pine", icon: null },
    };

    it("leaves out day, duration, appointment and Gehört zu, and says what makes a campaign", async () => {
      vi.mocked(getTodo).mockResolvedValue(campaign);
      const wrapper = mount(PlannerItemEditor, {
        props: { kind: "todo", entityId: 1 },
      });
      await flushPromises();
      for (const field of [
        'input[name="scheduledDate"]',
        'input[name="duration"]',
        'input[name="timeOfDay"]',
        "#planner-edit-parent",
        '[role="radiogroup"][aria-label="Art"]',
      ])
        expect(wrapper.find(field).exists()).toBe(false);
      for (const field of [
        'input[name="title"]',
        'textarea[name="why"]',
        "#planner-edit-category",
        'input[name="weeklyTarget"]',
        "[data-notes]",
      ])
        expect(wrapper.find(field).exists()).toBe(true);
      expect(wrapper.text()).toContain(
        "Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat oder eine Farbe, ein Symbol oder ein Wochenziel bekommt.",
      );
    });

    it("still shows a day a campaign already has, so it can be cleared", async () => {
      vi.mocked(getTodo).mockResolvedValue({
        ...campaign,
        scheduledDate: "2026-10-02",
      });
      const wrapper = mount(PlannerItemEditor, {
        props: { kind: "todo", entityId: 1 },
      });
      await flushPromises();
      expect(wrapper.find('input[name="scheduledDate"]').exists()).toBe(true);
    });
  });

  describe("Quest or Daily", () => {
    const mountQuest = () =>
      mount(PlannerItemEditor, {
        props: { kind: "todo", entityId: 1, embedded: true },
      });

    it("turns an open quest into a daily: the daily is created, then the quest deleted", async () => {
      vi.mocked(getTodo).mockResolvedValue({
        ...todo,
        why: "Backend verstehen",
        categoryId: 7,
      });
      const wrapper = mountQuest();
      await flushPromises();
      await wrapper.get('[data-test="kind-habit"]').setValue(true);
      expect(wrapper.emitted("mode")).toEqual([["habit"]]);
      expect(
        wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
      ).toBe("NestJS lernen");
      expect(wrapper.text()).toContain("die Quest „NestJS lernen“ wird gelöscht");
      expect(updateTodo).not.toHaveBeenCalled();
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      const { createHabit } = await import("../api/day-planner.api");
      expect(createHabit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "NestJS lernen",
          why: "Backend verstehen",
          categoryId: 7,
        }),
      );
      expect(deleteTodo).toHaveBeenCalledWith(1, "a".repeat(64));
      expect(wrapper.emitted("changed")).toEqual([[]]);
    });

    it("is not offered for a quest with quests below it or a done one", async () => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        hierarchyTodo({ id: 1, title: "NestJS lernen" }),
        hierarchyTodo({ id: 2, title: "Module", parentId: 1 }),
      ]);
      const parent = mountQuest();
      await flushPromises();
      expect(parent.find('[data-test="kind-habit"]').exists()).toBe(false);

      vi.mocked(getTodoHierarchy).mockResolvedValue([]);
      vi.mocked(getTodo).mockResolvedValue({ ...todo, completed: true });
      const done = mountQuest();
      await flushPromises();
      expect(done.find('[data-test="kind-habit"]').exists()).toBe(false);
    });
  });

  describe("daily campaign", () => {
    it("names a campaign, takes over its why and category", async () => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        hierarchyTodo({
          id: 4,
          title: "Marathon",
          why: "Gesund alt werden",
          categoryId: 7,
          color: "pine",
        }),
      ]);
      const wrapper = mountHabitEditor();
      await flushPromises();
      await choose(wrapper, "#planner-edit-campaign", "Mara");
      expect(wrapper.get("blockquote").text()).toContain("Gesund alt werden");
      await save(wrapper);
      expect(updateHabit).toHaveBeenCalledWith(10, {
        campaignId: 4,
        categoryId: 7,
      });
    });

    it("puts the rhythm before category, campaign and why", async () => {
      const wrapper = mountHabitEditor();
      await flushPromises();
      const html = wrapper.html();
      const at = (text: string) => html.indexOf(text);
      expect(at("schedule-summary")).toBeLessThan(at("planner-edit-category"));
      expect(at("planner-edit-category")).toBeLessThan(
        at("planner-edit-campaign"),
      );
      expect(at("planner-edit-campaign")).toBeLessThan(at("planner-edit-why"));
      expect(at("planner-edit-why")).toBeLessThan(at('name="timeOfDay"'));
    });
  });

  it("saves a todo and keeps the day it is planned for", async () => {
    const wrapper = mount(PlannerItemEditor, {
      props: { kind: "todo", entityId: 1 },
    });
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Vue lernen");
    await save(wrapper);
    expect(updateTodo).toHaveBeenCalledWith(1, {
      title: "Vue lernen",
      scheduledDate: "2026-10-02",
      timeOfDay: null,
      plannedDurationMinutes: 30,
    });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.emitted("changed")).toEqual([[]]);
  });

  it("sets colour, icon and weekly goal of a campaign and sends only those", async () => {
    vi.mocked(getTodo).mockResolvedValue({
      ...todo,
      color: "moss",
      weeklyTargetMinutes: 120,
    });
    const wrapper = mount(PlannerItemEditor, {
      props: { kind: "todo", entityId: 1 },
    });
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>('input[name="weeklyTarget"]').element.value,
    ).toBe("2");
    expect(
      wrapper.get<HTMLInputElement>('input[type="radio"][value="moss"]').element
        .checked,
    ).toBe(true);
    await wrapper.get('input[type="radio"][value="berry"]').setValue(true);
    await wrapper.get('input[type="radio"][value="book"]').setValue(true);
    await wrapper.get('input[name="weeklyTarget"]').setValue("3.5");
    await save(wrapper);
    expect(updateTodo).toHaveBeenCalledWith(1, {
      title: "NestJS lernen",
      scheduledDate: "2026-10-02",
      timeOfDay: null,
      plannedDurationMinutes: 30,
      color: "berry",
      icon: "book",
      weeklyTargetMinutes: 210,
    });
  });

  it("names the chosen colour in words and rejects an uneven goal", async () => {
    const wrapper = mount(PlannerItemEditor, {
      props: { kind: "todo", entityId: 1 },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Automatisch aus dem Titel");
    await wrapper.get('input[type="radio"][value="indigo"]').setValue(true);
    expect(wrapper.text()).toContain("Indigo");
    expect(
      wrapper.get('input[type="radio"][value="indigo"]').element.closest("label")
        ?.textContent,
    ).toContain("Indigo");
    await wrapper.get('input[name="weeklyTarget"]').setValue("2.25");
    await save(wrapper);
    expect(updateTodo).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("halben Stunden");
  });

  it("offers colour, icon and goal only for a quest without parent", async () => {
    vi.mocked(getTodo).mockResolvedValue({ ...todo, parentId: 5 });
    const wrapper = mount(PlannerItemEditor, {
      props: { kind: "todo", entityId: 1 },
    });
    await flushPromises();
    expect(wrapper.find('input[name="weeklyTarget"]').exists()).toBe(false);
    expect(wrapper.find('input[type="radio"][value="moss"]').exists()).toBe(
      false,
    );
  });

  it("shows the current schedule without enabling schedule writes", async () => {
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.get('[data-test="schedule-summary"]').text()).toContain(
      "Alle 2 Tage",
    );
    expect(wrapper.text()).toContain("01.10.2026");
    expect(wrapper.find('[data-test="schedule-fields"]').exists()).toBe(false);
    await save(wrapper);
    expect(updateHabit).not.toHaveBeenCalled();
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });

  it("sends only changed metadata and preserves a planned schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 3 },
          "2026-10-10",
        ),
      }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.text()).toContain("Geplant ab 10.10.2026");
    await wrapper.get('input[name="title"]').setValue("Gitarre spielen");
    await wrapper.get('input[name="isActive"]').setValue(false);
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledWith(10, {
      title: "Gitarre spielen",
      isActive: false,
    });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });

  it("defaults the change date to today in Europe/Berlin, not the device zone", async () => {
    vi.setSystemTime(new Date("2026-10-01T22:30:00Z"));
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    expect(
      wrapper.get<HTMLInputElement>('input[name="effectiveFrom"]').element
        .value,
    ).toBe("2026-10-02");
    expect(wrapper.get('input[name="effectiveFrom"]').attributes("min")).toBe(
      "2026-10-02",
    );
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await save(wrapper);
    expect(updateHabit).not.toHaveBeenCalled();
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "interval",
        intervalDays: 4,
        missedOccurrencePolicy: "carry_over",
      },
    });
  });

  it("allows a future effective date", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="effectiveFrom"]').setValue("2026-10-10");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: interval,
    });
  });

  it("prefills a future version explicitly when editing the planned schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 5 },
          "2026-10-10",
        ),
      }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    await wrapper.get('[data-test="edit-upcoming"]').trigger("click");
    expect(
      wrapper.get<HTMLInputElement>('input[name="effectiveFrom"]').element
        .value,
    ).toBe("2026-10-10");
    expect(
      wrapper.get<HTMLInputElement>('input[name="weeklyTarget"]').element.value,
    ).toBe("5");
    await wrapper.get('input[name="weeklyTarget"]').setValue("4");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: { type: "weekly_target", weeklyTarget: 4 },
    });
  });

  it("handles a habit that has only an upcoming schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        currentSchedule: null,
        upcomingSchedule: version(interval, "2026-10-10"),
      }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.text()).toContain("noch keinen aktuell gültigen Zeitplan");
    await wrapper.get('[data-test="edit-upcoming"]').trigger("click");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: interval,
    });
  });

  it("handles a habit without either schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({ currentSchedule: null }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: { ...interval, intervalDays: 1 },
    });
  });

  it("switches to fixed weekdays without incompatible fields", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");
    await wrapper
      .get('input[name="weekdays"][value="thursday"]')
      .setValue(true);
    await wrapper.get('input[name="weekdays"][value="monday"]').setValue(true);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "fixed_weekdays",
        weekdays: ["monday", "thursday"],
        missedOccurrencePolicy: "carry_over",
      },
    });
  });

  it("prefills existing weekdays and allows changing them", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        currentSchedule: version({
          type: "fixed_weekdays",
          weekdays: ["monday", "thursday"],
          missedOccurrencePolicy: "skip",
        }),
      }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    expect(
      wrapper.get<HTMLInputElement>('input[value="monday"]').element.checked,
    ).toBe(true);
    await wrapper.get('input[value="monday"]').setValue(false);
    await wrapper.get('input[value="saturday"]').setValue(true);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "fixed_weekdays",
        weekdays: ["thursday", "saturday"],
        missedOccurrencePolicy: "skip",
      },
    });
  });

  it("switches to weekly target without sending a missed-occurrence policy", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("weekly_target");
    await wrapper.get('input[name="weeklyTarget"]').setValue("5");
    expect(wrapper.find('select[name="missedPolicy"]').exists()).toBe(false);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: { type: "weekly_target", weeklyTarget: 5 },
    });
  });

  it("switches from weekly target to interval", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        currentSchedule: version({ type: "weekly_target", weeklyTarget: 3 }),
      }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("interval");
    await wrapper.get('input[name="intervalDays"]').setValue("3");
    await wrapper.get('select[name="missedPolicy"]').setValue("carry_over");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "interval",
        intervalDays: 3,
        missedOccurrencePolicy: "carry_over",
      },
    });
  });

  it("does not submit a schedule when its checkbox is cleared", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await wrapper.get('input[name="changeSchedule"]').setValue(false);
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledWith(10, { title: "Neuer Titel" });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });

  it.each(["2026-10-01", ""])(
    "rejects invalid or past effective date '%s' before any write",
    async (date) => {
      const wrapper = mountHabitEditor();
      await editSchedule(wrapper);
      await wrapper.get('input[name="title"]').setValue("Neuer Titel");
      await wrapper.get('input[name="effectiveFrom"]').setValue(date);
      await save(wrapper);
      expect(updateHabit).not.toHaveBeenCalled();
      expect(changeHabitSchedule).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toContain(
        "heute oder ein zukünftiges gültiges Datum",
      );
    },
  );

  it("rejects weekdays without a selected day", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");
    await save(wrapper);
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Bitte wähle mindestens einen Wochentag.",
    );
  });

  it.each(["0", "-1", "1.5"])("rejects invalid interval %s", async (value) => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="intervalDays"]').setValue(value);
    await save(wrapper);
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "ganze Zahl ab 1 Tag",
    );
  });

  it.each(["0", "8", "1.5"])(
    "rejects invalid weekly target %s",
    async (value) => {
      const wrapper = mountHabitEditor();
      await editSchedule(wrapper);
      await wrapper
        .get('select[name="scheduleType"]')
        .setValue("weekly_target");
      await wrapper.get('input[name="weeklyTarget"]').setValue(value);
      await save(wrapper);
      expect(changeHabitSchedule).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toBe(
        "Das Wochenziel muss zwischen 1 und 7 liegen.",
      );
    },
  );

  it("does not change the schedule after metadata fails", async () => {
    vi.mocked(updateHabit).mockRejectedValueOnce(
      new Error("Metadaten fehlgeschlagen"),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await save(wrapper);
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.emitted("changed")).toBeUndefined();
  });

  it("reports partial success and retries only the failed schedule request", async () => {
    vi.mocked(updateHabit).mockResolvedValueOnce(
      makeHabit({ title: "Neuer Titel" }),
    );
    vi.mocked(changeHabitSchedule).mockRejectedValueOnce(new Error("Konflikt"));
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await save(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Stammdaten gespeichert, Zeitplanänderung fehlgeschlagen",
    );
    expect(wrapper.emitted("changed")).toBeUndefined();
    expect(
      wrapper.get<HTMLInputElement>('input[name="intervalDays"]').element.value,
    ).toBe("4");
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledTimes(1);
    expect(changeHabitSchedule).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("changed")).toEqual([[]]);
  });

  it("prevents duplicate submissions while a schedule write is pending", async () => {
    let resolve!: (value: HabitResponse) => void;
    vi.mocked(changeHabitSchedule).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(changeHabitSchedule).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get<HTMLFieldSetElement>("form > fieldset").element.disabled,
    ).toBe(true);
    resolve(makeHabit());
    await flushPromises();
    expect(wrapper.emitted("changed")).toEqual([[]]);
  });

  it("shows a load error without allowing edits", async () => {
    vi.mocked(getHabit).mockRejectedValueOnce(
      new Error("Laden fehlgeschlagen"),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Laden fehlgeschlagen");
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it.each([
    ["todo", 1],
    ["habit", 10],
  ] as const)(
    "requires confirmation before deleting a %s",
    async (kind, entityId) => {
      const wrapper = mount(PlannerItemEditor, { props: { kind, entityId } });
      await flushPromises();
      await wrapper.get('[data-test="request-delete"]').trigger("click");
      expect(deleteTodo).not.toHaveBeenCalled();
      expect(deleteHabit).not.toHaveBeenCalled();
      await wrapper.get('[data-test="confirm-delete"]').trigger("click");
      await flushPromises();
      if (kind === "todo")
        expect(deleteTodo).toHaveBeenCalledWith(1, "a".repeat(64));
      else expect(deleteHabit).toHaveBeenCalledWith(10);
      expect(wrapper.emitted("changed")).toEqual([[]]);
    },
  );

  it("keeps the editor open when deletion fails", async () => {
    vi.mocked(deleteHabit).mockRejectedValueOnce(
      new Error("Löschen fehlgeschlagen"),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    await wrapper.get('[data-test="request-delete"]').trigger("click");
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Löschen fehlgeschlagen");
    expect(wrapper.emitted("changed")).toBeUndefined();
    expect(
      wrapper.get<HTMLFieldSetElement>("form > fieldset").element.disabled,
    ).toBe(false);
  });

  it("reports only writes as busy, so a dialog closes while the editor still loads", async () => {
    let resolve!: (value: HabitResponse) => void;
    vi.mocked(getHabit).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.emitted("busy")).toBeUndefined();
    resolve(makeHabit());
    await flushPromises();
    expect(wrapper.emitted("busy")).toBeUndefined();
    await wrapper.get('input[name="title"]').setValue("Neu");
    await save(wrapper);
    expect(wrapper.emitted("busy")).toEqual([[true], [false]]);
  });

  describe("quest fields", () => {
    function mountQuest(changes: Partial<TodoResponse> = {}) {
      vi.mocked(getTodo).mockResolvedValue({ ...todo, ...changes });
      return mount(PlannerItemEditor, {
        props: { kind: "todo", entityId: 1, embedded: true },
        attachTo: document.body,
      });
    }
    type Editor = ReturnType<typeof mountQuest>;
    const toggles = (wrapper: Editor) =>
      wrapper.findAll("button[aria-expanded]");
    const toggle = (wrapper: Editor, label: string) =>
      toggles(wrapper).find((button) => button.text().startsWith(label))!;
    const visible = (wrapper: Editor, selector: string) =>
      wrapper.get(selector).isVisible();

    it("shows title, day, duration and Warum; the rest waits behind closed disclosures", async () => {
      const wrapper = mountQuest();
      await flushPromises();
      for (const field of [
        'input[name="title"]',
        'input[name="scheduledDate"]',
        'input[name="duration"]',
        'textarea[name="why"]',
      ])
        expect(visible(wrapper, field)).toBe(true);
      for (const field of [
        'input[name="timeOfDay"]',
        'select[name="goalHabit"]',
        "#planner-edit-category",
        'input[name="weeklyTarget"]',
      ])
        expect(visible(wrapper, field)).toBe(false);
      expect(toggles(wrapper).map((button) => button.text())).toEqual([
        "Kampagne (Farbe, Symbol, Wochenziel)",
        "Termin (feste Uhrzeit)",
        "Ziel mit Daily (Daily und Zeitraum)",
        "Kategorie",
        "Fokus-Sperre",
      ]);
      expect(
        toggles(wrapper).map((button) => button.attributes("aria-expanded")),
      ).toEqual(["false", "false", "false", "false", "false"]);
      // The period means nothing without a daily: it is not even in the form.
      expect(wrapper.find('input[name="periodStart"]').exists()).toBe(false);
    });

    it("offers no campaign group below another quest", async () => {
      const wrapper = mountQuest({ parentId: 5 });
      await flushPromises();
      expect(toggles(wrapper).map((button) => button.text())).toEqual([
        "Termin (feste Uhrzeit)",
        "Ziel mit Daily (Daily und Zeitraum)",
        "Kategorie",
        "Fokus-Sperre",
      ]);
    });

    it("opens every group that already holds a value, so nothing set is hidden", async () => {
      const wrapper = mountQuest({
        timeOfDay: "10:00",
        goalHabitId: 3,
        goalTarget: 12,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        categoryId: 7,
        icon: "book",
        focusBlock: "always",
      });
      await flushPromises();
      expect(
        toggles(wrapper).map((button) => button.attributes("aria-expanded")),
      ).toEqual(["true", "true", "true", "true", "true"]);
      expect(
        wrapper.get<HTMLInputElement>('input[name="timeOfDay"]').element.value,
      ).toBe("10:00");
      expect(visible(wrapper, 'input[name="periodStart"]')).toBe(true);
      expect(visible(wrapper, 'input[name="goalTarget"]')).toBe(true);
      expect(visible(wrapper, "#planner-edit-category")).toBe(true);
      expect(visible(wrapper, 'input[name="weeklyTarget"]')).toBe(true);
    });

    it("keeps an old period without a daily in sight, so it can be cleared", async () => {
      const wrapper = mountQuest({
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
      });
      await flushPromises();
      expect(
        toggle(wrapper, "Ziel mit Daily").attributes("aria-expanded"),
      ).toBe("true");
      expect(visible(wrapper, 'input[name="periodEnd"]')).toBe(true);
      expect(wrapper.find('input[name="goalTarget"]').exists()).toBe(false);
    });

    it.each([
      ["Termin", 'input[name="timeOfDay"]'],
      ["Ziel mit Daily", 'select[name="goalHabit"]'],
      ["Kategorie", "#planner-edit-category"],
      ["Kampagne", '.item-editor__more input[type="radio"]'],
    ])(
      "opens “%s” in place with the focus on its first field",
      async (label, field) => {
        const wrapper = mountQuest();
        await flushPromises();
        await toggle(wrapper, label).trigger("click");
        expect(toggle(wrapper, label).attributes("aria-expanded")).toBe("true");
        expect(document.activeElement).toBe(wrapper.get(field).element);
      },
    );

    it("sets a daily goal: the period appears with the daily and only the goal is sent", async () => {
      const wrapper = mountQuest();
      await flushPromises();
      await toggle(wrapper, "Ziel mit Daily").trigger("click");
      await wrapper.get('select[name="goalHabit"]').setValue(3);
      await wrapper.get('input[name="periodStart"]').setValue("2026-10-01");
      await wrapper.get('input[name="periodEnd"]').setValue("2026-12-31");
      await wrapper.get('input[name="goalTarget"]').setValue("20");
      // Closed, the button still names the goal.
      await toggle(wrapper, "Ziel mit Daily").trigger("click");
      expect(toggle(wrapper, "Ziel mit Daily").text()).toContain(
        "Joggen, 20-mal · 01.10.–31.12.",
      );
      await save(wrapper);
      expect(updateTodo).toHaveBeenCalledWith(1, {
        title: "NestJS lernen",
        scheduledDate: "2026-10-02",
        timeOfDay: null,
        plannedDurationMinutes: 30,
        periodStart: "2026-10-01",
        periodEnd: "2026-12-31",
        goalHabitId: 3,
        goalTarget: 20,
      });
    });

    it("makes an appointment through the Termin group", async () => {
      const wrapper = mountQuest();
      await flushPromises();
      await toggle(wrapper, "Termin").trigger("click");
      await wrapper.get('input[name="timeOfDay"]').setValue("09:15");
      await save(wrapper);
      expect(updateTodo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ timeOfDay: "09:15" }),
      );
    });

    it("ends the form with the sticky actions: Speichern, Abbrechen, then the quiet delete", async () => {
      const wrapper = mountQuest();
      await flushPromises();
      expect(wrapper.classes()).toContain("item-editor--embedded");
      const footer = wrapper.get('[data-test="editor-actions"]');
      expect(footer.classes()).toContain("sticky-actions");
      expect(footer.findAll("button").map((button) => button.text())).toEqual([
        "Speichern",
        "Abbrechen",
        "Quest löschen",
      ]);
      // Nothing follows the actions, so nothing shows below them.
      expect(footer.element.nextElementSibling).toBeNull();
      expect(footer.element.parentElement!.nextElementSibling).toBeNull();
      // A failed save is said right above the buttons, where the eye is.
      await wrapper.get('input[name="title"]').setValue(" ");
      await save(wrapper);
      expect(footer.get('[role="alert"]').text()).toContain("Titel");
    });
  });

  describe("inherited Warum", () => {
    const inheritedWhy = {
      text: "Im März ins Ziel kommen",
      fromId: 9,
      fromTitle: "Halbmarathon",
    };
    function mountQuest(why: string | null) {
      vi.mocked(getTodo).mockResolvedValue({
        ...todo,
        parentId: 9,
        why,
        inheritedWhy,
      });
      return mount(PlannerItemEditor, {
        props: { kind: "todo", entityId: 1 },
        attachTo: document.body,
      });
    }

    it("quotes the inherited reason and sends no why on a plain save", async () => {
      const wrapper = mountQuest(null);
      await flushPromises();
      expect(wrapper.find('textarea[name="why"]').exists()).toBe(false);
      expect(wrapper.get("blockquote").text()).toContain(
        "Übernommen von „Halbmarathon“:",
      );
      expect(wrapper.get("blockquote").text()).toContain(
        "Im März ins Ziel kommen",
      );
      await wrapper.get('input[name="title"]').setValue("Schuhe kaufen");
      await save(wrapper);
      expect(vi.mocked(updateTodo).mock.calls[0]![1]).not.toHaveProperty("why");
    });

    it("writes an own reason only after asking for it", async () => {
      const wrapper = mountQuest(null);
      await flushPromises();
      await wrapper.get('[data-test="why-write-own"]').trigger("click");
      const area = wrapper.get<HTMLTextAreaElement>('textarea[name="why"]');
      expect(document.activeElement).toBe(area.element);
      await area.setValue("Ohne Blasen laufen");
      await save(wrapper);
      expect(updateTodo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ why: "Ohne Blasen laufen" }),
      );
    });

    it("sends nothing when the own field was opened and left empty", async () => {
      const wrapper = mountQuest(null);
      await flushPromises();
      await wrapper.get('[data-test="why-write-own"]').trigger("click");
      await save(wrapper);
      expect(vi.mocked(updateTodo).mock.calls[0]![1]).not.toHaveProperty("why");
    });

    it("clears an own reason with “Wieder übernehmen”, so it inherits again", async () => {
      const wrapper = mountQuest("Eigenes Warum");
      await flushPromises();
      expect(
        wrapper.get<HTMLTextAreaElement>('textarea[name="why"]').element.value,
      ).toBe("Eigenes Warum");
      await wrapper.get('[data-test="why-take-over"]').trigger("click");
      expect(wrapper.find('textarea[name="why"]').exists()).toBe(false);
      await save(wrapper);
      expect(updateTodo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ why: null }),
      );
    });
  });
});
