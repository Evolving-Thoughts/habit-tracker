import {
  HABIT_FIELDS,
  NO_QUEST_HOURS,
  TODO_FIELDS,
  PLANNER_HABIT_FIELDS,
  PLANNER_TODO_FIELDS,
} from "../types/fixtures";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, KeepAlive } from "vue";
import { notifyDataChanged } from "../composables/data-sync";
import {
  getHabits,
  getPlan,
  getToday,
  getTodos,
  reorderDay,
  setEventDone,
  createTodo,
  createHabit,
  getHabit,
  changeHabitSchedule,
  deleteHabit,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import type {
  DayPlannerHabitItem,
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import type { MonthChallenge } from "../types/month-challenge";
import TodayView from "./TodayView.vue";
import { getHistory } from "../api/history.api";
import { deleteWorkLog } from "../api/work-logs.api";
import type { HistoryWorkLog } from "../types/history";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import {
  reloadShortcutSettings,
  setSingleKeys,
} from "../composables/useShortcuts";
import {
  createTimerController,
  timerKey,
  type TimerController,
} from "../composables/useTimer";

const routerPush = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
/** The address Heute reads its day from (`?tag=`). */
const route = vi.hoisted(() => ({ query: {} as Record<string, string> }));
vi.mock("vue-router", async (original) => ({
  ...(await original<typeof import("vue-router")>()),
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useRoute: () => route,
}));
vi.mock("../api/history.api", () => ({ getHistory: vi.fn() }));
vi.mock("../api/work-logs.api", () => ({
  createWorkLog: vi.fn(),
  updateWorkLog: vi.fn(),
  deleteWorkLog: vi.fn(),
}));
vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(async () => []),
}));
vi.mock("../components/QuestNotes.vue", () => import("../test/quest-notes-stub"));
vi.mock("../api/todo-hierarchy.api", () => ({
  getTodoHierarchy: vi.fn(async () => []),
  getDeletionPreview: vi.fn(async () => ({
    confirmationToken: "token",
    todos: [],
    timers: [],
  })),
}));
vi.mock("../api/day-planner.api", () => ({
  getToday: vi.fn(),
  getTodos: vi.fn(),
  getHabits: vi.fn(),
  getPlan: vi.fn(),
  reorderDay: vi.fn(),
  setEventDone: vi.fn(),
  createTodo: vi.fn(),
  createHabit: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  updateTodoCompletion: vi.fn(),
  rescheduleTodo: vi.fn(),
  rescheduleOccurrence: vi.fn(),
  getTodo: vi.fn(),
  getHabit: vi.fn(),
  updateTodo: vi.fn(),
  updateHabit: vi.fn(),
  changeHabitSchedule: vi.fn(),
  deleteTodo: vi.fn(),
  deleteHabit: vi.fn(),
}));

enableAutoUnmount(afterEach);

const getTodayMock = vi.mocked(getToday);
const updateTodoMock = vi.mocked(updateTodoCompletion);
const updateOccurrenceMock = vi.mocked(updateOccurrenceStatus);

