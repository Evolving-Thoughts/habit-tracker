import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import {
  getWeekPlan,
  reorderDay,
  rescheduleTodo,
} from "../api/day-planner.api";
import { WEEK_ENTRY_FIELDS } from "../types/fixtures";
import type {
  WeekPlanEntry,
  WeekPlanHabitEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import PlanView from "./PlanView.vue";

vi.mock("../api/day-planner.api", () => ({
  getWeekPlan: vi.fn(),
  reorderDay: vi.fn(),
  rescheduleTodo: vi.fn(),
  createTodo: vi.fn(),
}));
vi.mock("../utils/date", async (original) => ({
  ...(await original<typeof import("../utils/date")>()),
  getCurrentDateInTimeZone: () => "2026-11-17",
}));

enableAutoUnmount(afterEach);

const MONDAY = "2026-11-16";
const TODAY = "2026-11-17";

const quest = (
  todoId: number,
  overrides: Partial<WeekPlanTodoEntry> = {},
): WeekPlanTodoEntry => ({
  ...WEEK_ENTRY_FIELDS,
  type: "todo",
  todoId,
  title: `Quest ${todoId}`,
  status: "pending",
  scheduledDate: TODAY,
  ...overrides,
});
const daily = (overrides: Partial<WeekPlanHabitEntry> = {}): WeekPlanHabitEntry => ({
  ...WEEK_ENTRY_FIELDS,
  type: "habit",
  habitId: 4,
  occurrenceId: null,
  title: "Laufen",
  status: "pending",
  ...overrides,
});

function week(
  start: string,
  entries: Record<string, WeekPlanEntry[]> = {},
): WeekPlanResponse {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  return {
    startDate: start,
    endDate: dates[6]!,
    today: TODAY,
    days: dates.map((date) => ({ date, entries: entries[date] ?? [] })),
  };
}

async function mountPlan(path = "/plan") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/plan", name: "plan", component: PlanView }],
  });
  await router.push(path);
  const wrapper = mount(PlanView, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: { EditItemDialog: true, MoveItemDialog: true },
    },
  });
  await flushPromises();
  return { wrapper, router };
}

const column = (wrapper: Awaited<ReturnType<typeof mountPlan>>["wrapper"], date: string) =>
  wrapper.get(`section[data-date="${date}"]`);
const openTitles = (wrapper: Awaited<ReturnType<typeof mountPlan>>["wrapper"], date: string) =>
  column(wrapper, date)
    .get(".plan-day__list")
    .findAll("h3")
    .map((title) => title.text());
const grip = (wrapper: Awaited<ReturnType<typeof mountPlan>>["wrapper"], title: string) =>
  wrapper.get(`button[aria-label="${title} verschieben"]`);

