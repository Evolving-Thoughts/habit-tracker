import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import {
  getBacklogTodos,
  getPlan,
  reorderBacklog,
  reorderDay,
  rescheduleOccurrence,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import PlanDay from "../components/PlanDay.vue";
import PlanOverdue from "../components/PlanOverdue.vue";
import PlanQuestlog from "../components/PlanQuestlog.vue";
import {
  TODO_FIELDS,
  WEEK_ENTRY_FIELDS,
  WEEK_HABIT_FIELDS,
} from "../types/fixtures";
import type { TodoResponse } from "../types/todo";
import type {
  WeekPlanEntry,
  WeekPlanHabitEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import PlanView from "./PlanView.vue";
import { reloadShortcutSettings } from "../composables/useShortcuts";
import { createAppRouter } from "../router";

vi.mock("../api/day-planner.api", () => ({
  getPlan: vi.fn(),
  getBacklogTodos: vi.fn(),
  reorderBacklog: vi.fn(),
  reorderDay: vi.fn(),
  rescheduleTodo: vi.fn(),
  rescheduleOccurrence: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  updateTodo: vi.fn(),
  updateTodoCompletion: vi.fn(),
  createTodo: vi.fn(),
}));
vi.mock("../utils/date", async (original) => ({
  ...(await original<typeof import("../utils/date")>()),
  getCurrentDateInTimeZone: () => "2026-11-17",
}));

enableAutoUnmount(afterEach);

const MONDAY = "2026-11-16";
const TODAY = "2026-11-17";
const WEDNESDAY = "2026-11-18";

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
  ...WEEK_HABIT_FIELDS,
  type: "habit",
  habitId: 4,
  occurrenceId: null,
  title: "Laufen",
  status: "pending",
  ...overrides,
});
const backlogQuest = (overrides: Partial<TodoResponse> = {}): TodoResponse => ({
  ...TODO_FIELDS,
  id: 7,
  parentId: 9,
  title: "Fahrrad putzen",
  completed: false,
  completedAt: null,
  scheduledDate: null,
  timeOfDay: null,
  plannedDurationMinutes: 20,
  timerEligible: true,
  campaign: { id: 9, title: "Ordnung", color: "ochre", icon: null },
  ...overrides,
});