function makeTodo(
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem {
  return {
    ...PLANNER_TODO_FIELDS,
    type: "todo",
    todoId: 1,
    title: "NestJS lernen",
    status: "pending",
    scheduledDate: "2026-10-02",
    completedAt: null,
    plannedDurationMinutes: 30,
    isOverdue: false,
    timerEligible: true,
    ...overrides,
  };
}

function makeHabit(
  overrides: Partial<DayPlannerHabitItem> = {},
): DayPlannerHabitItem {
  return {
    ...PLANNER_HABIT_FIELDS,
    type: "habit",
    plannedDurationMinutes: null,
    occurrenceId: 20,
    habitId: 10,
    title: "Joggen",
    status: "pending",
    scheduledDate: "2026-10-02",
    moveUntil: null,
    scheduleType: "interval",
    isOverdue: false,
    timerEligible: true,
    ...overrides,
  };
}

function makePlanner(
  items: DayPlannerResponse["items"] = [],
): DayPlannerResponse {
  return {
    date: "2026-10-02",
    items,
    externalEvents: [],
    workedMinutes: 0,
    questHours: NO_QUEST_HOURS,
  };
}

/** "Auf morgen" in the head, the pill before ‹ ›, on every width. */
async function openPostpone(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper
    .get('.today-view__header [aria-label="Offenes auf morgen verschieben"]')
    .trigger("click");
  await flushPromises();
}

describe("TodayView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 08:00 in Berlin.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));

    getTodayMock.mockResolvedValue(makePlanner());
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
    vi.mocked(reorderDay).mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("shows loading while the initial request is pending", async () => {
    let resolveRequest!: (planner: DayPlannerResponse) => void;

    getTodayMock.mockReturnValueOnce(
      new Promise<DayPlannerResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const wrapper = mount(TodayView);

    expect(
      wrapper.find('[aria-label="Tagesplan wird geladen"]').exists(),
    ).toBe(true);
    expect(getTodayMock).toHaveBeenCalledTimes(1);

    resolveRequest(makePlanner());
    await flushPromises();

    expect(
      wrapper.find('[aria-label="Tagesplan wird geladen"]').exists(),
    ).toBe(false);
  });

  it("shows an empty state after loading an empty planner", async () => {
    const wrapper = mount(TodayView);

    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("Freitag, 2. Okt.");
    expect(wrapper.text()).toContain("Für heute ist nichts geplant.");
    expect(wrapper.findAll(".planner-item")).toHaveLength(0);
  });

  it("keeps the calm line for an account that only has an empty day", async () => {
    vi.mocked(getTodos).mockResolvedValue([{ ...TODO_FIELDS, id: 7 }] as never);
    vi.mocked(getHabits).mockResolvedValue([]);
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.text()).toContain("Für heute ist nichts geplant.");
    expect(wrapper.find(".today-welcome").exists()).toBe(false);
  });

  describe("for a brand-new account", () => {
    beforeEach(() => {
      vi.mocked(getTodos).mockResolvedValue([]);
      vi.mocked(getHabits).mockResolvedValue([]);
    });

    it("explains the four words and offers starters and one way to begin", async () => {
      const wrapper = mount(TodayView);
      await flushPromises();
      const welcome = wrapper.get(".today-welcome");
      expect(wrapper.text()).not.toContain("Für heute ist nichts geplant.");
      expect(welcome.findAll("dt").map((term) => term.text())).toEqual([
        "Quest",
        "Daily",
        "Kampagne",
        "Questlog",
      ]);
      expect(
        welcome.findAll(".today-welcome__starter").map((b) => b.text()),
      ).toEqual([
        "Wasser trinken Daily",
        "Spazieren gehen Daily",
        "Einkaufen Quest für heute",
      ]);
      expect(welcome.findAll(".btn--primary").map((b) => b.text())).toEqual([
        "Erste Quest anlegen",
      ]);
      await welcome.get(".today-welcome__create").trigger("click");
      expect(wrapper.find("dialog .create-todo").exists()).toBe(true);
    });

    it("fills the quick add with a quest starter and creates nothing yet", async () => {
      const wrapper = mount(TodayView);
      await flushPromises();
      const einkaufen = wrapper
        .findAll(".today-welcome__starter")
        .find((button) => button.text().startsWith("Einkaufen"))!;
      await einkaufen.trigger("click");
      expect(
        (wrapper.get('input[name="quickTitle"]').element as HTMLInputElement)
          .value,
      ).toBe("Einkaufen");
      expect(createTodo).not.toHaveBeenCalled();
    });

    it("opens Neues Daily with the title of a daily starter", async () => {
      const wrapper = mount(TodayView);
      await flushPromises();
      await wrapper.get(".today-welcome__starter").trigger("click");
      await flushPromises();
      expect(wrapper.get("dialog h2").text()).toBe("Neues Daily");
      expect(
        (wrapper.get('dialog input[name="title"]').element as HTMLInputElement)
          .value,
      ).toBe("Wasser trinken");
      expect(createHabit).not.toHaveBeenCalled();
    });

    it("keeps the calm line when the account cannot be asked", async () => {
      vi.mocked(getTodos).mockRejectedValue(new Error("offline"));
      const wrapper = mount(TodayView);
      await flushPromises();
      expect(wrapper.text()).toContain("Für heute ist nichts geplant.");
    });

    it("does not ask while the day has entries", async () => {
      getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
      mount(TodayView);
      await flushPromises();
      expect(getTodos).not.toHaveBeenCalled();
    });
  });

  it("relates worked time and quest hours in one line in the head", async () => {
    getTodayMock.mockResolvedValue({
      ...makePlanner([makeTodo()]),
      workedMinutes: 100,
      questHours: {
        todayMinutes: 80,
        weekMinutes: 251,
        weeklyTargetMinutes: 1200,
      },
    });
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get(".today-view__progress").text()).toBe(
      "0 von 1 erledigt",
    );
    expect(
      wrapper.get(".today-view__time").text().replace(/ /g, " "),
    ).toBe(
      "1 Std. 40 Min. gearbeitet, davon 1 Std. 20 Min. auf Kampagnen · Woche 4 Std. 11 Min. von 20 Std.",
    );
  });

  it("keeps count and time as two lines, each part whole", async () => {
    getTodayMock.mockResolvedValue({
      ...makePlanner([
        makeTodo(),
        makeTodo({ todoId: 2, title: "Alt", isOverdue: true }),
      ]),
      workedMinutes: 70,
      questHours: { todayMinutes: 0, weekMinutes: 70, weeklyTargetMinutes: null },
    });
    const wrapper = mount(TodayView);
    await flushPromises();
    const progress = wrapper.get(".today-view__progress");
    const time = wrapper.get(".today-view__time");
    // Two paragraphs, never one running line.
    expect(progress.element.tagName).toBe("P");
    expect(time.element.tagName).toBe("P");
    expect(
      progress.findAll(".today-view__progress-part").map((part) => part.text()),
    ).toEqual(["0 von 1 erledigt ·", "1 von früher"]);
    expect(
      time
        .findAll(".today-view__time-part")
        .map((part) => part.text().replace(/ /g, " ")),
    ).toEqual(["1 Std. 10 Min. gearbeitet ·", "Kampagnen diese Woche 1 Std. 10 Min."]);
  });

  it("leaves the time line out without measured time and goal", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find(".today-view__time").exists()).toBe(false);
  });

  it("shows an error when loading fails", async () => {
    getTodayMock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));

    const wrapper = mount(TodayView);

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );
  });

  it("arranges focus, catch-up and the resolved items", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeTodo({
          title: "Überfälliges Quest",
          scheduledDate: "2026-10-01",
          isOverdue: true,
        }),
        makeHabit({ title: "Offenes Daily" }),
        makeTodo({
          todoId: 2,
          title: "Erledigtes Quest",
          status: "completed",
          completedAt: "2026-10-02T10:00:00.000Z",
        }),
        makeHabit({
          occurrenceId: 21,
          title: "Übersprungenes Daily",
          status: "skipped",
        }),
      ]),
    );

    const wrapper = mount(TodayView);
    await flushPromises();

    expect(wrapper.get(".focus").text()).toContain("Offenes Daily");
    // Skipped counts neither as done nor as planned; earlier work is named.
    expect(wrapper.get(".today-view__progress").text()).toBe(
      "1 von 2 erledigt · 1 von früher · 1 übersprungen",
    );
    const catchUp = wrapper.get(".catch-up__toggle");
    expect(catchUp.text()).toContain("1 Eintrag von früher");
    expect(wrapper.text()).not.toContain("Überfälliges Quest");
    await catchUp.trigger("click");
    expect(wrapper.get(".catch-up__body").text()).toContain(
      "Überfälliges Quest",
    );

    const resolved = wrapper.get(".resolved__toggle");
    expect(resolved.text()).toContain("2 abgeschlossen");
    await resolved.trigger("click");
    expect(wrapper.findAll("#resolved-list .planner-item")).toHaveLength(2);
  });

  it("shows the why and the goal on the focus only", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeHabit({
          why: "Halbmarathon im März",
          goal: {
            title: "20 Läufe",
            completed: 12,
            target: 20,
            periodEnd: "2026-12-31",
          },
        }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get(".focus__why").text()).toBe("Halbmarathon im März");
    expect(wrapper.get(".focus__meta").text()).toContain(
      "20 Läufe: 12 von 20 bis 31.12.2026",
    );
  });

  it("names the campaign once when the goal is the campaign itself", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeHabit({
          goal: {
            title: "Halbmarathon schaffen",
            completed: 9,
            target: 24,
            periodEnd: "2027-01-20",
          },
          campaign: {
            id: 40,
            title: "Halbmarathon schaffen",
            color: null,
            icon: null,
          },
        }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    const meta = wrapper.get(".focus__meta");
    const spans = meta.findAll(":scope > *").map((part) => part.text());
    const chip = spans.findIndex((text) =>
      text.includes("Halbmarathon schaffen"),
    );
    // The chip names it, the count follows it alone.
    expect(spans[chip + 1]).toBe("9 von 24 bis 20.01.2027");
    expect(meta.text().split("Halbmarathon schaffen")).toHaveLength(2);
  });

  it("lists appointments in the order of the day, anchored by their time", async () => {
    getTodayMock.mockResolvedValueOnce({
      ...makePlanner([
        makeTodo({ todoId: 3, title: "Zahnarzt", timeOfDay: "14:00" }),
        makeTodo(),
        makeTodo({ todoId: 2, title: "Bewerbung" }),
        makeHabit({ title: "Lesen" }),
      ]),
      externalEvents: [
        {
          id: 5,
          title: "Mittagessen",
          start: "2026-10-02T10:00:00.000Z",
          end: "2026-10-02T11:00:00.000Z",
          dayPosition: null,
          done: false,
        },
      ],
    });
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get("#focus-title").text()).toBe("NestJS lernen");
    // In the order the server sends: appointments stand where they are anchored.
    expect(
      wrapper.findAll(".order .planner-item h3").map((row) => row.text()),
    ).toEqual(["Zahnarzt", "Bewerbung", "Lesen"]);
    const appointment = wrapper.get(".today-view__appointment");
    expect(appointment.text()).toContain("14:00");
    // A place to drop a card next to, but it never lifts itself.
    expect(appointment.attributes("data-sort-key")).toBe("todo-3");
    expect(appointment.attributes("data-sort-anchor")).toBeUndefined();
    expect(wrapper.get(".today-view__event").text()).toContain(
      "12:00Mittagessen",
    );
    expect(wrapper.find(".timeline").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Termine");
  });

  it("ticks a Google event off into abgeschlossen and opens it again", async () => {
    const event = {
      id: 5,
      title: "Mittagessen",
      start: "2026-10-02T10:00:00.000Z",
      end: "2026-10-02T11:00:00.000Z",
      dayPosition: null,
      done: false,
    };
    getTodayMock.mockResolvedValue({
      ...makePlanner([makeTodo()]),
      externalEvents: [event],
    });
    vi.mocked(setEventDone).mockResolvedValue(undefined);
    const wrapper = mount(TodayView);
    await flushPromises();
    // The server answers with the tick from now on.
    getTodayMock.mockResolvedValue({
      ...makePlanner([makeTodo()]),
      externalEvents: [{ ...event, done: true }],
    });
    await wrapper.get('[aria-label="Mittagessen abhaken"]').trigger("click");
    await flushPromises();
    expect(setEventDone).toHaveBeenCalledWith(5, true);
    expect(wrapper.find(".today-view__event").exists()).toBe(false);
    // Not a quest: the count stays "0 von 1", the section counts it.
    const resolved = wrapper.get(".resolved__toggle");
    expect(resolved.text()).toContain("1 abgeschlossen");
    await resolved.trigger("click");
    getTodayMock.mockResolvedValue({
      ...makePlanner([makeTodo()]),
      externalEvents: [event],
    });
    await wrapper
      .get('[aria-label="Mittagessen wieder öffnen"]')
      .trigger("click");
    await flushPromises();
    expect(setEventDone).toHaveBeenLastCalledWith(5, false);
    expect(wrapper.find(".today-view__event").exists()).toBe(true);
  });

  it("keeps an item the server placed between two appointments there", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeTodo(),
        makeTodo({ todoId: 3, title: "Standup", timeOfDay: "13:00" }),
        makeTodo({ todoId: 2, title: "Bewerbung" }),
        makeTodo({ todoId: 4, title: "Zahnarzt", timeOfDay: "15:00" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(
      wrapper.findAll(".order .planner-item h3").map((row) => row.text()),
    ).toEqual(["Standup", "Bewerbung", "Zahnarzt"]);
  });

  it("asks quietly about an appointment that is over and still open", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeTodo({ todoId: 3, title: "Frühsport", timeOfDay: "06:30" }),
        makeTodo(),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    const row = wrapper.get(".today-view__appointment--past");
    expect(row.text()).toContain("Vorbei – erledigt?");
    expect(
      row.find('[aria-label="Frühsport erledigen"]').exists(),
    ).toBe(true);
    // The move waits in "…", as its first entry; the card stays compact.
    expect(row.find("[data-move-button]").exists()).toBe(false);
    await row.get('[aria-label="Aktionen für Frühsport"]').trigger("click");
    const entries = wrapper.findAll("[role=menuitem]");
    expect(entries[0]!.text()).toContain("Anderer Tag …");
    expect(entries[0]!.attributes("aria-label")).toBe(
      "Frühsport auf einen anderen Tag",
    );
    await entries[0]!.trigger("click");
    await flushPromises();
    expect(wrapper.find(".modal-dialog").exists()).toBe(true);
  });

  it("shows the week's campaign hours against the goal as a slim bar, figures kept whole", async () => {
    getTodayMock.mockResolvedValue({
      ...makePlanner([makeTodo()]),
      questHours: {
        todayMinutes: 0,
        weekMinutes: 260,
        weeklyTargetMinutes: 1200,
      },
    });
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get(".today-view__time").text()).toBe(
      "Kampagnen diese Woche 4 Std. 20 Min. von 20 Std.",
    );
    const bar = wrapper.get('[role="progressbar"]');
    expect(bar.attributes("aria-valuetext")).toBe("4 Std. 20 Min. von 20 Std.");
    expect(bar.get("span").attributes("style")).toContain("width: 22%");
  });

  it("sorts with Nach oben in the menu, shows it at once and stores it", async () => {
    const anchor = makeTodo({ todoId: 3, title: "Zahnarzt", timeOfDay: "14:00" });
    const first = makeTodo();
    const second = makeTodo({ todoId: 2, title: "Bewerbung" });
    const third = makeHabit({ title: "Lesen" });
    getTodayMock
      .mockResolvedValueOnce(makePlanner([anchor, first, second, third]))
      .mockResolvedValue(makePlanner([anchor, first, third, second]));
    let stored = (): void => undefined;
    vi.mocked(reorderDay).mockReturnValueOnce(
      new Promise<void>((resolve) => (stored = resolve)),
    );
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();

    const trigger = (title: string) =>
      wrapper.get(`button[aria-label="Aktionen für ${title}"]`);
    await trigger("Lesen").trigger("click");
    await wrapper.get('[aria-label="Lesen nach oben"]').trigger("click");

    // Before the server has answered, the new order already shows.
    expect(
      wrapper.findAll(".order .planner-item h3").map((row) => row.text()),
    ).toEqual(["NestJS lernen", "Lesen", "Bewerbung"]);
    expect(wrapper.get("#focus-title").text()).toBe("Zahnarzt");
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 3 },
      { type: "todo", id: 1 },
      { type: "habit", id: 20 },
      { type: "todo", id: 2 },
    ]);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Lesen“ steht jetzt an Stelle 3 von 4.",
    );

    stored();
    await flushPromises();
    // The keyboard stays on the moved card's menu button.
    expect(document.activeElement).toBe(trigger("Lesen").element);
  });

  it("makes another quest the focus when it moves to the head of the order", async () => {
    const first = makeTodo();
    const second = makeTodo({ todoId: 2, title: "Bewerbung" });
    getTodayMock
      .mockResolvedValueOnce(makePlanner([first, second]))
      .mockResolvedValue(makePlanner([second, first]));
    const wrapper = mount(TodayView);
    await flushPromises();

    await wrapper.get('[aria-label="Aktionen für Bewerbung"]').trigger("click");
    await wrapper.get('[aria-label="Bewerbung nach oben"]').trigger("click");
    await flushPromises();

    expect(wrapper.get("#focus-title").text()).toBe("Bewerbung");
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
  });

  it("goes back to the stored order when saving it fails", async () => {
    const first = makeTodo();
    const second = makeTodo({ todoId: 2, title: "Bewerbung" });
    const third = makeTodo({ todoId: 3, title: "Einkaufen" });
    getTodayMock.mockResolvedValue(makePlanner([first, second, third]));
    vi.mocked(reorderDay).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = mount(TodayView);
    await flushPromises();

    await wrapper.get('[aria-label="Aktionen für Einkaufen"]').trigger("click");
    await wrapper.get('[aria-label="Einkaufen nach oben"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
    await wrapper.vm.$nextTick();
  });

  it("moves everything open to tomorrow after asking and names what stays", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 3, title: "Zahnarzt", timeOfDay: "14:00" }),
        makeTodo(),
        makeTodo({ todoId: 2, title: "Bewerbung" }),
        // Carried over from earlier: it goes along.
        makeTodo({
          todoId: 4,
          title: "Rechnung",
          scheduledDate: "2026-09-30",
          isOverdue: true,
        }),
        // This daily cannot move: its window ends today.
        makeHabit({ title: "Lesen", moveUntil: "2026-10-02" }),
      ]),
    );
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();

    await openPostpone(wrapper);
    expect(rescheduleTodo).not.toHaveBeenCalled();
    const text = document.body.textContent;
    expect(text).toContain(
      "4 offene Einträge wandern auf morgen und reihen sich dort hinten ein. Termine behalten ihre Uhrzeit.",
    );
    expect(text).toContain("„Lesen“ bleibt: Sein Zeitraum endet heute.");
    document
      .querySelector<HTMLButtonElement>("[data-postpone-confirm]")!
      .click();
    await flushPromises();

    // The appointment moves with its time: no question at the server.
    expect(
      vi.mocked(rescheduleTodo).mock.calls.map(([id, date, fixed]) => [id, date, fixed]),
    ).toEqual(
      expect.arrayContaining([
        [1, "2026-10-03", true],
        [2, "2026-10-03", true],
        [3, "2026-10-03", true],
        [4, "2026-10-03", true],
      ]),
    );
    expect(rescheduleTodo).toHaveBeenCalledTimes(4);
    // What was carried over comes last.
    expect(vi.mocked(rescheduleTodo).mock.calls.at(-1)![0]).toBe(4);
  });

  it("keeps Auf morgen in the head on a phone, with the same question", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query === "(max-width: 39.99rem)",
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    try {
      getTodayMock.mockResolvedValue(
        makePlanner([makeTodo(), makeTodo({ todoId: 2, title: "Bewerbung" })]),
      );
      const wrapper = mount(TodayView, { attachTo: document.body });
      await flushPromises();
      const pill = wrapper.get(
        '.today-view__header [aria-label="Offenes auf morgen verschieben"]',
      );
      expect(pill.text()).toBe("Auf morgen");
      await openPostpone(wrapper);
      expect(document.body.textContent).toContain(
        "2 offene Einträge wandern auf morgen",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("asks before completing a campaign planned for today with open quests", async () => {
    const book = { id: 1, title: "NestJS lernen", color: null, icon: null };
    getTodayMock.mockResolvedValue(makePlanner([makeTodo({ campaign: book })]));
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      { id: 1, progress: { todoCount: 2, doneCount: 0 } } as never,
    ]);
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.get(".campaign-completion__lead").text()).toContain(
      "2 Quests in „NestJS lernen“ sind noch offen. Sie bleiben offen",
    );
    expect(updateTodoMock).not.toHaveBeenCalled();
    await wrapper.get("[data-campaign-confirm]").trigger("click");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(1, true);
    expect(wrapper.get(".today-view__toast").text()).toContain(
      "„NestJS lernen“ abgeschlossen",
    );
  });

  it("offers to load Heute again after a failure", async () => {
    getTodayMock
      .mockRejectedValueOnce(new Error("Der Server hatte gerade einen Fehler."))
      .mockResolvedValue(makePlanner([makeTodo()]));
    const wrapper = mount(TodayView);
    await flushPromises();
    const retry = wrapper
      .findAll("button")
      .find((button) => button.text() === "Erneut versuchen")!;
    await retry.trigger("click");
    await flushPromises();
    expect(getTodayMock).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("NestJS lernen");
  });

  it("completes the focus, reloads and offers undo", async () => {
    getTodayMock
      .mockResolvedValueOnce(makePlanner([makeTodo()]))
      .mockResolvedValue(
        makePlanner([
          makeTodo({
            status: "completed",
            completedAt: "2026-10-02T10:00:00.000Z",
          }),
        ]),
      );

    const wrapper = mount(TodayView);
    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();

    expect(updateTodoMock).toHaveBeenCalledWith(1, true);
    expect(getTodayMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Alles für heute erledigt.");
    expect(wrapper.get(".today-view__toast").text()).toContain(
      "„NestJS lernen“ erledigt",
    );

    await wrapper.get(".today-view__toast button").trigger("click");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenLastCalledWith(1, false);
  });

  it("reopens a completed todo", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({
          status: "completed",
          completedAt: "2026-10-02T10:00:00.000Z",
        }),
      ]),
    );

    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get(".resolved__toggle").trigger("click");

    await wrapper
      .get('button[aria-label="NestJS lernen wieder öffnen"]')
      .trigger("click");
    await flushPromises();

    expect(updateTodoMock).toHaveBeenCalledWith(1, false);
  });

  it.each([
    ["pending", "completed", "erledigen"],
    ["completed", "pending", "wieder öffnen"],
    ["skipped", "pending", "wieder öffnen"],
  ] as const)(
    "changes a habit from %s to %s",
    async (initialStatus, targetStatus, actionLabel) => {
      getTodayMock.mockResolvedValue(
        makePlanner([makeHabit({ status: initialStatus })]),
      );

      const wrapper = mount(TodayView);
      await flushPromises();
      if (initialStatus !== "pending")
        await wrapper.get(".resolved__toggle").trigger("click");

      await wrapper
        .get(`button[aria-label="Joggen ${actionLabel}"]`)
        .trigger("click");
      await flushPromises();

      expect(updateOccurrenceMock).toHaveBeenCalledWith(20, targetStatus);
      expect(updateTodoMock).not.toHaveBeenCalled();
      expect(getTodayMock).toHaveBeenCalledTimes(2);
    },
  );

  it("skips a pending habit", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeHabit()]));

    const wrapper = mount(TodayView);
    await flushPromises();

    // Überspringen waits in the menu, not as a button on the card.
    expect(
      wrapper.find('button[aria-label="Joggen überspringen"]').exists(),
    ).toBe(false);
    await wrapper.get('[aria-label="Aktionen für Joggen"]').trigger("click");
    await wrapper
      .get('button[aria-label="Joggen überspringen"]')
      .trigger("click");
    await flushPromises();

    expect(updateOccurrenceMock).toHaveBeenCalledWith(20, "skipped");
    expect(getTodayMock).toHaveBeenCalledTimes(2);
  });

  it("shows an update error without reloading the planner", async () => {
    getTodayMock.mockResolvedValueOnce(makePlanner([makeTodo()]));
    updateTodoMock.mockRejectedValueOnce(new Error("Speichern fehlgeschlagen"));

    const wrapper = mount(TodayView);
    await flushPromises();

    const done = wrapper.get<HTMLButtonElement>(
      'button[aria-label="NestJS lernen erledigen"]',
    );
    await done.trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Speichern fehlgeschlagen",
    );
    expect(getTodayMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get("#focus-title").text()).toBe("NestJS lernen");
    expect(done.element.disabled).toBe(false);
    expect(wrapper.find(".today-view__toast button").exists()).toBe(false);
  });

  it("disables an item while its update is pending", async () => {
    let resolveUpdate!: () => void;

    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    updateTodoMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const wrapper = mount(TodayView);
    await flushPromises();

    const button = wrapper.get<HTMLButtonElement>(
      'button[aria-label="NestJS lernen erledigen"]',
    );
    await button.trigger("click");

    expect(button.element.disabled).toBe(true);
    expect(updateTodoMock).toHaveBeenCalledTimes(1);

    resolveUpdate();
    await flushPromises();
  });

  it("plans every movable carried-over item for today in one go", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({
          title: "Alt eins",
          scheduledDate: "2026-09-30",
          isOverdue: true,
        }),
        makeTodo({
          todoId: 2,
          title: "Alt zwei",
          scheduledDate: "2026-10-01",
          isOverdue: true,
        }),
        makeTodo({
          todoId: 3,
          title: "Termin von gestern",
          scheduledDate: "2026-10-01",
          timeOfDay: "11:00",
          isOverdue: true,
        }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get(".catch-up__toggle").trigger("click");

    const all = wrapper.get(".catch-up__all");
    expect(all.text()).toBe("Alle 2 heute einplanen");
    await all.trigger("click");
    await flushPromises();

    expect(vi.mocked(rescheduleTodo).mock.calls).toEqual([
      [1, "2026-10-02", false],
      [2, "2026-10-02", false],
    ]);
  });
});