describe("PlanView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(reorderDay).mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue({} as never);
  });

  it("shows the week as seven days and marks today", async () => {
    vi.mocked(getWeekPlan).mockResolvedValue(
      week(MONDAY, {
        [TODAY]: [
          quest(1, { timeOfDay: "09:30", plannedDurationMinutes: 45 }),
          daily({ plannedDurationMinutes: 15 }),
          quest(2, { status: "completed" }),
        ],
      }),
    );
    const { wrapper } = await mountPlan();

    expect(getWeekPlan).toHaveBeenCalledWith(MONDAY, expect.any(AbortSignal));
    expect(wrapper.get("h1").text()).toBe("Plan für 16.–22. Nov.");
    expect(wrapper.findAll("h2").map((heading) => heading.text())).toHaveLength(7);
    const today = column(wrapper, TODAY);
    expect(today.attributes("aria-current")).toBe("date");
    expect(today.get("h2").text()).toBe("Dienstag17. Nov.Heute");
    expect(today.get(".plan-day__summary").text()).toBe("2 offen · 1 Std.");
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 1", "Laufen"]);
    expect(today.text()).toContain("09:30");
    expect(today.get(".plan-day__list--done").text()).toContain("Quest 2");

    // A daily is a fixed row: no grip, no move, no editor.
    const dailyRow = today.findAll(".plan-entry--daily")[0]!;
    expect(dailyRow.text()).toContain("Daily");
    expect(dailyRow.find("button").exists()).toBe(false);
    // The past takes nothing new; today and later offer the quick add.
    expect(column(wrapper, MONDAY).find("form").exists()).toBe(false);
    expect(
      today.find('input[aria-label="Quest für Dienstag, 17. Nov. hinzufügen"]').exists(),
    ).toBe(true);
  });

  it("keeps the shown week in the address", async () => {
    vi.mocked(getWeekPlan).mockImplementation(async (start) => week(start));
    const { wrapper, router } = await mountPlan("/plan?woche=2026-11-25");
    expect(getWeekPlan).toHaveBeenLastCalledWith("2026-11-23", expect.any(AbortSignal));

    await wrapper.get('button[aria-label="Nächste Woche"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ woche: "2026-11-30" });
    expect(getWeekPlan).toHaveBeenLastCalledWith("2026-11-30", expect.any(AbortSignal));

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Diese Woche")!
      .trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({});
    expect(getWeekPlan).toHaveBeenLastCalledWith(MONDAY, expect.any(AbortSignal));
  });

  it("sorts a day with the grip's arrow keys and keeps the grip focused", async () => {
    vi.mocked(getWeekPlan).mockResolvedValue(
      week(MONDAY, { [TODAY]: [quest(1), quest(2)] }),
    );
    const { wrapper } = await mountPlan();
    vi.mocked(getWeekPlan).mockResolvedValue(
      week(MONDAY, { [TODAY]: [quest(2), quest(1)] }),
    );

    await grip(wrapper, "Quest 2").trigger("keydown", { key: "ArrowUp" });
    await flushPromises();

    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
    expect(rescheduleTodo).not.toHaveBeenCalled();
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 2", "Quest 1"]);
    expect(wrapper.get('[role="status"]').text()).toBe(
      "„Quest 2“ steht jetzt an Stelle 1 von 2.",
    );
    expect(document.activeElement).toBe(grip(wrapper, "Quest 2").element);
  });

  it("moves a quest to the next day, then sorts that day", async () => {
    vi.mocked(getWeekPlan).mockResolvedValue(
      week(MONDAY, {
        [TODAY]: [quest(1)],
        "2026-11-18": [quest(2, { scheduledDate: "2026-11-18" })],
      }),
    );
    const { wrapper } = await mountPlan();

    await grip(wrapper, "Quest 1").trigger("keydown", { key: "ArrowRight" });
    await flushPromises();

    expect(rescheduleTodo).toHaveBeenCalledWith(1, "2026-11-18", false);
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
    expect(vi.mocked(rescheduleTodo).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(reorderDay).mock.invocationCallOrder[0]!,
    );
  });

  it("takes a failed move back and says why", async () => {
    const plan = week(MONDAY, { [TODAY]: [quest(1), quest(2)] });
    vi.mocked(getWeekPlan).mockResolvedValue(plan);
    vi.mocked(rescheduleTodo).mockRejectedValueOnce(new Error("Offline"));
    const { wrapper } = await mountPlan();

    await grip(wrapper, "Quest 1").trigger("keydown", { key: "ArrowRight" });
    await flushPromises();

    expect(wrapper.get(".plan-view__alert").text()).toBe("Offline");
    expect(reorderDay).not.toHaveBeenCalled();
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 1", "Quest 2"]);
  });

  it("opens the editor and the move dialog of a quest", async () => {
    vi.mocked(getWeekPlan).mockResolvedValue(week(MONDAY, { [TODAY]: [quest(1)] }));
    const { wrapper } = await mountPlan();

    await wrapper.get('button[aria-label="Quest 1 bearbeiten"]').trigger("click");
    expect(
      wrapper.getComponent({ name: "EditItemDialog" }).props(),
    ).toMatchObject({ kind: "todo", entityId: 1 });
    wrapper.getComponent({ name: "EditItemDialog" }).vm.$emit("close");
    await flushPromises();

    await wrapper
      .get('button[aria-label="Quest 1 verschieben"]')
      .trigger("click");
    expect(
      wrapper.getComponent({ name: "MoveItemDialog" }).props(),
    ).toMatchObject({ today: TODAY, item: { todoId: 1 } });
  });

  it("invites planning when the week is still empty", async () => {
    vi.mocked(getWeekPlan).mockResolvedValue(week(MONDAY));
    const { wrapper } = await mountPlan();
    expect(wrapper.get(".page-lead").text()).toContain(
      "Für diese Woche ist noch nichts geplant.",
    );
    expect(column(wrapper, "2026-11-20").text()).toContain("Noch frei.");
  });

  it("explains a failed load and tries again", async () => {
    vi.mocked(getWeekPlan).mockRejectedValueOnce(new Error("Server weg"));
    vi.mocked(getWeekPlan).mockResolvedValueOnce(week(MONDAY));
    const { wrapper } = await mountPlan();

    expect(wrapper.get('[role="alert"]').text()).toContain("Server weg");
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.findAll("section.plan-day")).toHaveLength(7);
  });
});