/** The board as the server answers it: `days` days from `start`. */
function board(
  start: string,
  entries: Record<string, WeekPlanEntry[]> = {},
  overdue: WeekPlanEntry[] = [],
  days = 14,
): WeekPlanResponse {
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  return {
    startDate: start,
    endDate: dates[days - 1]!,
    today: TODAY,
    days: dates.map((date) => ({ date, entries: entries[date] ?? [] })),
    overdue,
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
type Wrapper = Awaited<ReturnType<typeof mountPlan>>["wrapper"];

const column = (wrapper: Wrapper, date: string) =>
  wrapper.get(`section[data-date="${date}"]`);
const shownDates = (wrapper: Wrapper) =>
  wrapper
    .findAll("section.plan-day")
    .map((section) => section.attributes("data-date"));
const openTitles = (wrapper: Wrapper, date: string) =>
  column(wrapper, date)
    .get(".plan-day__list")
    .findAll("h3")
    .map((title) => title.text());
const columnTitles = (wrapper: Wrapper) =>
  wrapper
    .get(".plan-questlog__list")
    .findAll("h3")
    .map((h) => h.text());
const menuButton = (wrapper: Wrapper, title: string) =>
  wrapper.get(`button[aria-label="Aktionen für ${title}"]`);
const menuLabels = (wrapper: Wrapper) =>
  wrapper
    .findAll("[role=menuitem] .action-menu__label")
    .map((label) => label.text());
/** Opens a card's menu "…" and runs the entry with that spoken name. */
async function choose(
  wrapper: Wrapper,
  title: string,
  entry: string,
): Promise<void> {
  await menuButton(wrapper, title).trigger("click");
  await wrapper.get(`[role="menuitem"][aria-label="${entry}"]`).trigger("click");
}
const buttonNamed = (wrapper: Wrapper, text: string) =>
  wrapper.findAll("button").find((button) => button.text() === text);

/** A window of `width` px: the board measures its frame through a ResizeObserver. */
function layoutWidth(width: number): void {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe(element: Element) {
        if (element.classList.contains("plan-view__frame")) this.callback();
      }
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("plan-view__frame") ? width : 0;
    },
  );
}
/** Media queries: from 56rem (`wide`) and from 80rem (`roomy`). */
function screen(wide: boolean, roomy = wide): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      (wide && query === "(min-width: 56rem)") ||
      (roomy && query === "(min-width: 80rem)"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(getBacklogTodos).mockResolvedValue([]);
  vi.mocked(reorderDay).mockResolvedValue(undefined);
  vi.mocked(reorderBacklog).mockResolvedValue(undefined);
  vi.mocked(rescheduleTodo).mockResolvedValue({} as never);
  vi.mocked(updateTodo).mockResolvedValue({} as never);
  vi.mocked(updateTodoCompletion).mockResolvedValue(undefined);
  vi.mocked(rescheduleOccurrence).mockResolvedValue({} as never);
  vi.mocked(updateOccurrenceStatus).mockResolvedValue({} as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("PlanView", () => {
  it("starts with today: the Questlog, then today and the days after it", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, {
        [TODAY]: [
          quest(1, { timeOfDay: "09:30", plannedDurationMinutes: 45 }),
          daily({ plannedDurationMinutes: 15 }),
          quest(2, { status: "completed" }),
        ],
      }),
    );
    const { wrapper } = await mountPlan();

    expect(getPlan).toHaveBeenCalledWith(TODAY, 14, expect.any(AbortSignal));
    // Without layout the board shows a week from today; never a past day.
    expect(shownDates(wrapper)).toHaveLength(7);
    expect(shownDates(wrapper)[0]).toBe(TODAY);
    expect(wrapper.get("h1").text()).toBe("Plan für 17.–23. Nov.");
    const sections = wrapper.findAll("aside, section");
    expect(sections[0]!.classes()).toContain("plan-questlog");
    expect(wrapper.find(".plan-overdue").exists()).toBe(false);

    const today = column(wrapper, TODAY);
    expect(today.attributes("aria-current")).toBe("date");
    expect(today.get("h2").text()).toBe("Dienstag17. Nov.Heute");
    expect(today.get(".plan-day__summary").text()).toBe("2 offen · 1 Std.");
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 1", "Laufen"]);
    expect(today.text()).toContain("09:30");
    expect(today.get(".plan-day__list--done").text()).toContain("Quest 2");

    // A run the schedule only forecasts opens its daily and can delete it.
    await menuButton(wrapper, "Laufen").trigger("click");
    expect(menuLabels(wrapper)).toEqual(["Bearbeiten", "Löschen"]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    // Every day has its quick add on top; where new quests go is chosen once, in the head.
    const field = today.get(
      'input[aria-label="Quest für Dienstag, 17. Nov. hinzufügen"]',
    );
    expect(field.element.closest("form")!.querySelector('[aria-label="Oben einfügen"]')).toBeNull();
    expect(wrapper.findAll('[aria-label="Oben einfügen"]')).toHaveLength(1);
    expect(wrapper.get("header").find('[aria-label="Oben einfügen"]').exists()).toBe(true);
    // A visible word sets it apart from the day arrows; the group keeps its name.
    const place = wrapper.get(".plan-view__place");
    expect(place.get(".plan-view__place-label").text()).toBe("Neue");
    expect(place.find('[aria-label="Vorige Tage"]').exists()).toBe(false);
    expect(place.get("[role=group]").attributes("aria-label")).toBe(
      "Neue Quests einfügen",
    );
  });

  it("shows as many days as fit beside the Questlog and steps by them", async () => {
    // 78rem: the open Questlog (12rem) and four days of 14rem.
    layoutWidth(1248);
    screen(true);
    vi.mocked(getPlan).mockImplementation(async (from) => board(from));
    const { wrapper, router } = await mountPlan();

    expect(shownDates(wrapper)).toEqual([
      TODAY,
      WEDNESDAY,
      "2026-11-19",
      "2026-11-20",
    ]);
    expect(wrapper.get("h1").text()).toBe("Plan für 17.–20. Nov.");
    expect(
      (wrapper.get(".plan-view__board").element as HTMLElement).style
        .gridTemplateColumns,
    ).toBe("12rem repeat(4, minmax(14rem, 1fr))");
    // At today there is no going back.
    expect(
      wrapper.get('button[aria-label="Vorige Tage"]').attributes("disabled"),
    ).toBeDefined();

    await wrapper.get('button[aria-label="Nächste Tage"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ ab: "2026-11-21" });
    expect(getPlan).toHaveBeenLastCalledWith(
      "2026-11-21",
      14,
      expect.any(AbortSignal),
    );
    expect(shownDates(wrapper)[0]).toBe("2026-11-21");
  });

  it("gives what was left behind a column of its own, before today", async () => {
    layoutWidth(1248);
    screen(true);
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1)] }, [
        quest(5, { isOverdue: true, scheduledDate: MONDAY }),
        daily({ occurrenceId: 8, isOverdue: true }),
      ]),
    );
    const { wrapper } = await mountPlan();

    const overdue = wrapper.get("section.plan-overdue");
    expect(overdue.get("h2").text()).toContain("Liegen geblieben");
    expect(overdue.text()).toContain("seit 16. Nov.");
    // Its column takes the room of one day.
    expect(shownDates(wrapper)).toHaveLength(3);
    const order = wrapper
      .findAll("aside, section")
      .map((node) => node.classes()[0]);
    expect(order.slice(0, 3)).toEqual(["plan-questlog", "plan-overdue", "plan-day"]);
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 1"]);

    await menuButton(wrapper, "Quest 5").trigger("click");
    expect(menuLabels(wrapper)).toEqual([
      "Heute",
      "Morgen",
      "Nächste Woche",
      "Anderer Tag …",
      "Bearbeiten",
      "Stoppuhr starten",
      "In Kampagne verschieben …",
      "Löschen",
    ]);
  });

  it("plans a quest left behind for the day it is dropped on", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })] }, [
        quest(5, { isOverdue: true, scheduledDate: MONDAY }),
      ]),
    );
    const { wrapper } = await mountPlan();
    // What the server holds after the write, for the quiet reload.
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, {
        [WEDNESDAY]: [quest(5, { scheduledDate: WEDNESDAY }), quest(2, { scheduledDate: WEDNESDAY })],
      }),
    );

    wrapper.getComponent(PlanOverdue).vm.$emit("move", {
      kind: "day",
      drop: { todoId: 5, toDate: WEDNESDAY, index: 0 },
    });
    await flushPromises();

    expect(rescheduleTodo).toHaveBeenCalledWith(5, WEDNESDAY, false);
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 5 },
      { type: "todo", id: 2 },
    ]);
    expect(wrapper.find("section.plan-overdue").exists()).toBe(false);
  });

  it("keeps the first day in the address and comes back with Heute", async () => {
    vi.mocked(getPlan).mockImplementation(async (from) => board(from));
    const { wrapper, router } = await mountPlan("/plan?ab=2026-11-25");
    expect(getPlan).toHaveBeenLastCalledWith(
      "2026-11-25",
      14,
      expect.any(AbortSignal),
    );
    expect(wrapper.get("h1").text()).toBe("Plan für 25. Nov. – 1. Dez.");

    await wrapper.get('button[aria-label="Vorige Tage"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ ab: WEDNESDAY });
    // Never before today: the next step back lands on today itself.
    await wrapper.get('button[aria-label="Vorige Tage"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({});

    await router.push("/plan?ab=2026-12-08");
    await flushPromises();
    await buttonNamed(wrapper, "Heute")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({});
    expect(getPlan).toHaveBeenLastCalledWith(TODAY, 14, expect.any(AbortSignal));
    // On today the way back would change nothing: it leaves, and the
    // heading that names the days takes the focus.
    expect(buttonNamed(wrapper, "Heute")).toBeUndefined();
    expect(document.activeElement).toBe(wrapper.get("h1").element);
  });

  it("starts at today for a day in the past", async () => {
    vi.mocked(getPlan).mockImplementation(async (from) => board(from));
    await mountPlan("/plan?ab=2026-11-09");
    expect(getPlan).toHaveBeenLastCalledWith(TODAY, 14, expect.any(AbortSignal));
  });

  it("sends an old week link to the first day of that week still ahead", async () => {
    const router = createAppRouter(createMemoryHistory());
    await router.push("/plan?woche=2026-11-23");
    expect(router.currentRoute.value.fullPath).toBe("/plan?ab=2026-11-23");
    await router.push("/plan?woche=2026-11-16");
    expect(router.currentRoute.value.fullPath).toBe("/plan");
  });

  it("sorts a day with Nach oben in the menu and keeps the menu button focused", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1), quest(2)] }),
    );
    const { wrapper } = await mountPlan();
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(2), quest(1)] }),
    );

    await choose(wrapper, "Quest 2", "Quest 2 nach oben");
    await flushPromises();

    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
    expect(rescheduleTodo).not.toHaveBeenCalled();
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 2", "Quest 1"]);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Quest 2“ steht jetzt an Stelle 1 von 2.",
    );
    expect(document.activeElement).toBe(menuButton(wrapper, "Quest 2").element);
  });

  it("sorts a day with the arrow keys on a focused card and keeps it focused", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1), quest(2)] }),
    );
    const { wrapper } = await mountPlan();
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(2), quest(1)] }),
    );
    const card = () => wrapper.get('button[aria-label="Quest 2 bearbeiten"]');
    expect(card().attributes("aria-keyshortcuts")).toBe(
      "ArrowUp ArrowDown ArrowLeft ArrowRight",
    );

    await card().trigger("keydown", { key: "ArrowUp" });
    await flushPromises();

    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
    expect(rescheduleTodo).not.toHaveBeenCalled();
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 2", "Quest 1"]);
    expect(document.activeElement).toBe(card().element);
  });

  it("moves a focused card to the next day with ArrowRight, but not out of view or into the past", async () => {
    layoutWidth(1248);
    screen(true);
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, {
        [TODAY]: [quest(1)],
        [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })],
        "2026-11-20": [quest(3, { scheduledDate: "2026-11-20" })],
      }),
    );
    const { wrapper } = await mountPlan();

    await wrapper
      .get('button[aria-label="Quest 1 bearbeiten"]')
      .trigger("keydown", { key: "ArrowLeft" });
    // The last day shown has no neighbour on the board.
    await wrapper
      .get('button[aria-label="Quest 3 bearbeiten"]')
      .trigger("keydown", { key: "ArrowRight" });
    await flushPromises();
    expect(rescheduleTodo).not.toHaveBeenCalled();

    await wrapper
      .get('button[aria-label="Quest 1 bearbeiten"]')
      .trigger("keydown", { key: "ArrowRight" });
    await flushPromises();

    expect(rescheduleTodo).toHaveBeenCalledWith(1, WEDNESDAY, false);
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
  });

  it("gives an open quest's menu its moves in the one order", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1), quest(2)] }),
    );
    const { wrapper } = await mountPlan();
    await menuButton(wrapper, "Quest 1").trigger("click");
    expect(menuLabels(wrapper)).toEqual([
      "Morgen",
      "Nächste Woche",
      "Anderer Tag …",
      "Bearbeiten",
      "Stoppuhr starten",
      "In Kampagne verschieben …",
      "Nach unten",
      "Löschen",
    ]);
  });

  it("moves a quest to tomorrow from its menu, at the end of that day", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, {
        [TODAY]: [quest(1)],
        [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })],
      }),
    );
    const { wrapper } = await mountPlan();

    await choose(wrapper, "Quest 1", "Quest 1 auf morgen");
    await flushPromises();

    expect(rescheduleTodo).toHaveBeenCalledWith(1, WEDNESDAY, false);
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
    expect(vi.mocked(rescheduleTodo).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(reorderDay).mock.invocationCallOrder[0]!,
    );
  });

  it("takes a failed move back and says why", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1), quest(2)] }),
    );
    vi.mocked(rescheduleTodo).mockRejectedValueOnce(new Error("Offline"));
    const { wrapper } = await mountPlan();

    await choose(wrapper, "Quest 1", "Quest 1 auf morgen");
    await flushPromises();

    expect(wrapper.get(".plan-view__alert").text()).toBe("Offline");
    expect(reorderDay).not.toHaveBeenCalled();
    expect(openTitles(wrapper, TODAY)).toEqual(["Quest 1", "Quest 2"]);
  });

  it("opens the editor and the move dialog of a quest", async () => {
    vi.mocked(getPlan).mockResolvedValue(board(TODAY, { [TODAY]: [quest(1)] }));
    const { wrapper } = await mountPlan();

    await wrapper.get('button[aria-label="Quest 1 bearbeiten"]').trigger("click");
    expect(
      wrapper.getComponent({ name: "EditItemDialog" }).props(),
    ).toMatchObject({ kind: "todo", entityId: 1 });
    wrapper.getComponent({ name: "EditItemDialog" }).vm.$emit("close");
    await flushPromises();

    await choose(wrapper, "Quest 1", "Quest 1 verschieben");
    expect(
      wrapper.getComponent({ name: "MoveItemDialog" }).props(),
    ).toMatchObject({ today: TODAY, item: { todoId: 1 } });
  });

  it("opens the editor from a tap anywhere on the card", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1, { plannedDurationMinutes: 30 })] }),
    );
    const { wrapper } = await mountPlan();
    await column(wrapper, TODAY).get(".plan-entry__details").trigger("click");
    expect(
      wrapper.getComponent({ name: "EditItemDialog" }).props(),
    ).toMatchObject({ kind: "todo", entityId: 1 });
  });

  it("invites planning when the days are still empty", async () => {
    vi.mocked(getPlan).mockResolvedValue(board(TODAY));
    const { wrapper } = await mountPlan();
    expect(wrapper.get(".page-lead").text()).toContain(
      "Für diese Tage ist noch nichts geplant.",
    );
    expect(column(wrapper, "2026-11-20").text()).toContain("Noch frei.");
  });

  it("explains a failed load and tries again", async () => {
    vi.mocked(getPlan).mockRejectedValueOnce(new Error("Server weg"));
    vi.mocked(getPlan).mockResolvedValueOnce(board(TODAY));
    const { wrapper } = await mountPlan();

    expect(wrapper.get('[role="alert"]').text()).toContain("Server weg");
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.findAll("section.plan-day")).toHaveLength(7);
  });

  it("keeps the loading bones in the board's columns", async () => {
    screen(true);
    vi.mocked(getPlan).mockReturnValue(new Promise(() => {}));
    const { wrapper } = await mountPlan();
    const bones = wrapper.get('[aria-label="Plan wird geladen"]');
    expect((bones.element as HTMLElement).style.gridTemplateColumns).toBe(
      "12rem repeat(7, minmax(14rem, 1fr))",
    );
    expect(bones.findAll(".plan-view__bone")).toHaveLength(8);
  });
});