describe("TodayView habit schedule editing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    getTodayMock.mockResolvedValue(makePlanner([makeHabit()]));
    vi.mocked(getHabit).mockResolvedValue({
    ...HABIT_FIELDS,
      id: 10,
      title: "Joggen",
      isActive: true,
      plannedDurationMinutes: null,
      timerOccurrenceId: null,
      timerDurationMinutes: null,
      upcomingSchedule: null,
      currentSchedule: {
        id: 100,
        effectiveFrom: "2026-10-01",
        effectiveAt: "2026-10-01T08:00:00Z",
        endsAt: null,
        cancelledAt: null,
        firstDueDate: "2026-10-01",
        schedule: {
          type: "interval",
          intervalDays: 2,
          missedOccurrencePolicy: "carry_over",
        },
      },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("saves a future rule and reloads the planner", async () => {
    vi.mocked(changeHabitSchedule).mockResolvedValue(await getHabit(10));
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('input[name="changeSchedule"]').setValue(true);
    await wrapper.get('input[name="effectiveFrom"]').setValue("2026-10-10");
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: {
        type: "interval",
        intervalDays: 4,
        missedOccurrencePolicy: "carry_over",
      },
    });
    expect(getTodayMock).toHaveBeenCalledTimes(2);
    expect(wrapper.find(".item-editor").exists()).toBe(false);
  });

  it("preserves the editor and does not reload after a schedule conflict", async () => {
    vi.mocked(changeHabitSchedule).mockRejectedValue(
      new Error("Schedule conflict"),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('input[name="changeSchedule"]').setValue(true);
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('.item-editor [role="alert"]').text()).toBe(
      "Schedule conflict",
    );
    expect(getTodayMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".item-editor").exists()).toBe(true);
  });
});

describe("TodayView creation flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getTodayMock.mockResolvedValue(makePlanner());
    vi.mocked(createHabit).mockResolvedValue({
    ...HABIT_FIELDS,
      id: 10,
      title: "Joggen",
      isActive: true,
      plannedDurationMinutes: null,
      timerOccurrenceId: null,
      timerDurationMinutes: null,
      currentSchedule: null,
      upcomingSchedule: null,
    });
    vi.mocked(createTodo).mockResolvedValue({
    ...TODO_FIELDS,
      id: 1,
      parentId: null,
      title: "Test",
      completed: false,
      completedAt: null,
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      timerEligible: true,
    });
  });
  it("hides the forms until plus is clicked, then offers Quest | Daily", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(wrapper.find(".create-todo").exists()).toBe(false);
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    expect(wrapper.find('[data-test="kind-todo"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="kind-habit"]').exists()).toBe(true);
    expect(wrapper.find("dialog .create-todo").exists()).toBe(true);
  });
  it.each(["todo", "habit"] as const)(
    "creates a %s through plus and refreshes the planner",
    async (kind) => {
      const wrapper = mount(TodayView);
      await flushPromises();
      await wrapper
        .get('button[aria-label="Eintrag erstellen"]')
        .trigger("click");
      await wrapper.get(`[data-test="kind-${kind}"]`).setValue(true);
      await wrapper.get('dialog input[name="title"]').setValue("Test");
      await wrapper.get("dialog form").trigger("submit");
      await flushPromises();
      expect(kind === "todo" ? createTodo : createHabit).toHaveBeenCalledTimes(
        1,
      );
      expect(wrapper.find("dialog").exists()).toBe(false);
      expect(getTodayMock).toHaveBeenCalledTimes(2);
      expect(wrapper.get('[role="status"]').text()).toContain(
        kind === "todo" ? "Quest erstellt" : "Daily erstellt",
      );
    },
  );
  it("retains the habit creation form after failure without refreshing", async () => {
    vi.mocked(createHabit).mockRejectedValueOnce(
      new Error("Backend nicht erreichbar"),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    await wrapper.get('[data-test="kind-habit"]').setValue(true);
    await wrapper.get('dialog input[name="title"]').setValue("Joggen");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('dialog [role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );
    expect(wrapper.find("dialog").exists()).toBe(true);
    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });
  it("closes on cancellation and opens on the quest form again", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    await wrapper.get('[data-test="kind-habit"]').setValue(true);
    await wrapper.get(".modal-dialog__close").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    expect(wrapper.find("dialog .create-todo").exists()).toBe(true);
    expect(createTodo).not.toHaveBeenCalled();
  });

  it("opens a Daily editor in a modal and restores focus on close", async () => {
    getTodayMock.mockResolvedValueOnce(makePlanner([makeHabit()]));
    vi.mocked(getHabit).mockResolvedValue({
    ...HABIT_FIELDS,
      id: 10,
      title: "Joggen",
      isActive: true,
      plannedDurationMinutes: null,
      timerOccurrenceId: null,
      timerDurationMinutes: null,
      currentSchedule: null,
      upcomingSchedule: null,
    });
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get<HTMLButtonElement>("[data-edit-button]");
    button.element.focus();
    await button.trigger("click");
    await flushPromises();
    expect(wrapper.get("dialog").attributes("aria-label")).toBe(
      "Daily bearbeiten",
    );
    expect(document.activeElement).toBe(
      wrapper.get('dialog input[name="title"]').element,
    );
    // Opened from today's run, the editor keeps that run's notes.
    expect(wrapper.get("dialog [data-notes]").attributes("data-notes")).toBe(
      "occurrence-20",
    );
    await wrapper.get(".modal-dialog__close").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get("[data-edit-button]").element,
    );
    wrapper.unmount();
  });

  it("deletes the whole daily from a run's menu after the editor's confirmation", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeHabit()]));
    vi.mocked(deleteHabit).mockResolvedValue(undefined);
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get('[aria-label="Aktionen für Joggen"]').trigger("click");
    await wrapper
      .get('[aria-label="Daily Joggen ganz löschen"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.get("dialog").text()).toContain("„Joggen“ wirklich löschen?");
    expect(deleteHabit).not.toHaveBeenCalled();
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(deleteHabit).toHaveBeenCalledWith(10);
    expect(wrapper.find("dialog").exists()).toBe(false);
  });
});