describe("PlanView keyboard shortcuts", () => {
  beforeEach(() => reloadShortcutSettings());

  const row = (key: string) =>
    document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)!;
  function hover(key: string): void {
    row(key).dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  }
  function press(key: string, target: EventTarget = document.body) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  it("moves the hovered quest to tomorrow with D, the way dragging does", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1), quest(2)] }),
    );
    const { wrapper } = await mountPlan();
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, {
        [TODAY]: [quest(2)],
        [WEDNESDAY]: [quest(1, { scheduledDate: WEDNESDAY })],
      }),
    );
    hover("todo-1");
    expect(press("d").defaultPrevented).toBe(true);
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(1, WEDNESDAY, false);
    expect(openTitles(wrapper, WEDNESDAY)).toEqual(["Quest 1"]);
    expect(wrapper.get(".visually-hidden[role='status']").text()).toBe(
      "„Quest 1“ steht jetzt am Mittwoch, 18. Nov.",
    );
  });

  it("moves a quest left behind to today with T", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, {}, [quest(5, { isOverdue: true, scheduledDate: MONDAY })]),
    );
    await mountPlan();
    hover("todo-5");
    press("t");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(5, TODAY, false);
    expect(reorderDay).toHaveBeenCalledWith([{ type: "todo", id: 5 }]);
  });

  it("moves beyond the board the way of Verschieben", async () => {
    layoutWidth(1248);
    screen(true);
    vi.mocked(getPlan).mockResolvedValue(board(TODAY, { [TODAY]: [quest(1)] }));
    const { wrapper } = await mountPlan();
    hover("todo-1");
    press("w");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(1, "2026-11-23", false);
    expect(reorderDay).not.toHaveBeenCalled();
    expect(wrapper.get(".visually-hidden[role='status']").text()).toBe(
      "„Quest 1“ steht jetzt am Montag, 23. Nov.",
    );
  });

  it("ticks the hovered quest with X and offers undo", async () => {
    vi.mocked(getPlan).mockResolvedValue(board(TODAY, { [TODAY]: [quest(1)] }));
    const { wrapper } = await mountPlan();
    hover("todo-1");
    press("x");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
    expect(wrapper.get(".undo-toast").text()).toContain("„Quest 1“ erledigt");
    await wrapper.get(".undo-toast button").trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenLastCalledWith(1, false);
  });

  it("leaves runs to their window, done quests and appointments to their own ways", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, {
        [TODAY]: [
          quest(1, { timeOfDay: "09:30" }),
          daily({ occurrenceId: 9, moveUntil: TODAY }),
          daily({ habitId: 5, title: "Lesen" }),
          quest(2, { status: "completed" }),
        ],
      }),
    );
    const { wrapper } = await mountPlan();
    // A run that may not wait beyond today stays; a forecast takes no keys.
    hover("habit-9");
    expect(press("d").defaultPrevented).toBe(false);
    hover(`forecast-5-${TODAY}`);
    expect(press("x").defaultPrevented).toBe(false);
    hover("todo-2");
    expect(press("x").defaultPrevented).toBe(false);
    // An appointment opens "Verschieben", where its move is confirmed.
    hover("todo-1");
    press("d");
    await flushPromises();
    expect(rescheduleTodo).not.toHaveBeenCalled();
    expect(updateTodoCompletion).not.toHaveBeenCalled();
    expect(wrapper.findComponent({ name: "MoveItemDialog" }).exists()).toBe(
      true,
    );
  });

  it("puts N into the first column's quick add: today's, or the first day shown", async () => {
    vi.mocked(getPlan).mockImplementation(async (from) => board(from));
    await mountPlan();
    press("n");
    expect(document.activeElement).toBe(
      document.querySelector(
        `section[data-date="${TODAY}"] input[name="quickTitle"]`,
      ),
    );
    document.body.innerHTML = "";

    await mountPlan("/plan?ab=2026-11-23");
    press("n");
    expect(document.activeElement).toBe(
      document.querySelector(
        'section[data-date="2026-11-23"] input[name="quickTitle"]',
      ),
    );
  });
});