describe("TodayView keyboard shortcuts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    localStorage.clear();
    reloadShortcutSettings();
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
        makeTodo({ todoId: 3, title: "Drittens" }),
      ]),
    );
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mountToday(controller?: TimerController) {
    const wrapper = mount(TodayView, {
      attachTo: document.body,
      global: controller
        ? { provide: { [timerKey as symbol]: controller } }
        : {},
    });
    await flushPromises();
    return wrapper;
  }
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

  it("ticks the hovered row with X, like its ring, and offers undo", async () => {
    const wrapper = await mountToday();
    hover("todo-2");
    expect(press("x").defaultPrevented).toBe(true);
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(2, true);
    expect(wrapper.get(".today-view__toast").text()).toContain(
      "„Zweitens“ erledigt",
    );
  });

  it("moves the hovered row to tomorrow with D and says so", async () => {
    const wrapper = await mountToday();
    hover("todo-3");
    press("d");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(3, "2026-10-03", false);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Drittens“ steht jetzt bei morgen.",
    );
  });

  it("moves to next Monday with W and does nothing with T for a row of today", async () => {
    await mountToday();
    hover("todo-2");
    expect(press("t").defaultPrevented).toBe(false);
    press("w");
    await flushPromises();
    // 2 Oct 2026 is a Friday.
    expect(vi.mocked(rescheduleTodo).mock.calls).toEqual([
      [2, "2026-10-05", false],
    ]);
  });

  it("brings a carried-over quest to today with T", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Heute" }),
        makeTodo({
          todoId: 4,
          title: "Von gestern",
          scheduledDate: "2026-10-01",
          isOverdue: true,
        }),
      ]),
    );
    const wrapper = await mountToday();
    await wrapper.get(".catch-up__toggle").trigger("click");
    hover("todo-4");
    press("t");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(4, "2026-10-02", false);
  });

  it("opens Verschieben for an appointment instead of moving it", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 5, title: "Zahnarzt", timeOfDay: "18:00" }),
      ]),
    );
    const wrapper = await mountToday();
    hover("todo-5");
    press("d");
    await flushPromises();
    expect(rescheduleTodo).not.toHaveBeenCalled();
    expect(wrapper.get("dialog").attributes("aria-label")).toBe("Verschieben");
  });

  it("ignores a finished row", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({
          todoId: 6,
          title: "Fertig",
          status: "completed",
          completedAt: "2026-10-02T05:00:00Z",
        }),
      ]),
    );
    const wrapper = await mountToday();
    await wrapper.get(".resolved__toggle").trigger("click");
    hover("todo-6");
    expect(press("x").defaultPrevented).toBe(false);
    expect(press("d").defaultPrevented).toBe(false);
    expect(updateTodoMock).not.toHaveBeenCalled();
    expect(rescheduleTodo).not.toHaveBeenCalled();
  });

  it("moves the focus on to the next row when the focused row is ticked", async () => {
    getTodayMock
      .mockResolvedValueOnce(
        makePlanner([
          makeTodo({ todoId: 1, title: "Erstens" }),
          makeTodo({ todoId: 2, title: "Zweitens" }),
          makeTodo({ todoId: 3, title: "Drittens" }),
        ]),
      )
      .mockResolvedValue(
        makePlanner([
          makeTodo({ todoId: 1, title: "Erstens" }),
          makeTodo({
            todoId: 2,
            title: "Zweitens",
            status: "completed",
            completedAt: "2026-10-02T06:00:00Z",
          }),
          makeTodo({ todoId: 3, title: "Drittens" }),
        ]),
      );
    await mountToday();
    const edit =
      row("todo-2").querySelector<HTMLElement>("[data-edit-button]")!;
    edit.focus();
    press("x", edit);
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(2, true);
    expect(document.activeElement).toBe(
      row("todo-3").querySelector("[data-edit-button]"),
    );
  });

  it("starts the hovered row's stopwatch with Space", async () => {
    const controller = createTimerController();
    const start = vi.spyOn(controller, "start").mockResolvedValue();
    await mountToday(controller);
    hover("todo-3");
    expect(press(" ").defaultPrevented).toBe(true);
    expect(start).toHaveBeenCalledWith({
      kind: "todo",
      targetId: 3,
      title: "Drittens",
    });
  });

  it("puts N into the quick add field, and keys typed there stay text", async () => {
    await mountToday();
    press("n");
    await flushPromises();
    const field = document.querySelector<HTMLInputElement>(
      'input[name="quickTitle"]',
    )!;
    expect(document.activeElement).toBe(field);
    hover("todo-2");
    expect(press("x", field).defaultPrevented).toBe(false);
    expect(press("d", field).defaultPrevented).toBe(false);
    expect(updateTodoMock).not.toHaveBeenCalled();
  });

  it("does nothing with single keys switched off", async () => {
    setSingleKeys(false);
    await mountToday();
    hover("todo-2");
    press("x");
    await flushPromises();
    expect(updateTodoMock).not.toHaveBeenCalled();
    setSingleKeys(true);
  });
});

describe("TodayView rows and focus card", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    localStorage.clear();
    reloadShortcutSettings();
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  const texts = (
    wrapper: { findAll(selector: string): { text(): string }[] },
    selector: string,
  ) => wrapper.findAll(selector).map((element) => element.text());

  it("leads the focus card with the stopwatch: Starten, then Erledigt, Fokus-Modus and its menu", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeHabit({ moveUntil: "2026-10-04" }),
        makeTodo({ todoId: 2, title: "Danach" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();

    const focus = wrapper.get(".focus");
    const actions = focus.get(".focus__actions");
    expect(
      actions
        .findAll("button, a")
        .map((control) => control.attributes("aria-label")),
    ).toEqual([
      "Stoppuhr für Joggen starten",
      "Joggen erledigen",
      "Fokus-Modus",
      "Aktionen für Joggen",
    ]);
    // The stopwatch is the primary button and says its step; Erledigt a tinted pill with its word.
    const play = actions.get('[aria-label="Stoppuhr für Joggen starten"]');
    expect(play.classes()).toContain("item-play");
    expect(play.text()).toBe("Starten");
    const done = actions.get('[aria-label="Joggen erledigen"]');
    expect(done.classes()).toEqual(expect.arrayContaining(["btn", "focus__done"]));
    expect(done.classes()).not.toContain("btn--primary");
    expect(done.text()).toBe("Erledigt");
    expect(done.find("svg").exists()).toBe(true);
    // The Fokus-Modus is an icon link with its name as tooltip.
    const mode = actions.get('a[aria-label="Fokus-Modus"]');
    expect(mode.attributes("title")).toBe("Fokus-Modus");
    expect(mode.text()).toBe("");
    // No text buttons for Überspringen or Bearbeiten on the card.
    expect(texts(focus, "button")).not.toContain("Überspringen");
    expect(texts(focus, "button")).not.toContain("Bearbeiten");
    // No grip: the whole card drags, and its menu moves it down.
    expect(focus.find(".sort-handle").exists()).toBe(false);
    expect(focus.classes()).toEqual(
      expect.arrayContaining(["card-target", "card-drag"]),
    );

    await actions.get('[aria-label="Aktionen für Joggen"]').trigger("click");
    expect(texts(wrapper, "[role=menuitem] .action-menu__label")).toEqual([
      "Morgen",
      "Anderer Tag …",
      "Überspringen",
      "Bearbeiten",
      "Fokus-Modus",
      "Nach unten",
      "Löschen",
    ]);
  });

  it("opens the editor from a tap anywhere on the focus card but its controls", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    const wrapper = mount(TodayView, {
      global: {
        stubs: {
          EditItemDialog: {
            props: ["kind", "entityId"],
            template:
              '<div class="editor-stub">{{ kind }} {{ entityId }}</div>',
          },
        },
      },
    });
    await flushPromises();
    await wrapper.get(".focus__meta").trigger("click");
    expect(wrapper.get(".editor-stub").text()).toBe("todo 1");
  });

  it("opens the editor from the focus card's title", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    const wrapper = mount(TodayView, {
      global: {
        stubs: {
          EditItemDialog: {
            props: ["kind", "entityId"],
            template:
              '<div class="editor-stub">{{ kind }} {{ entityId }}</div>',
          },
        },
      },
    });
    await flushPromises();
    const title = wrapper.get('.focus h2[aria-label="NestJS lernen"] button');
    expect(title.attributes("aria-label")).toBe("NestJS lernen bearbeiten");
    await title.trigger("click");
    expect(wrapper.get(".editor-stub").text()).toBe("todo 1");
  });

  it("shows rows with ring, title, ▶ and a menu, and no text buttons", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    const row = wrapper.get('[data-focus-key="todo-2"]');
    expect(
      row.findAll("button").map((button) => button.attributes("aria-label")),
    ).toEqual([
      "Zweitens erledigen",
      "Zweitens bearbeiten",
      "Stoppuhr für Zweitens starten",
      "Aktionen für Zweitens",
    ]);
    expect(row.text()).not.toContain("Verschieben");
  });

  it("moves a row to tomorrow from its menu the way D does", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('[aria-label="Aktionen für Zweitens"]').trigger("click");
    const entries = wrapper.findAll("[role=menuitem]");
    expect(
      entries.map((entry) => entry.get(".action-menu__label").text()),
    ).toEqual([
      "Morgen",
      "Nächste Woche",
      "Anderer Tag …",
      "Bearbeiten",
      "In Kampagne verschieben …",
      "Nach oben",
      "Löschen",
    ]);
    // The keys that do the same are named for assistive technology.
    expect(entries[0]!.attributes("aria-keyshortcuts")).toBe("D");
    expect(entries[1]!.attributes("aria-keyshortcuts")).toBe("W");
    await wrapper.get('[aria-label="Zweitens auf morgen"]').trigger("click");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(2, "2026-10-03", false);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Zweitens“ steht jetzt bei morgen.",
    );
  });

  it("offers an appointment only Verschieben, where the move is confirmed", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zahnarzt", timeOfDay: "15:00" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get('[aria-label="Aktionen für Zahnarzt"]').trigger("click");
    expect(texts(wrapper, "[role=menuitem] .action-menu__label")).toEqual([
      "Termin verschieben …",
      "Bearbeiten",
      "In Kampagne verschieben …",
      "Nach oben",
      "Löschen",
    ]);
    await wrapper.get('[aria-label="Zahnarzt verschieben"]').trigger("click");
    expect(wrapper.find('[data-test="move-confirm"]').exists()).toBe(true);
  });

  it("puts the card whose stopwatch runs on top as the focus card", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    const controller = createTimerController();
    controller.timer.value = {
      id: "t",
      kind: "todo",
      targetId: 2,
      title: "Zweitens",
      state: "running",
      elapsedMilliseconds: 1000,
      targetMinutes: null,
      targetReachedAt: null,
    };
    const wrapper = mount(TodayView, {
      global: { provide: { [timerKey as symbol]: controller } },
    });
    await flushPromises();
    // "Zweitens" is stored second, but the stopwatch brings it up.
    const card = wrapper.get(".focus");
    expect(card.attributes("data-focus-key")).toBe("todo-2");
    expect(card.get(".focus__running").text()).toBe("läuft");
    expect(
      card
        .find('[aria-label="Stoppuhr für Zweitens läuft, pausieren"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.find(".item-row__running").exists()).toBe(false);

    controller.timer.value = {
      ...controller.timer.value,
      targetId: 1,
      title: "Erstens",
      state: "paused",
    };
    await flushPromises();
    expect(wrapper.get(".focus__running").text()).toBe("pausiert");
    controller.dispose();
  });
});

describe("TodayView: an appointment's turn on the focus card", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 09:50 in Berlin; the clock and its timers are fake, so time can pass.
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-02T07:50:00Z"));
    updateTodoMock.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  const day = () =>
    makePlanner([
      makeTodo({
        todoId: 7,
        title: "Teamrunde",
        timeOfDay: "10:00",
        plannedDurationMinutes: 45,
      }),
      makeTodo({ todoId: 1, title: "Steuer sortieren" }),
      makeTodo({ todoId: 2, title: "Mails" }),
    ]);

  it("switches to the appointment at its start and back at its end, without polling", async () => {
    getTodayMock.mockResolvedValue(day());
    const wrapper = mount(TodayView);
    await flushPromises();
    // Before: the next thing to work on; the appointment waits in the list.
    expect(wrapper.get("#focus-title").text()).toBe("Steuer sortieren");
    expect(wrapper.get(".today-view__appointment").text()).toContain(
      "Teamrunde",
    );
    // One timer, set for the start, not one a minute.
    expect(vi.getTimerCount()).toBe(1);

    // The timer wakes a moment after the minute turns.
    vi.advanceTimersByTime(10 * 60_000 + 100);
    await flushPromises();
    expect(wrapper.get("#focus-title").text()).toBe("Teamrunde");
    expect(wrapper.get(".focus__slot").text()).toBe("10:00–10:45");
    expect(wrapper.find(".today-view__appointment").exists()).toBe(false);

    vi.advanceTimersByTime(45 * 60_000);
    await flushPromises();
    // After: back to the order; the open appointment stays and asks.
    expect(wrapper.get("#focus-title").text()).toBe("Steuer sortieren");
    expect(wrapper.find(".focus__slot").exists()).toBe(false);
    const past = wrapper.get(".today-view__appointment--past");
    expect(past.text()).toContain("Teamrunde");
    expect(past.text()).toContain("Vorbei – erledigt?");
  });

  it("keeps Starten, Erledigt and Termin verschieben for an appointment, without the Fokus-Modus", async () => {
    vi.setSystemTime(new Date("2026-10-02T08:10:00Z"));
    getTodayMock.mockResolvedValue(day());
    const wrapper = mount(TodayView);
    await flushPromises();
    const actions = wrapper.get(".focus__actions");
    expect(
      actions
        .findAll("button, a")
        .map((control) => control.attributes("aria-label")),
    ).toEqual([
      "Stoppuhr für Teamrunde starten",
      "Teamrunde erledigen",
      "Aktionen für Teamrunde",
    ]);
    // Not part of the order: the card does not drag.
    expect(wrapper.get(".focus").classes()).toContain("card-drag");
    await actions.get('[aria-label="Aktionen für Teamrunde"]').trigger("click");
    expect(texts(wrapper, "[role=menuitem] .action-menu__label")).toEqual([
      "Termin verschieben …",
      "Bearbeiten",
      "In Kampagne verschieben …",
      "Nach unten",
      "Löschen",
    ]);
  });

  it("says when the next appointment comes once the order is done", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 7, title: "Teamrunde", timeOfDay: "10:00" }),
        makeTodo({ todoId: 1, title: "Erledigt", status: "completed" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find(".focus").exists()).toBe(false);
    expect(wrapper.text()).toContain(
      "In der Reihenfolge ist nichts mehr offen.",
    );
    expect(wrapper.text()).toContain("Nächster Termin: 10:00 Teamrunde.");
    expect(wrapper.text()).not.toContain("Alles für heute erledigt.");
  });

  function texts(
    wrapper: ReturnType<typeof mount>,
    selector: string,
  ): string[] {
    return wrapper.findAll(selector).map((element) => element.text());
  }
});