describe("PlanView Questlog column", () => {
  beforeEach(() => {
    screen(true);
    vi.mocked(getBacklogTodos).mockResolvedValue([backlogQuest()]);
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })] }),
    );
  });

  it("lists the quests without a day at the left, with their campaign stripe", async () => {
    const { wrapper } = await mountPlan();
    const aside = wrapper.get("aside.plan-questlog");
    expect(aside.get("h2").text()).toContain("Questlog");
    expect(columnTitles(wrapper)).toEqual(["Fahrrad putzen"]);
    const row = aside.get(".plan-entry");
    expect(row.attributes("style")).toContain(
      "--campaign-mark: var(--color-mark-ochre)",
    );
    expect(row.get(".campaign-chip").text()).toContain("Ordnung");
    // The whole card drags; keys and taps go through the menu.
    expect(row.classes()).toContain("card-drag");
    expect(
      row.find('[aria-label="Aktionen für Fahrrad putzen"]').exists(),
    ).toBe(true);
  });

  it("drops a quest onto a day: shown at once, planned with the Questlog's save, then sorted", async () => {
    let finish!: () => void;
    vi.mocked(updateTodo).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve({} as never);
      }),
    );
    const { wrapper } = await mountPlan();

    wrapper.getComponent(PlanQuestlog).vm.$emit("move", {
      kind: "day",
      drop: { todoId: 7, toDate: WEDNESDAY, index: 0 },
    });
    await flushPromises();
    // Shown before the server answers.
    expect(openTitles(wrapper, WEDNESDAY)).toEqual(["Fahrrad putzen", "Quest 2"]);
    expect(columnTitles(wrapper)).toEqual([]);

    finish();
    await flushPromises();
    expect(updateTodo).toHaveBeenCalledWith(7, {
      title: "Fahrrad putzen",
      scheduledDate: WEDNESDAY,
      timeOfDay: null,
      plannedDurationMinutes: 20,
    });
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 7 },
      { type: "todo", id: 2 },
    ]);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Fahrrad putzen“ steht jetzt am Mittwoch, 18. Nov.",
    );
  });

  it("takes a quest from a day back into the column, where it was dropped", async () => {
    vi.mocked(getBacklogTodos).mockResolvedValue([
      backlogQuest(),
      backlogQuest({ id: 8, title: "Keller" }),
    ]);
    const { wrapper } = await mountPlan();
    // Shown at once; the reload after the write sees the same.
    vi.mocked(getPlan).mockResolvedValue(board(TODAY));
    vi.mocked(getBacklogTodos).mockResolvedValue([
      backlogQuest(),
      backlogQuest({ id: 2, title: "Quest 2", campaign: null }),
      backlogQuest({ id: 8, title: "Keller" }),
    ]);

    wrapper
      .findAllComponents(PlanDay)
      .find((day) => day.props("day").date === WEDNESDAY)!
      .vm.$emit("move", { kind: "questlog", drop: { todoId: 2, index: 1 } });
    await flushPromises();

    expect(columnTitles(wrapper)).toEqual(["Fahrrad putzen", "Quest 2", "Keller"]);
    expect(openTitles(wrapper, WEDNESDAY)).toEqual([]);
    expect(updateTodo).toHaveBeenCalledWith(2, { scheduledDate: null });
    expect(reorderBacklog).toHaveBeenCalledWith([7, 2, 8]);
    expect(vi.mocked(updateTodo).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(reorderBacklog).mock.invocationCallOrder[0]!,
    );
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Quest 2“ steht jetzt im Questlog an Stelle 2 von 3.",
    );
  });

  it("sorts the column by dragging and with Nach unten in a card's menu", async () => {
    vi.mocked(getBacklogTodos).mockResolvedValue([
      backlogQuest(),
      backlogQuest({ id: 8, title: "Keller" }),
    ]);
    const { wrapper } = await mountPlan();
    vi.mocked(getBacklogTodos).mockResolvedValue([
      backlogQuest({ id: 8, title: "Keller" }),
      backlogQuest(),
    ]);

    await choose(wrapper, "Fahrrad putzen", "Fahrrad putzen nach unten");
    await flushPromises();
    expect(reorderBacklog).toHaveBeenLastCalledWith([8, 7]);
    expect(updateTodo).not.toHaveBeenCalled();
    expect(columnTitles(wrapper)).toEqual(["Keller", "Fahrrad putzen"]);
    expect(document.activeElement).toBe(
      menuButton(wrapper, "Fahrrad putzen").element,
    );

    wrapper.getComponent(PlanQuestlog).vm.$emit("move", {
      kind: "questlog",
      drop: { todoId: 7, index: 0 },
    });
    await flushPromises();
    expect(reorderBacklog).toHaveBeenLastCalledWith([7, 8]);
  });

  it("plans from the row's menu by keyboard: Einplanen auf a day of the board", async () => {
    const { wrapper } = await mountPlan();
    await menuButton(wrapper, "Fahrrad putzen").trigger("click");
    // The days shown, today first.
    expect(menuLabels(wrapper)).toEqual([
      "Heute, 17. Nov.",
      "Mittwoch, 18. Nov.",
      "Donnerstag, 19. Nov.",
      "Freitag, 20. Nov.",
      "Samstag, 21. Nov.",
      "Sonntag, 22. Nov.",
      "Montag, 23. Nov.",
      "Bearbeiten",
      "Stoppuhr starten",
      "In Kampagne verschieben …",
      "Löschen",
    ]);
    await wrapper
      .get('[aria-label="Fahrrad putzen einplanen am Mittwoch, 18. Nov."]')
      .trigger("click");
    await flushPromises();
    expect(updateTodo).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ scheduledDate: WEDNESDAY }),
    );
    // At the end of that day's order.
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 7 },
    ]);
  });

  it("puts the quest back into the column when planning fails", async () => {
    vi.mocked(updateTodo).mockRejectedValueOnce(new Error("Offline"));
    const { wrapper } = await mountPlan();
    wrapper.getComponent(PlanQuestlog).vm.$emit("move", {
      kind: "day",
      drop: { todoId: 7, toDate: WEDNESDAY, index: 0 },
    });
    await flushPromises();
    expect(wrapper.get(".plan-view__alert").text()).toBe("Offline");
    expect(reorderDay).not.toHaveBeenCalled();
    expect(columnTitles(wrapper)).toEqual(["Fahrrad putzen"]);
    expect(openTitles(wrapper, WEDNESDAY)).toEqual(["Quest 2"]);
  });

  it("keeps Liegen geblieben folded once it was folded on this device", async () => {
    layoutWidth(1248);
    screen(true);
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1)] }, [
        quest(5, { isOverdue: true, scheduledDate: MONDAY }),
      ]),
    );
    const first = await mountPlan();
    await first.wrapper
      .get('[aria-label="Liegen geblieben ausblenden"]')
      .trigger("click");
    expect(localStorage.getItem("plan:overdue")).toBe("closed");
    first.wrapper.unmount();

    const again = await mountPlan();
    expect(
      again.wrapper.find('[aria-label="Liegen geblieben einblenden"]').exists(),
    ).toBe(true);
  });

  it("remembers a collapsed column on this device", async () => {
    const first = await mountPlan();
    const toggle = first.wrapper.get(".plan-questlog__toggle");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(toggle.attributes("aria-label")).toBe("Questlog einblenden");
    expect(localStorage.getItem("plan:questlog")).toBe("closed");
    first.wrapper.unmount();

    const { wrapper } = await mountPlan();
    expect(
      wrapper.get(".plan-questlog__toggle").attributes("aria-expanded"),
    ).toBe("false");
    expect(
      (wrapper.get("#plan-questlog-list").element as HTMLElement).style.display,
    ).toBe("none");
    // The rail still says how many quests wait.
    expect(wrapper.get(".plan-questlog .count").text()).toBe("1");
  });

  it("starts collapsed when the narrow board has no space for both columns", async () => {
    screen(false, false);
    const first = await mountPlan();
    const toggle = first.wrapper.get(".plan-questlog__toggle");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(localStorage.getItem("plan:questlog")).toBeNull();

    // Opened by hand, it stays open on this device even in a small window.
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(localStorage.getItem("plan:questlog")).toBe("open");
    first.wrapper.unmount();
    const { wrapper } = await mountPlan();
    expect(
      wrapper.get(".plan-questlog__toggle").attributes("aria-expanded"),
    ).toBe("true");
  });

  it("plans a column row with T like its menu", async () => {
    reloadShortcutSettings();
    await mountPlan();
    document
      .querySelector('[data-focus-key="todo-7"]')!
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "t",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    expect(updateTodo).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ scheduledDate: TODAY }),
    );
  });

  it("keeps the Questlog and today on a phone: the rail beside one day", async () => {
    screen(false);
    // 380px, the frame of a phone: the rail (2.75rem) and today.
    layoutWidth(380);
    const { wrapper } = await mountPlan();
    expect(wrapper.find("aside.plan-questlog").exists()).toBe(true);
    expect(
      wrapper.get(".plan-questlog__toggle").attributes("aria-expanded"),
    ).toBe("false");
    expect(getBacklogTodos).toHaveBeenCalled();
    expect(shownDates(wrapper)).toEqual([TODAY]);
  });
});