describe("TodayView: rows say what they are and what they are for", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("leads a Daily's meta line with the Daily marker and shows the Warum", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ title: "Kopf", why: "Damit der Tag Luft hat" }),
        makeHabit({ title: "Joggen", why: "Für einen ruhigen Kopf" }),
        makeTodo({ todoId: 2, title: "Ohne Warum" }),
        makeTodo({ todoId: 3, title: "Dritte", why: "Später im Tag" }),
        makeTodo({
          todoId: 4,
          title: "Erledigt",
          why: "Vorbei",
          status: "completed",
        }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    // The focus card keeps its Warum as a sentence.
    expect(wrapper.get(".focus__why").text()).toBe("Damit der Tag Luft hat");
    const daily = wrapper.get('[data-focus-key="habit-20"]');
    expect(daily.get(".item-row__meta > :first-child").text()).toBe("Daily");
    expect(daily.get(".planner-item__why").text()).toBe(
      "Für einen ruhigen Kopf",
    );
    // The first two rows show it on a phone too; later rows from 40rem.
    expect(daily.get(".planner-item__why").classes()).not.toContain(
      "planner-item__why--wide",
    );
    const third = wrapper.get('[data-focus-key="todo-3"]');
    expect(third.get(".planner-item__why").classes()).toContain(
      "planner-item__why--wide",
    );
    const plain = wrapper.get('[data-focus-key="todo-2"]');
    expect(plain.find(".planner-item__why").exists()).toBe(false);
    // A quest's meta line has no Daily marker.
    expect(third.text()).not.toContain("Daily");
  });

  it("marks a Daily on the focus card, too", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeHabit()]));
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get(".focus__meta .focus__daily").text()).toBe("Daily");
  });

  it("puts the plus button after the content in reading order", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    const wrapper = mount(TodayView);
    await flushPromises();
    const buttons = wrapper.findAll("main button");
    expect(buttons[0]!.classes()).not.toContain("create-button");
    const plus = wrapper.get(".create-button");
    const heading = wrapper.get("h1");
    expect(
      heading.element.compareDocumentPosition(plus.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      wrapper.get(".order").element.compareDocumentPosition(plus.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("TodayView: the Monats-Challenge's run in the day", () => {
  const challenge: MonthChallenge = {
    id: 1,
    month: "2026-10",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    habitId: 7,
    title: "Sport",
    reminderTime: "19:00",
    status: "running",
    endedAt: null,
    day: 2,
    days: 31,
    done: 1,
    missed: 0,
    remaining: 30,
    total: 31,
    percent: 3,
    todayRun: "open",
    todayOccurrenceId: 70,
  };
  const run = (overrides: Partial<DayPlannerHabitItem> = {}) =>
    makeHabit({
      occurrenceId: 70,
      habitId: 7,
      title: "Sport",
      monthChallenge: true,
      ...overrides,
    });
  const day = (items: DayPlannerResponse["items"]) => ({
    ...makePlanner(items),
    monthChallenge: challenge,
  });
  const titles = (wrapper: ReturnType<typeof mount>) =>
    wrapper
      .findAll(".order > [data-sort-key]")
      .map((card) => card.attributes("data-sort-key"));

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // 08:00 in Berlin.
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("has no card of its own: the focus card heads the day, the run keeps its place", async () => {
    getTodayMock.mockResolvedValue(
      day([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
        run(),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find(".challenge-card").exists()).toBe(false);
    expect(wrapper.get(".order > :first-child").classes()).toContain("focus");
    expect(titles(wrapper)).toEqual(["todo-1", "todo-2", "habit-70"]);
    // Its row names the challenge and where it stands, in words.
    const row = wrapper.get('[data-focus-key="habit-70"]');
    expect(row.get(".planner-item__challenge").text()).toBe(
      "Monats-Challenge · Tag 2 · 1 von 1 geschafft · noch 30",
    );
    // Its meta line wraps on a phone, so the progress is never cut off.
    expect(row.classes()).toContain("item-row--wrap-meta");
  });

  it("moves the open run right below the focus card from its reminder time", async () => {
    // 19:30 in Berlin.
    vi.setSystemTime(new Date("2026-10-02T17:30:00Z"));
    getTodayMock.mockResolvedValue(
      day([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
        run(),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(titles(wrapper)).toEqual(["todo-1", "habit-70", "todo-2"]);
    // It stays where it is stored: it does not step down.
    await wrapper.get('[aria-label="Aktionen für Sport"]').trigger("click");
    const labels = wrapper
      .findAll("[role=menuitem] .action-menu__label")
      .map((entry) => entry.text());
    expect(labels).toContain("Nach oben");
    expect(labels).not.toContain("Nach unten");
  });

  it("brings a run carried over from an earlier day up out of Nachholen in the evening", async () => {
    // 19:30 in Berlin.
    vi.setSystemTime(new Date("2026-10-02T17:30:00Z"));
    getTodayMock.mockResolvedValue(
      day([
        run({ isOverdue: true, scheduledDate: "2026-09-30" }),
        makeTodo({ todoId: 1, title: "Erstens", status: "completed" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(titles(wrapper)).toEqual(["habit-70"]);
    expect(wrapper.find(".catch-up").exists()).toBe(false);
    // It is still open, so the day is not done.
    expect(wrapper.text()).not.toContain("Alles für heute erledigt.");
    expect(
      wrapper.get('[data-focus-key="habit-70"] .planner-item__challenge').text(),
    ).toBe("Monats-Challenge · Tag 2 · 1 von 1 geschafft · noch 30");
  });

  it("puts the challenge on the focus card when its run is the focus", async () => {
    getTodayMock.mockResolvedValue(
      day([run(), makeTodo({ todoId: 2, title: "Danach" })]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get(".focus__challenge").text()).toBe(
      "Monats-Challenge · Tag 2 · 1 von 1 geschafft · noch 30",
    );
    expect(wrapper.find(".planner-item__challenge").exists()).toBe(false);
  });

  it("leads from the run's menu to the challenge in the Dailies", async () => {
    getTodayMock.mockResolvedValue(
      day([makeTodo({ todoId: 1, title: "Erstens" }), run()]),
    );
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('[aria-label="Aktionen für Sport"]').trigger("click");
    const entry = wrapper
      .findAll("[role=menuitem]")
      .find((item) => item.text().includes("Zur Monats-Challenge"))!;
    await entry.trigger("click");
    expect(routerPush).toHaveBeenCalledWith("/dailies?abschnitt=challenge");
  });

  it("shows nothing extra on a day without a run of the challenge", async () => {
    getTodayMock.mockResolvedValue({
      ...day([makeTodo({ todoId: 1, title: "Erstens" })]),
      monthChallenge: { ...challenge, todayRun: "none", todayOccurrenceId: null },
    });
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.text()).not.toContain("Monats-Challenge");
    expect(titles(wrapper)).toEqual(["todo-1"]);
  });
});

describe("TodayView on wide screens", () => {
  const original = window.matchMedia;
  const stretch: HistoryWorkLog = {
    id: 3,
    title: "Kapitel",
    startedAt: "2026-10-02T05:00:00.000Z",
    endedAt: "2026-10-02T05:30:00.000Z",
    minutes: 30,
    source: "timer",
    todoId: 1,
    occurrenceId: null,
    habitId: null,
    campaign: null,
  };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    window.matchMedia = ((query: string) => ({
      matches: query.includes("64rem"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    vi.mocked(getHistory).mockResolvedValue({
      today: "2026-10-02",
      timeZone: "Europe/Berlin",
      startDate: "2026-10-02",
      endDate: "2026-10-02",
      days: [
        {
          date: "2026-10-02",
          items: [],
          planned: [],
          external: [],
          work: { minutes: 30, campaigns: [], logs: [stretch] },
        },
      ],
    });
  });
  afterEach(() => {
    window.matchMedia = original;
    vi.useRealTimers();
  });

  it("puts today's day calendar beside the list", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.classes()).toContain("today-view--split");
    expect(getHistory).toHaveBeenCalledWith(
      "2026-10-02",
      "day",
      "all",
      expect.any(AbortSignal),
    );
    const calendar = wrapper.get(".today-view__calendar .day-calendar");
    expect(calendar.get("h2").text()).toBe("Logbuch 30 Min.");
    expect(calendar.get("button.log-block").attributes("aria-label")).toBe(
      "Kapitel, 07:00 bis 07:30, 30 Min., ohne Kampagne, korrigieren",
    );
  });

  it("trades the plus button for Neue Quest in the head, opening the same dialog", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find(".create-button").exists()).toBe(false);
    const create = wrapper.get(".today-view__header .today-view__create");
    expect(create.text()).toBe("Neue Quest");
    // A pill on the ground: "Starten" on the focus card stays the one primary.
    expect(create.classes()).toContain("btn--ground");
    expect(create.classes()).not.toContain("btn--primary");
    await create.trigger("click");
    expect(wrapper.find('[data-test="kind-todo"]').exists()).toBe(true);
    expect(wrapper.find("dialog .create-todo").exists()).toBe(true);
  });

  it("holds a deleted stretch behind Heute's undo toast", async () => {
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("button.log-block").trigger("click");
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Löschen")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.find("button.log-block").exists()).toBe(false);
    expect(wrapper.get(".undo-toast").text()).toContain(
      "Abschnitt „Kapitel“ gelöscht",
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Rückgängig")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.find("button.log-block").exists()).toBe(true);
    wrapper.unmount();
    expect(deleteWorkLog).not.toHaveBeenCalled();
  });
});

describe("TodayView's Liste · Logbuch below the split", () => {
  const original = window.matchMedia;
  const stretch: HistoryWorkLog = {
    id: 3,
    title: "Kapitel",
    startedAt: "2026-10-02T05:00:00.000Z",
    endedAt: "2026-10-02T05:30:00.000Z",
    minutes: 30,
    source: "timer",
    todoId: 1,
    occurrenceId: null,
    habitId: null,
    campaign: null,
  };
  const choice = (wrapper: ReturnType<typeof mount>) =>
    wrapper
      .findAll('[role="radiogroup"][aria-label="Ansicht"] input')
      .map((input) => [
        input.element.parentElement!.textContent!.trim(),
        (input.element as HTMLInputElement).checked,
      ]);
  const listShown = (wrapper: ReturnType<typeof mount>) =>
    wrapper.get<HTMLElement>(".today-view__day").element.style.display !==
    "none";

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.removeItem("today:pane");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    vi.mocked(getHistory).mockResolvedValue({
      today: "2026-10-02",
      timeZone: "Europe/Berlin",
      startDate: "2026-10-02",
      endDate: "2026-10-02",
      days: [
        {
          date: "2026-10-02",
          items: [],
          planned: [],
          external: [],
          work: { minutes: 30, campaigns: [], logs: [stretch] },
        },
      ],
    });
  });
  afterEach(() => {
    window.matchMedia = original;
    localStorage.removeItem("today:pane");
    vi.useRealTimers();
  });

  it("starts with the list and does not load the day calendar", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(choice(wrapper)).toEqual([
      ["Liste", true],
      ["Logbuch", false],
    ]);
    expect(listShown(wrapper)).toBe(true);
    expect(wrapper.find("#focus-title").exists()).toBe(true);
    expect(wrapper.find(".today-view__calendar").exists()).toBe(false);
    expect(getHistory).not.toHaveBeenCalled();
  });

  it("shows the day calendar instead of the list and remembers the choice on this device", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.findAll('input[name="todayPane"]')[1]!.setValue(true);
    await flushPromises();
    expect(localStorage.getItem("today:pane")).toBe("logbook");
    expect(listShown(wrapper)).toBe(false);
    const calendar = wrapper.get(".today-view__calendar .day-calendar");
    // In the page's flow: no scroll area of its own inside the page.
    expect(calendar.classes()).toContain("day-calendar--flow");
    expect(calendar.get("h2").text()).toBe("Logbuch 30 Min.");
    expect(calendar.get("button.log-block").attributes("aria-label")).toBe(
      "Kapitel, 07:00 bis 07:30, 30 Min., ohne Kampagne, korrigieren",
    );
    wrapper.unmount();

    const again = mount(TodayView);
    await flushPromises();
    expect(choice(again)).toEqual([
      ["Liste", false],
      ["Logbuch", true],
    ]);
    expect(again.find(".today-view__calendar .day-calendar").exists()).toBe(
      true,
    );

    await again.findAll('input[name="todayPane"]')[0]!.setValue(true);
    await flushPromises();
    expect(localStorage.getItem("today:pane")).toBe("list");
    expect(listShown(again)).toBe(true);
    expect(again.find(".today-view__calendar").exists()).toBe(false);
  });

  it("shows both side by side on wide screens, whatever was chosen", async () => {
    localStorage.setItem("today:pane", "logbook");
    window.matchMedia = ((query: string) => ({
      matches: query.includes("64rem"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find('input[name="todayPane"]').exists()).toBe(false);
    expect(listShown(wrapper)).toBe(true);
    const calendar = wrapper.get(".today-view__calendar .day-calendar");
    expect(calendar.classes()).not.toContain("day-calendar--flow");
  });
});

describe("TodayView kept alive behind other views", () => {
  /*
   * App.vue keeps Heute alive (`<KeepAlive include="TodayView">`); here a
   * host does the same with another view that has a row of its own.
   */
  const Other = defineComponent({
    name: "OtherView",
    render: () =>
      h("main", { class: "other-view" }, [
        h("article", { "data-focus-key": "todo-2" }, "Zeile anderswo"),
      ]),
  });
  const Host = defineComponent({
    props: { shown: { type: Boolean, default: true } },
    setup(props) {
      return () =>
        h(KeepAlive, { include: ["TodayView"] }, [
          props.shown ? h(TodayView) : h(Other),
        ]);
    },
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    localStorage.clear();
    reloadShortcutSettings();
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    updateTodoMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mountHost() {
    const wrapper = mount(Host, { attachTo: document.body });
    await flushPromises();
    return wrapper;
  }
  async function show(
    wrapper: Awaited<ReturnType<typeof mountHost>>,
    shown: boolean,
  ) {
    await wrapper.setProps({ shown });
    await flushPromises();
  }
  function press(key: string) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    return event;
  }
  function hover(key: string) {
    document
      .querySelector(`[data-focus-key="${key}"]`)!
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  }

  it("comes back as it was and loads quietly, without the skeleton", async () => {
    const wrapper = await mountHost();
    const card = wrapper.get("#focus-title").element;
    expect(getTodayMock).toHaveBeenCalledTimes(1);

    await show(wrapper, false);
    expect(wrapper.find(".today-view").exists()).toBe(false);
    // Completed elsewhere meanwhile.
    let answer!: (planner: DayPlannerResponse) => void;
    getTodayMock.mockReturnValueOnce(
      new Promise<DayPlannerResponse>((resolve) => (answer = resolve)),
    );

    await show(wrapper, true);
    expect(getTodayMock).toHaveBeenCalledTimes(2);
    // The same card, not a new one, and no skeleton while it loads.
    expect(wrapper.get("#focus-title").element).toBe(card);
    expect(
      wrapper.find('[aria-label="Tagesplan wird geladen"]').exists(),
    ).toBe(false);

    answer(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens", status: "completed" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    await flushPromises();
    expect(wrapper.get("#focus-title").text()).toBe("Zweitens");
  });

  it("hears no data changes while hidden", async () => {
    const wrapper = await mountHost();
    await show(wrapper, false);
    notifyDataChanged();
    await flushPromises();
    expect(getTodayMock).toHaveBeenCalledTimes(1);
    await show(wrapper, true);
    expect(getTodayMock).toHaveBeenCalledTimes(2);
  });

  it("handles no keys while another view is shown, and again once back", async () => {
    const wrapper = await mountHost();
    await show(wrapper, false);
    hover("todo-2");
    expect(press("x").defaultPrevented).toBe(false);
    expect(press("d").defaultPrevented).toBe(false);
    await flushPromises();
    expect(updateTodoMock).not.toHaveBeenCalled();
    expect(rescheduleTodo).not.toHaveBeenCalled();

    await show(wrapper, true);
    hover("todo-2");
    expect(press("x").defaultPrevented).toBe(true);
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(2, true);
  });

  it("closes an open dialog and releases the page's scroll lock when left", async () => {
    const wrapper = await mountHost();
    await openPostpone(wrapper);
    expect(document.querySelector("dialog[open]")).not.toBeNull();
    expect(document.body.style.position).toBe("fixed");

    await show(wrapper, false);
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.body.style.position).toBe("");

    await show(wrapper, true);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("ends the undo offer when left, as leaving always did", async () => {
    const wrapper = await mountHost();
    await wrapper.get('[aria-label="Erstens erledigen"]').trigger("click");
    await flushPromises();
    expect(wrapper.get(".today-view__toast").text()).toContain(
      "„Erstens“ erledigt",
    );
    await show(wrapper, false);
    await show(wrapper, true);
    expect(wrapper.get(".today-view__toast").text()).not.toContain(
      "„Erstens“ erledigt",
    );
  });
});

describe("TodayView on other days", () => {
  const plannedQuest = {
    type: "todo" as const,
    todoId: 41,
    title: "Steuer vorbereiten",
    status: "pending" as const,
    scheduledDate: "2026-10-03",
    timeOfDay: null,
    plannedDurationMinutes: 30,
    campaign: null,
    isOverdue: false,
  };
  function dayPlan(date: string, entries: unknown[]) {
    return {
      startDate: date,
      endDate: date,
      today: "2026-10-02",
      days: [{ date, entries }],
      overdue: [],
    } as never;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    route.query = {};
  });
  afterEach(() => {
    vi.useRealTimers();
    route.query = {};
  });

  it("leafs to yesterday and tomorrow with ‹ › last in its head", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get('button[aria-label="Voriger Tag"]').trigger("click");
    expect(routerReplace).toHaveBeenLastCalledWith({
      name: "today",
      query: { tag: "2026-10-01" },
    });
    await wrapper.get('button[aria-label="Nächster Tag"]').trigger("click");
    expect(routerReplace).toHaveBeenLastCalledWith({
      name: "today",
      query: { tag: "2026-10-03" },
    });
    // ‹ › close the row on every day, so they never move; before them on
    // today "Auf morgen", also where a card is dropped to move it there.
    const days = wrapper.findAll(".today-view__days button");
    expect(days.map((button) => button.attributes("aria-label"))).toEqual([
      "Offenes auf morgen verschieben",
      "Voriger Tag",
      "Nächster Tag",
    ]);
    expect(days[0]!.attributes("data-day-drop")).toBeDefined();
    expect(days[0]!.attributes("data-date")).toBe("2026-10-03");
  });

  it("shows tomorrow on Heute's cards, ready to plan, without the focus card", async () => {
    route.query = { tag: "2026-10-03" };
    vi.mocked(getPlan).mockResolvedValue(
      dayPlan("2026-10-03", [plannedQuest]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();

    expect(getPlan).toHaveBeenCalledWith("2026-10-03", 1, expect.anything());
    expect(wrapper.get(".today-view__relation").text()).toBe("Morgen");
    expect(wrapper.get("h1").text()).toBe("Samstag, 3. Okt.");
    expect(wrapper.text()).toContain("1 geplant");
    expect(wrapper.text()).toContain("Steuer vorbereiten");
    expect(wrapper.find(".focus").exists()).toBe(false);
    expect(
      wrapper.find('input[aria-label="Quest für morgen hinzufügen"]').exists(),
    ).toBe(true);
    // Today's own head figures stay with today.
    expect(wrapper.find(".today-view__progress").exists()).toBe(false);

    await wrapper.get(".today-view__back").trigger("click");
    expect(routerReplace).toHaveBeenLastCalledWith({ name: "today" });
  });

  it("shows what was done on a past day, and takes no new quests there", async () => {
    route.query = { tag: "2026-10-01" };
    vi.mocked(getPlan).mockResolvedValue(
      dayPlan("2026-10-01", [
        { ...plannedQuest, scheduledDate: "2026-10-01", status: "completed" },
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();

    expect(wrapper.get(".today-view__relation").text()).toBe("Gestern");
    expect(wrapper.text()).toContain("1 erledigt");
    expect(wrapper.get(".other-day__done").text()).toContain(
      "Steuer vorbereiten",
    );
    expect(wrapper.find(".quick-add").exists()).toBe(false);
  });

  it("names the narrow pane Termine on a day after today, Logbuch before", async () => {
    route.query = { tag: "2026-10-03" };
    vi.mocked(getPlan).mockResolvedValue(dayPlan("2026-10-03", []));
    const later = mount(TodayView);
    await flushPromises();
    const labels = (wrapper: ReturnType<typeof mount>) =>
      wrapper
        .findAll('input[name="todayPane"]')
        .map((input) => input.element.parentElement!.textContent!.trim());
    expect(labels(later)).toEqual(["Liste", "Termine"]);
    later.unmount();

    route.query = { tag: "2026-10-01" };
    vi.mocked(getPlan).mockResolvedValue(dayPlan("2026-10-01", []));
    const earlier = mount(TodayView);
    await flushPromises();
    expect(labels(earlier)).toEqual(["Liste", "Logbuch"]);
  });

  it("ticks a quest of another day as today does: campaign question, toast, undo", async () => {
    route.query = { tag: "2026-10-03" };
    const campaign = { id: 41, title: "Steuer vorbereiten", color: null, icon: null };
    vi.mocked(getPlan).mockResolvedValue(
      dayPlan("2026-10-03", [{ ...plannedQuest, campaign }]),
    );
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      { id: 41, progress: { todoCount: 2, doneCount: 0 } } as never,
    ]);
    const wrapper = mount(TodayView);
    await flushPromises();

    await wrapper
      .get('button[aria-label="Steuer vorbereiten erledigen"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.get(".campaign-completion__lead").text()).toContain(
      "2 Quests in „Steuer vorbereiten“ sind noch offen.",
    );
    expect(updateTodoMock).not.toHaveBeenCalled();
    await wrapper.get("[data-campaign-confirm]").trigger("click");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(41, true);
    expect(wrapper.get(".other-day__toast").text()).toContain(
      "„Steuer vorbereiten“ abgeschlossen",
    );

    await wrapper.get(".other-day__toast button").trigger("click");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenLastCalledWith(41, false);
    expect(wrapper.get(".other-day__toast").text()).toBe("");
  });

  it("opens a quest of another day in the same editor as today's", async () => {
    route.query = { tag: "2026-10-03" };
    vi.mocked(getPlan).mockResolvedValue(
      dayPlan("2026-10-03", [plannedQuest]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Steuer vorbereiten bearbeiten"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.find(".item-editor").exists()).toBe(true);
  });
});