describe("PlanView dailies", () => {
  beforeEach(() => reloadShortcutSettings());
  const TOMORROW = "2026-11-18";
  /** A stored run of today that may wait until tomorrow. */
  const run = (overrides: Partial<WeekPlanHabitEntry> = {}) =>
    daily({
      occurrenceId: 9,
      moveUntil: TOMORROW,
      timerEligible: true,
      streak: { current: 4, best: 6, unit: "runs" },
      ...overrides,
    });

  it("gives a stored run Heute's menu and opens its editor with the run's notes", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1), run()] }),
    );
    const { wrapper } = await mountPlan();
    const card = wrapper.get('[data-focus-key="habit-9"]');
    expect(card.attributes("data-run-id")).toBe("9");
    expect(card.text()).toContain("4 in Folge");
    await menuButton(wrapper, "Laufen").trigger("click");
    expect(menuLabels(wrapper)).toEqual([
      "Morgen",
      "Anderer Tag …",
      "Überspringen",
      "Bearbeiten",
      "Stoppuhr starten",
      "Nach oben",
      "Löschen",
    ]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();

    await card.get('button[aria-label="Laufen bearbeiten"]').trigger("click");
    const editor = wrapper.findComponent({ name: "EditItemDialog" });
    expect(editor.props()).toMatchObject({
      kind: "habit",
      entityId: 4,
      occurrenceId: 9,
    });
  });

  it("sorts a run within its day and moves it within its window, like Heute", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [quest(1), run()], [TOMORROW]: [quest(2)] }),
    );
    const { wrapper } = await mountPlan();
    const [today, tomorrow] = wrapper.findAllComponents(PlanDay);

    today!.vm.$emit("move", {
      kind: "run",
      drop: { occurrenceId: 9, toDate: TODAY, index: 0 },
    });
    await flushPromises();
    expect(reorderDay).toHaveBeenLastCalledWith([
      { type: "habit", id: 9 },
      { type: "todo", id: 1 },
    ]);
    expect(rescheduleOccurrence).not.toHaveBeenCalled();

    tomorrow!.vm.$emit("move", {
      kind: "run",
      drop: { occurrenceId: 9, toDate: TOMORROW, index: 0 },
    });
    await flushPromises();
    expect(rescheduleOccurrence).toHaveBeenCalledWith(9, TOMORROW);
    expect(reorderDay).toHaveBeenLastCalledWith([
      { type: "habit", id: 9 },
      { type: "todo", id: 2 },
    ]);
  });

  it("keeps a run in its window and says how far it may wait", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [run({ moveUntil: TODAY })] }),
    );
    const { wrapper } = await mountPlan();
    wrapper.findAllComponents(PlanDay)[2]!.vm.$emit("move", {
      kind: "run",
      drop: { occurrenceId: 9, toDate: "2026-11-19", index: 0 },
    });
    await flushPromises();
    expect(rescheduleOccurrence).not.toHaveBeenCalled();
    expect(wrapper.get(".plan-view__notice").text()).toBe(
      "„Laufen“ kann höchstens bis Dienstag, 17. Nov. warten.",
    );
  });

  it("moves a run a day with the arrow keys, and ticks it with X with undo", async () => {
    vi.mocked(getPlan).mockResolvedValue(
      board(TODAY, { [TODAY]: [run()] }),
    );
    const { wrapper } = await mountPlan();
    await wrapper
      .get('button[aria-label="Laufen bearbeiten"]')
      .trigger("keydown", { key: "ArrowRight" });
    await flushPromises();
    expect(rescheduleOccurrence).toHaveBeenCalledWith(9, TOMORROW);

    vi.mocked(getPlan).mockResolvedValue(board(TODAY, { [TODAY]: [run()] }));
    await wrapper.vm.$nextTick();
    document
      .querySelector('[data-focus-key="habit-9"]')!
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "x", bubbles: true, cancelable: true }),
    );
    await flushPromises();
    expect(updateOccurrenceStatus).toHaveBeenCalledWith(9, "completed");
    expect(wrapper.get(".undo-toast").text()).toContain("„Laufen“ erledigt");
    await wrapper.get(".undo-toast button").trigger("click");
    await flushPromises();
    expect(updateOccurrenceStatus).toHaveBeenLastCalledWith(9, "pending");
  });

  it("skips a run from its menu and deletes the whole daily after asking", async () => {
    vi.mocked(getPlan).mockResolvedValue(board(TODAY, { [TODAY]: [run()] }));
    const { wrapper } = await mountPlan();
    await choose(wrapper, "Laufen", "Laufen überspringen");
    await flushPromises();
    expect(updateOccurrenceStatus).toHaveBeenCalledWith(9, "skipped");

    await choose(wrapper, "Laufen", "Daily Laufen ganz löschen");
    await flushPromises();
    expect(
      wrapper.findComponent({ name: "DeleteItemDialog" }).props("target"),
    ).toEqual({ kind: "habit", id: 4, title: "Laufen" });
  });
});
