import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory } from "../api/history.api";
import { ApiError, ConnectionError } from "../api/http";
import { deleteWorkLog } from "../api/work-logs.api";
import {
  openRunToday,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { notifyViewsChanged } from "../composables/data-sync";
import { HISTORY_ITEM_FIELDS, PLANNED_FIELDS } from "../types/fixtures";
import type {
  HistoryDayWork,
  HistoryItem,
  HistoryPlannedItem,
  HistoryResponse,
  HistoryWorkLog,
} from "../types/history";
import { createMemoryHistory, createRouter } from "vue-router";
import CalendarView from "./CalendarView.vue";

vi.mock("../api/history.api", () => ({ getHistory: vi.fn() }));
vi.mock("../api/day-planner.api", () => ({
  openRunToday: vi.fn(),
  rescheduleTodo: vi.fn(),
  rescheduleOccurrence: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  updateTodoCompletion: vi.fn(),
}));
vi.mock("../api/work-logs.api", () => ({
  createWorkLog: vi.fn(),
  updateWorkLog: vi.fn(),
  deleteWorkLog: vi.fn(),
}));
vi.mock("../api/day-bests.api", () => ({
  getDayBest: vi.fn().mockResolvedValue({ date: "", text: "" }),
  saveDayBest: vi.fn(),
}));
vi.mock("../api/reflections.api", () => ({
  getReflection: vi.fn().mockResolvedValue({ date: "", text: "" }),
  saveReflection: vi.fn(),
}));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

const mock = vi.mocked(getHistory);
const TODAY = "2026-10-30";
const NO_WORK: HistoryDayWork = { minutes: 0, campaigns: [], logs: [] };

function plannedItem(
  overrides: Partial<HistoryPlannedItem> = {},
): HistoryPlannedItem {
  return {
    ...PLANNED_FIELDS,
    key: "todo:1",
    type: "todo",
    id: 1,
    habitId: null,
    title: "Saugen",
    date: TODAY,
    scheduledDate: TODAY,
    isOverdue: false,
    plannedDurationMinutes: null,
    ...overrides,
  };
}

function item(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    ...HISTORY_ITEM_FIELDS,
    type: "todo",
    id: 1,
    habitId: null,
    title: "Artikel",
    status: "completed",
    date: "2026-10-07",
    scheduledDate: null,
    resolvedAt: "2026-10-07T12:32:00Z",
    plannedDurationMinutes: 30,
    deleted: false,
    ...overrides,
  };
}

const month: HistoryResponse = {
  today: TODAY,
  timeZone: "Europe/Berlin",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  days: Array.from({ length: 31 }, (_, index) => {
    const date = `2026-10-${String(index + 1).padStart(2, "0")}`;
    return {
      date,
      items: date === "2026-10-07" ? [item()] : [],
      planned:
        date === TODAY
          ? [
              plannedItem(),
              plannedItem({
                key: "habit:1:x",
                type: "habit",
                id: null,
                habitId: 3,
                title: "Laufen",
              }),
            ]
          : [],
      work: { minutes: 0 },
    };
  }),
};

function dayResponse(
  items: HistoryItem[] = [],
  date = "2026-10-07",
): HistoryResponse {
  return {
    today: "2026-10-07",
    timeZone: "Europe/Berlin",
    startDate: date,
    endDate: date,
    days: [{ date, items, work: NO_WORK }],
  };
}

function weekResponse(): HistoryResponse {
  return {
    today: "2026-10-07",
    timeZone: "Europe/Berlin",
    startDate: "2026-10-05",
    endDate: "2026-10-11",
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${String(i + 5).padStart(2, "0")}`,
      items:
        i === 2
          ? [
              item(),
              item({
                type: "habit",
                id: 2,
                status: "skipped",
                resolvedAt: null,
              }),
            ]
          : [],
      work: NO_WORK,
    })),
  };
}

async function render() {
  const wrapper = mount(CalendarView, {
    global: { stubs: { ModalDialog: { template: "<div><slot /></div>" } } },
  });
  await flushPromises();
  return wrapper;
}
type Wrapper = Awaited<ReturnType<typeof render>>;

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll("button").find((b) => b.text() === text)!;

async function chooseFilter(
  wrapper: Wrapper,
  label: "Alle" | "Quests" | "Dailies",
) {
  await wrapper.get('[aria-haspopup="menu"]').trigger("click");
  await flushPromises();
  await wrapper
    .findAll('[role="menuitemradio"]')
    .find((b) => b.text() === label)!
    .trigger("click");
  await flushPromises();
}

async function chooseMode(wrapper: Wrapper, label: "Monat" | "Woche" | "Tag") {
  await wrapper
    .findAll(".segmented button")
    .find((b) => b.text() === label)!
    .trigger("click");
  await flushPromises();
}

async function renderDay(response: HistoryResponse) {
  const wrapper = await render();
  mock.mockResolvedValue(response);
  await chooseMode(wrapper, "Tag");
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  mock.mockResolvedValue(month);
});

describe("CalendarView address", () => {
  it("opens the day ?tag= names, then drops it from the address", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/kalender", component: CalendarView }],
    });
    await router.push("/kalender?tag=2026-10-05");
    mount(CalendarView, { global: { plugins: [router] } });
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-05",
      "day",
      "all",
      expect.anything(),
    );
    expect(router.currentRoute.value.fullPath).toBe("/kalender");
  });
});

describe("CalendarView month", () => {
  it("opens on the month with today selected and starts on the right weekday", async () => {
    const wrapper = await render();
    expect(mock).toHaveBeenCalledWith(
      "2026-10-01",
      "month",
      "all",
      expect.anything(),
    );
    expect(wrapper.get("h1").text()).toBe("Oktober 2026");
    expect(button(wrapper, "Monat").attributes("aria-pressed")).toBe("true");
    // 1 October 2026 is a Thursday: three blanks before it.
    expect(wrapper.findAll(".month-grid__blank")).toHaveLength(3);
    expect(wrapper.findAll(".month-day")).toHaveLength(31);
    const selected = wrapper.get('.month-day[aria-pressed="true"]');
    expect(selected.attributes("data-date")).toBe(TODAY);
    expect(selected.classes()).toContain("month-day--today");
    // Counted like Heute counts the day.
    expect(selected.attributes("aria-label")).toBe(
      "30. Oktober, heute, 0 von 2 erledigt",
    );
    expect(selected.findAll(".mark--open")).toHaveLength(1);
  });

  it("names each day in a full sentence and shows calm marks", async () => {
    const wrapper = await render();
    const day = wrapper.get('.month-day[data-date="2026-10-07"]');
    expect(day.attributes("aria-label")).toBe("7. Oktober, 1 erledigt");
    expect(day.findAll(".mark--done")).toHaveLength(1);
    expect(
      wrapper
        .get('.month-day[data-date="2026-10-08"]')
        .attributes("aria-label"),
    ).toBe("8. Oktober, nichts geplant");
    expect(wrapper.get(".legend").text()).toContain("erledigt");
  });

  it("selects a day without a new request", async () => {
    const wrapper = await render();
    const calls = mock.mock.calls.length;
    await wrapper.get('.month-day[data-date="2026-10-07"]').trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenCalledTimes(calls);
    expect(wrapper.get(".selected-day").text()).toContain("Artikel");
    expect(wrapper.get(".selected-day h2").text()).toBe("Mittwoch, 7. Okt.");
  });

  it("gives an open quest the ring, ▶ and its moves in a menu; today's forecast run no moves", async () => {
    const wrapper = await render();
    const rows = wrapper.findAll(".planned-item");
    expect(rows[0]!.text()).toContain("Saugen");
    expect(rows[0]!.find('[aria-label="Saugen erledigen"]').exists()).toBe(
      true,
    );
    expect(rows[0]!.find('[aria-label="Aktionen für Saugen"]').exists()).toBe(
      true,
    );
    // No lone "Verschieben" button any more.
    expect(
      rows[0]!.findAll("button").some((b) => b.text() === "Verschieben"),
    ).toBe(false);
    expect(
      rows[0]!.find('[aria-label="Stoppuhr für Saugen starten"]').exists(),
    ).toBe(true);
    expect(rows[1]!.text()).toContain("voraussichtlich");
    // A Daily run due today can be ticked; moving a forecast is not possible,
    // so its menu only edits it.
    expect(rows[1]!.find(".check-ring").exists()).toBe(true);
    await rows[1]!.get('[aria-haspopup="menu"]').trigger("click");
    expect(
      wrapper
        .findAll("[role=menuitem] .action-menu__label")
        .map((entry) => entry.text()),
    ).toEqual(["Bearbeiten", "Löschen"]);
  });

  it("opens the move dialog for a planned entry from its menu", async () => {
    const wrapper = await render();
    await wrapper.get('[aria-label="Aktionen für Saugen"]').trigger("click");
    expect(
      wrapper
        .findAll("[role=menuitem] .action-menu__label")
        .map((entry) => entry.text()),
    ).toEqual([
      "Morgen",
      "Nächste Woche",
      "Anderer Tag …",
      "Bearbeiten",
      "In Kampagne verschieben …",
      "Löschen",
    ]);
    await wrapper.get('[aria-label="Saugen verschieben"]').trigger("click");
    expect(wrapper.text()).toContain("Nächster Montag");
  });

  it("moves a planned quest to tomorrow in one tap from the menu", async () => {
    const wrapper = await render();
    await wrapper.get('[aria-label="Aktionen für Saugen"]').trigger("click");
    await wrapper.get('[aria-label="Saugen auf morgen"]').trigger("click");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(1, "2026-10-31", false);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("ticks an open quest with the ring and takes it back with the toast", async () => {
    const wrapper = await render();
    await wrapper.get('[aria-label="Saugen erledigen"]').trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
    expect(wrapper.text()).toContain("„Saugen“ erledigt");
    await button(wrapper, "Rückgängig").trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenLastCalledWith(1, false);
  });

  it("opens the editor from a planned title", async () => {
    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          ModalDialog: { template: "<div><slot /></div>" },
          EditItemDialog: {
            props: ["kind", "entityId"],
            template:
              '<div class="editor-stub">{{ kind }} {{ entityId }}</div>',
          },
        },
      },
    });
    await flushPromises();
    await wrapper.get('[aria-label="Saugen bearbeiten"]').trigger("click");
    expect(wrapper.get(".editor-stub").text()).toBe("todo 1");
  });

  it("shows main calendar events read-only on their day", async () => {
    mock.mockResolvedValue({
      ...month,
      days: month.days.map((day) =>
        day.date === TODAY
          ? {
              ...day,
              external: [
                {
                  id: 5,
                  title: "Besprechung",
                  start: "2026-10-30T08:00:00.000Z",
                  end: "2026-10-30T09:00:00.000Z",
                },
              ],
            }
          : day,
      ),
    });
    const wrapper = await render();
    const selected = wrapper.get('.month-day[aria-pressed="true"]');
    expect(selected.attributes("aria-label")).toContain("1 Termin");
    expect(selected.findAll(".mark--event")).toHaveLength(1);
    const entries = wrapper.get(".selected-day").text();
    expect(entries).toContain("Besprechung");
    expect(entries).toContain("Google Kalender");
    expect(entries).toContain("09:00");
  });

  it("marks a day with the app's own appointment in the month", async () => {
    mock.mockResolvedValue({
      ...month,
      days: month.days.map((day) =>
        day.date === TODAY
          ? {
              ...day,
              items: [],
              planned: [plannedItem({ title: "Zahnarzt", timeOfDay: "08:15" })],
            }
          : day,
      ),
    });
    const wrapper = await render();
    const selected = wrapper.get('.month-day[aria-pressed="true"]');
    expect(selected.findAll(".mark--event")).toHaveLength(1);
    expect(selected.findAll(".mark--open")).toHaveLength(1);
    expect(selected.attributes("aria-label")).toContain(
      "0 von 1 erledigt, 1 Termin",
    );
  });

  it("changes the month and selects today when going back", async () => {
    const wrapper = await render();
    await wrapper.get('[aria-label="Nächster Zeitraum"]').trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-11-01",
      "month",
      "all",
      expect.anything(),
    );
    expect(wrapper.get("h1").text()).toBe("November 2026");
    mock.mockResolvedValue(month);
    await wrapper.get('[aria-label="Voriger Zeitraum"]').trigger("click");
    await flushPromises();
    expect(
      wrapper.get('.month-day[aria-pressed="true"]').attributes("data-date"),
    ).toBe(TODAY);
  });

  it("lists a day's quests and Daily runs apart, a done run with its time", async () => {
    mock.mockResolvedValue({
      ...month,
      days: month.days.map((day) =>
        day.date === "2026-10-07"
          ? {
              ...day,
              items: [
                item(),
                item({
                  type: "habit",
                  id: 4,
                  habitId: 3,
                  title: "Laufen",
                  resolvedAt: "2026-10-07T05:15:00Z",
                }),
              ],
            }
          : day,
      ),
    });
    const wrapper = await render();
    // Today: the open run waits under Dailies.
    expect(wrapper.get('.selected-day [aria-label="Dailies"]').text()).toContain(
      "Laufen",
    );
    await wrapper.get('.month-day[data-date="2026-10-07"]').trigger("click");
    const dailies = wrapper.get('.selected-day [aria-label="Dailies"]');
    expect(dailies.get("h3").text()).toBe("Dailies 1");
    expect(dailies.text()).toContain("Erledigt um 07:15");
    expect(
      wrapper.get('.selected-day [aria-label="Quests"]').text(),
    ).toContain("Artikel");
  });

  it("opens the double-clicked date from the month grid", async () => {
    const wrapper = await render();
    await wrapper.get('[data-date="2026-10-05"]').trigger("dblclick");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith("2026-10-05", "day", "all", expect.anything());
  });

  it("opens the selected day in Tag mode", async () => {
    const wrapper = await render();
    await wrapper
      .get('[aria-label="Tag öffnen: Freitag, 30. Okt."]')
      .trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      TODAY,
      "day",
      "all",
      expect.anything(),
    );
    expect(button(wrapper, "Tag").attributes("aria-pressed")).toBe("true");
    expect(wrapper.get("h1").text()).toBe("Freitag, 30. Okt.");
  });
});

describe("CalendarView header", () => {
  it("makes the title a date button that opens the hidden date field", async () => {
    const wrapper = await render();
    const title = wrapper.get("h1 button");
    expect(title.attributes("aria-label")).toBe("Datum wählen, Oktober 2026");
    const input = wrapper.get('input[name="historyDate"]');
    expect(input.classes()).toContain("visually-hidden");
    const picker = vi.fn();
    (input.element as HTMLInputElement).showPicker = picker;
    await title.trigger("click");
    expect(picker).toHaveBeenCalled();
  });

  it("falls back to a click when the browser has no picker", async () => {
    const wrapper = await render();
    const input = wrapper.get('input[name="historyDate"]')
      .element as HTMLInputElement;
    Object.defineProperty(input, "showPicker", { value: undefined });
    const click = vi.spyOn(input, "click");
    await wrapper.get("h1 button").trigger("click");
    expect(click).toHaveBeenCalled();
  });

  it("keeps the head to two rows: title with filter, then mode and steps", async () => {
    const wrapper = await render();
    const rows = wrapper.get("header").element.children;
    const top = wrapper.get(".calendar-view__top");
    expect(top.find("h1 button").exists()).toBe(true);
    expect(top.find('[aria-haspopup="menu"]').exists()).toBe(true);
    const controls = wrapper.get(".calendar-view__controls");
    expect(controls.findAll(".segmented button").map((b) => b.text())).toEqual([
      "Monat",
      "Woche",
      "Tag",
    ]);
    expect(controls.find('[aria-label="Voriger Zeitraum"]').exists()).toBe(true);
    expect(controls.find('[aria-label="Nächster Zeitraum"]').exists()).toBe(true);
    // Two visible rows (the hidden date field is the third child).
    expect(
      Array.from(rows).filter((row) => !row.classList.contains("visually-hidden")),
    ).toHaveLength(2);
  });

  it("offers Heute only away from today and then names the new range", async () => {
    const wrapper = mount(CalendarView, { attachTo: document.body });
    await flushPromises();
    expect(button(wrapper, "Heute")).toBeUndefined();
    await wrapper.get('[aria-label="Nächster Zeitraum"]').trigger("click");
    await flushPromises();
    const today = button(wrapper, "Heute");
    expect(today.exists()).toBe(true);
    await today.trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Oktober 2026");
    expect(button(wrapper, "Heute")).toBeUndefined();
    expect(document.activeElement).toBe(wrapper.get("h1 button").element);
  });

  it("shows the filter as a quiet icon and names a chosen one", async () => {
    const wrapper = await render();
    const menuButton = wrapper.get('[aria-haspopup="menu"]');
    expect(menuButton.text()).toBe("");
    expect(menuButton.attributes("aria-label")).toBe("Einträge: Alle");
    await chooseFilter(wrapper, "Quests");
    expect(menuButton.text()).toBe("Quests");
    expect(menuButton.attributes("aria-label")).toBe("Einträge: Quests");
  });

  it("offers the filter as one menu that closes on Escape", async () => {
    const wrapper = await render();
    const menuButton = wrapper.get('[aria-haspopup="menu"]');
    expect(menuButton.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    await menuButton.trigger("click");
    await flushPromises();
    expect(menuButton.attributes("aria-expanded")).toBe("true");
    const options = wrapper.findAll('[role="menuitemradio"]');
    expect(options.map((o) => o.text())).toEqual(["Alle", "Quests", "Dailies"]);
    expect(options.map((o) => o.attributes("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    await wrapper.get('[role="menu"]').trigger("keydown", { key: "Escape" });
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(menuButton.attributes("aria-expanded")).toBe("false");
  });

  it("requests the chosen filter", async () => {
    const wrapper = await render();
    await chooseFilter(wrapper, "Quests");
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-01",
      "month",
      "todos",
      expect.anything(),
    );
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });
});

describe("CalendarView entries", () => {
  it("shows the category and the why instead of the entry type", async () => {
    const data = dayResponse([
      item({ categoryName: "Gesundheit", why: "Kopf frei" }),
      item({ type: "habit", id: 2, title: "Joggen" }),
    ]);
    data.days[0]!.planned = [
      plannedItem({
        date: "2026-10-07",
        categoryName: "Haushalt",
        why: "Ruhe zuhause",
      }),
    ];
    const wrapper = await renderDay(data);
    const rows = wrapper.findAll(".history-item");
    expect(rows[0]!.get(".history-item__why").text()).toBe("Kopf frei");
    expect(rows[0]!.get(".history-item__category").text()).toBe("Gesundheit");
    expect(rows[0]!.find(".history-item__mark").exists()).toBe(true);
    expect(rows[1]!.find(".history-item__category").exists()).toBe(false);
    expect(rows[1]!.find(".history-item__why").exists()).toBe(false);
    const parts = (row: (typeof rows)[number]) =>
      row.findAll(".history-item__details > span").map((part) => part.text());
    expect(parts(rows[0]!)).not.toContain("Quest");
    expect(parts(rows[1]!)).not.toContain("Daily");
    const planned = wrapper.get(".planned-item");
    expect(planned.get(".planned-item__category").text()).toBe("Haushalt");
    expect(planned.get(".planned-item__why").text()).toBe("Ruhe zuhause");
  });

  it("drops the time column when there is no time", async () => {
    const wrapper = await renderDay(
      dayResponse([
        item(),
        item({
          type: "habit",
          id: 2,
          status: "skipped",
          resolvedAt: null,
        }),
      ]),
    );
    const [done, skipped] = wrapper.findAll(".history-item");
    expect(done!.find(".history-item__time").exists()).toBe(true);
    expect(done!.classes()).not.toContain("history-item--untimed");
    expect(skipped!.find(".history-item__time").exists()).toBe(false);
    expect(skipped!.classes()).toContain("history-item--untimed");
    expect(skipped!.text()).toContain("Übersprungen");
  });
});

describe("CalendarView states", () => {
  it("shows a skeleton while waiting", async () => {
    mock.mockImplementation(() => new Promise(() => {}));
    const wrapper = mount(CalendarView);
    expect(wrapper.get(".skeleton").attributes("aria-label")).toBe(
      "Kalender wird geladen",
    );
  });

  it("reloads in the background when data changes elsewhere", async () => {
    const wrapper = await renderDay(dayResponse());
    mock.mockResolvedValueOnce(dayResponse([item({ title: "Vom Timer" })]));
    notifyViewsChanged();
    expect(wrapper.find(".skeleton").exists()).toBe(false);
    await flushPromises();
    expect(wrapper.text()).toContain("Vom Timer");
  });

  it("shows a failure and retries", async () => {
    mock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));
    const wrapper = await render();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Backend nicht erreichbar",
    );
    await button(wrapper, "Erneut versuchen").trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("explains a lost connection in plain words", async () => {
    // The API layer turns fetch's TypeError into these words (http.ts).
    mock.mockRejectedValueOnce(new ConnectionError());
    const wrapper = await render();
    const alert = wrapper.get('[role="alert"]').text();
    expect(alert).toContain("Keine Verbindung zum Server");
    expect(alert).not.toContain("Failed to fetch");
  });

  it("ignores an older response after a newer selection", async () => {
    let resolve!: (value: HistoryResponse) => void;
    mock.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const wrapper = mount(CalendarView);
    mock.mockResolvedValue(dayResponse());
    await chooseMode(wrapper, "Tag");
    resolve({
      ...month,
      days: month.days.map((day) => ({
        ...day,
        items: [item({ title: "Stale" })],
      })),
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain("Stale");
  });

  it("cancels requests on unmount", () => {
    const wrapper = mount(CalendarView);
    const signal = mock.mock.calls[0]![3]!;
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
  });

  it("handles an empty date without a request or render error", async () => {
    const wrapper = await render();
    const count = mock.mock.calls.length;
    await wrapper.get('[name="historyDate"]').setValue("");
    await flushPromises();
    expect(mock).toHaveBeenCalledTimes(count);
    expect(wrapper.get('[role="alert"]').text()).toContain("gültiges Datum");
    expect(wrapper.get("h1").text()).toBe("Kalender");
  });

  it("respects the filter in the empty state and can show everything again", async () => {
    const wrapper = await renderDay(dayResponse());
    await chooseFilter(wrapper, "Dailies");
    const menuButton = wrapper.get('[aria-haspopup="menu"]');
    expect(menuButton.text()).toBe("Dailies");
    expect(menuButton.attributes("aria-label")).toBe("Einträge: Dailies");
    const empty = wrapper.get(".empty-state");
    expect(empty.text()).toContain("Für diesen Zeitraum gibt es nichts.");
    expect(empty.text()).toContain("Gezeigt werden nur Dailies.");
    await button(wrapper, "Alle zeigen").trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      TODAY,
      "day",
      "all",
      expect.anything(),
    );
  });
});

describe("CalendarView day", () => {
  it("shows an empty state without history actions", async () => {
    const wrapper = await renderDay(dayResponse());
    expect(wrapper.text()).toContain("Für diesen Zeitraum gibt es nichts.");
    expect(wrapper.find("[data-history-key]").exists()).toBe(false);
  });

  it("lists open, done and skipped entries in that order with counts", async () => {
    const data = dayResponse([
      item({ deleted: true }),
      item({
        type: "habit",
        id: 2,
        habitId: 3,
        title: "Joggen",
        scheduledDate: "2026-10-05",
      }),
      item({
        type: "habit",
        id: 3,
        habitId: 4,
        title: "Putzen",
        status: "skipped",
        scheduledDate: "2026-10-07",
        resolvedAt: null,
      }),
    ]);
    data.days[0]!.planned = [plannedItem({ date: "2026-10-07" })];
    const wrapper = await renderDay(data);
    const sections = wrapper.findAll("section[aria-label]");
    expect(sections.map((s) => s.attributes("aria-label"))).toEqual([
      "Offen / geplant",
      "Erledigt",
      "Übersprungen",
    ]);
    const done = wrapper.get('section[aria-label="Erledigt"]');
    expect(done.findAll("li")).toHaveLength(2);
    expect(done.get(".count").text()).toBe("2");
    expect(
      wrapper.get('section[aria-label="Übersprungen"]').findAll("li"),
    ).toHaveLength(1);
    expect(wrapper.text()).toContain("Gelöscht");
    expect(wrapper.text()).toContain("Aus dem Questlog");
    expect(wrapper.text()).toContain("14:32");
    expect(wrapper.text()).toContain("Geplant für 5. Okt.");
    expect(wrapper.text()).toContain("30 Min. geplant");
    // History rows are a record: nothing to tick.
    expect(done.find("button").exists()).toBe(false);
  });

  it("does not invent an older Daily's completion time", async () => {
    const wrapper = await renderDay(
      dayResponse([item({ type: "habit", resolvedAt: null })]),
    );
    expect(wrapper.text()).not.toContain("Erledigt um");
  });

  it("passes the selected filter and date", async () => {
    const wrapper = await renderDay(dayResponse());
    await wrapper.get('[name="historyDate"]').setValue("2026-10-05");
    await chooseFilter(wrapper, "Dailies");
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-05",
      "day",
      "habits",
      expect.any(AbortSignal),
    );
  });

  it("moves one day or seven days and returns to today", async () => {
    const wrapper = await renderDay(dayResponse());
    await wrapper.get('[name="historyDate"]').setValue("2026-10-07");
    await wrapper.get('[aria-label="Voriger Zeitraum"]').trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-06",
      "day",
      "all",
      expect.any(AbortSignal),
    );
    await chooseMode(wrapper, "Woche");
    await wrapper.get('[aria-label="Nächster Zeitraum"]').trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-13",
      "week",
      "all",
      expect.any(AbortSignal),
    );
    await button(wrapper, "Heute").trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      TODAY,
      "week",
      "all",
      expect.any(AbortSignal),
    );
  });

  it("shows open plans and weekly goals calmly, with overdue as an offer", async () => {
    const data = dayResponse();
    data.days[0]!.planned = [
      plannedItem({
        key: "todo:2",
        id: 2,
        title: "Offener Artikel",
        date: "2026-10-07",
        scheduledDate: "2026-10-05",
        isOverdue: true,
        plannedDurationMinutes: 15,
      }),
      plannedItem({
        key: "habit:3:2026-10-07",
        type: "habit",
        id: null,
        habitId: 3,
        title: "Gitarre",
        date: "2026-10-07",
        scheduledDate: "2026-10-07",
      }),
    ];
    data.weeklyTargets = [
      {
        key: "weekly:4",
        habitId: 4,
        title: "Lesen",
        target: 3,
        completed: 1,
        remaining: 2,
        fromDate: "2026-10-07",
        untilDate: "2026-10-11",
      },
    ];
    const wrapper = await renderDay(data);
    // What waits from an earlier day has its own group, like Nachholen.
    const planned = wrapper.get('section[aria-label="Offen / geplant"]');
    expect(planned.get(".count").text()).toBe("1");
    expect(planned.text()).toContain("voraussichtlich");
    const earlier = wrapper.get('section[aria-label="Von früher"]');
    expect(earlier.get(".count").text()).toBe("1");
    expect(earlier.text()).toContain("noch offen seit 5. Okt.");
    expect(earlier.text()).not.toContain("überfällig");
    expect(earlier.text()).toContain("15 Min. geplant");
    const targets = wrapper.get('section[aria-label="Wochenziele"]').text();
    expect(targets).toContain("1 von 3 erledigt · noch 2");
    expect(targets).not.toContain("Gültig");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
  });

  it("offers the reflection as a card and keeps Speichern out of the way until something changed", async () => {
    const wrapper = await renderDay(dayResponse());
    const reflection = wrapper.get("form.day-reflection");
    expect(reflection.classes()).toContain("card");
    expect(reflection.find("button").exists()).toBe(false);
    await reflection.get("textarea").setValue("Gut gelaufen");
    expect(reflection.get("button.btn--primary").text()).toBe("Speichern");
  });

  it("has no reflection or time logging for future days", async () => {
    const future = dayResponse([], "2026-10-09");
    future.days[0]!.planned = [
      plannedItem({ date: "2026-10-09", scheduledDate: "2026-10-09" }),
    ];
    const wrapper = await renderDay(future);
    expect(wrapper.find("form.day-reflection").exists()).toBe(false);
    expect(wrapper.find('select[name="target"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Logbuch");
    await wrapper.get('[aria-label="Aktionen für Saugen"]').trigger("click");
    expect(wrapper.get('[aria-label="Saugen verschieben"]').text()).toBe(
      "Anderer Tag …",
    );
  });

  it("offers time logging in the day calendar beside the list", async () => {
    const wrapper = await renderDay(dayResponse([item()]));
    const logbook = wrapper.get(".calendar-day .day-calendar");
    expect(logbook.get("h2").text()).toBe("Logbuch");
    // The completion stands on the axis at the time it was ticked off.
    // Read as one phrase; the visible title is not read a second time.
    const mark = logbook.get('ol[aria-label="Zeitachse"] .done-mark');
    expect(mark.get(".visually-hidden").text()).toBe(
      "Artikel, erledigt um 14:32",
    );
    expect(
      mark.get(".day-calendar__title-text").attributes("aria-hidden"),
    ).toBe("true");
    expect(logbook.find('select[name="target"]').exists()).toBe(false);
    await button(wrapper, "Zeit nachtragen").trigger("click");
    await flushPromises();
    expect(logbook.find('select[name="target"]').text()).toContain("Artikel");
  });

  it("runs the axis from early morning to midnight on one column", async () => {
    const wrapper = await renderDay(
      dayResponse([item({ resolvedAt: null })]),
    );
    const hours = wrapper
      .findAll(".day-calendar__hours > span:not(.day-calendar__now-time)")
      .map((label) => label.text());
    expect(hours[0]).toBe("06:00");
    expect(hours.at(-1)).toBe("24:00");
    expect(wrapper.findAll(".day-calendar__blocks")).toHaveLength(1);
  });
});

describe("CalendarView week", () => {
  it("renders seven day columns on one hour axis and opens a day from its head", async () => {
    const wrapper = await render();
    mock.mockResolvedValue(weekResponse());
    await wrapper.get('[name="historyDate"]').setValue("2026-10-07");
    await chooseMode(wrapper, "Woche");
    expect(wrapper.get("h1").text()).toBe("5.–11. Okt.");
    const heads = wrapper.findAll(".week-head");
    expect(heads).toHaveLength(7);
    expect(heads[0]!.attributes("aria-label")).toBe("Montag, 5. Okt. öffnen");
    expect(heads[0]!.text()).toContain("Mo");
    expect(heads[0]!.find(".week-head__summary").exists()).toBe(false);
    // What the day holds without a time; the skipped run counts neither way.
    expect(heads[2]!.get(".week-head__summary").text()).toBe("1 Quest");
    const description = heads[2]!.attributes("aria-describedby")!;
    expect(wrapper.get(`[id="${description}"]`).text()).toBe(
      "1 von 1 erledigt · 1 übersprungen",
    );
    expect(heads[2]!.attributes("aria-current")).toBe("date");
    expect(
      wrapper.get('.week-column[data-date="2026-10-07"]').classes(),
    ).toContain("week-column--today");
    expect(wrapper.findAll(".week-column .day-calendar")).toHaveLength(7);
    // One hour axis for all seven columns.
    expect(wrapper.findAll(".day-calendar__hours")).toHaveLength(0);
    expect(wrapper.get(".calendar-week__axis").text()).toContain("06:00");
    await heads[2]!.trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-07",
      "day",
      "all",
      expect.any(AbortSignal),
    );
    expect(button(wrapper, "Tag").attributes("aria-pressed")).toBe("true");
  });

  it("leaves the habit quota and the perfect week to the Wochenrückblick", async () => {
    const wrapper = await render();
    mock.mockResolvedValue({
      ...weekResponse(),
      weekQuota: { completed: 5, total: 8, percentage: 63 },
      perfectWeek: { perfect: true, categories: [] },
    });
    await chooseMode(wrapper, "Woche");
    expect(wrapper.find(".quota").exists()).toBe(false);
    expect(wrapper.find(".perfect-week").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Dailies im Wochensoll");
  });

  it("shows completed weekly targets without inventing open day entries", async () => {
    const wrapper = await render();
    mock.mockResolvedValue({
      ...weekResponse(),
      days: weekResponse().days.map((day) => ({ ...day, items: [] })),
      weeklyTargets: [
        {
          key: "weekly:4",
          habitId: 4,
          title: "Lesen",
          target: 3,
          completed: 3,
          remaining: 0,
          fromDate: "2026-10-07",
          untilDate: "2026-10-11",
        },
      ],
    });
    await chooseMode(wrapper, "Woche");
    expect(wrapper.text()).toContain("3 von 3 erledigt");
    expect(wrapper.text()).not.toContain("noch 0");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    expect(wrapper.findAll(".planned-item")).toHaveLength(0);
  });

  it("shows the empty state for an empty week", async () => {
    const wrapper = await render();
    mock.mockResolvedValue({
      ...weekResponse(),
      days: weekResponse().days.map((day) => ({ ...day, items: [] })),
    });
    await chooseMode(wrapper, "Woche");
    expect(wrapper.get(".empty-state").text()).toContain(
      "Für diesen Zeitraum gibt es nichts.",
    );
  });
});

describe("CalendarView Logbuch", () => {
  const book = { id: 9, title: "Buch", color: null, icon: null };
  function workLog(overrides: Partial<HistoryWorkLog> = {}): HistoryWorkLog {
    return {
      id: 1,
      title: "Kapitel",
      startedAt: "2026-10-07T08:00:00.000Z",
      endedAt: "2026-10-07T08:30:00.000Z",
      minutes: 30,
      source: "timer",
      todoId: 1,
      occurrenceId: null,
      habitId: null,
      campaign: book,
      ...overrides,
    };
  }

  it("draws the plan and the stretches on one column, each named in full", async () => {
    const data = dayResponse([item()]);
    data.days[0]!.external = [
      {
        id: 5,
        title: "Besprechung",
        start: "2026-10-07T06:00:00.000Z",
        end: "2026-10-07T07:00:00.000Z",
      },
    ];
    data.days[0]!.work = {
      minutes: 32,
      campaigns: [
        { campaign: book, minutes: 30 },
        { campaign: null, minutes: 2 },
      ],
      logs: [
        workLog(),
        workLog({
          id: 2,
          title: "Mails",
          startedAt: "2026-10-07T09:00:00.000Z",
          endedAt: "2026-10-07T09:02:00.000Z",
          minutes: 2,
          source: "manual",
          campaign: null,
        }),
      ],
    };
    const wrapper = await renderDay(data);
    const logbook = wrapper.get(".calendar-day .day-calendar");
    expect(logbook.get("h2").text()).toBe("Logbuch 32 Min.");
    const lane = logbook.get('ol[aria-label="Zeitachse"]');
    expect(lane.text()).toContain("Besprechung");
    expect(lane.text()).toContain("08:00–09:00");
    const blocks = lane.findAll("button.log-block");
    expect(blocks.map((block) => block.attributes("aria-label"))).toEqual([
      "Kapitel, 10:00 bis 10:30, 30 Min., Kampagne Buch, korrigieren",
      "Mails, 11:00 bis 11:02, 2 Min., ohne Kampagne, korrigieren",
    ]);
    // The campaign by name beside its stripe, never by colour alone.
    expect(blocks[0]!.text()).toContain("Buch");
    await blocks[0]!.trigger("click");
    await flushPromises();
    expect(
      (logbook.get('input[name="start"]').element as HTMLInputElement).value,
    ).toBe("10:00");
    expect(
      (logbook.get('input[name="end"]').element as HTMLInputElement).value,
    ).toBe("10:30");
  });

  describe("deleting a stretch", () => {
    const twoLogs = () => {
      const data = dayResponse([item()]);
      data.days[0]!.work = {
        minutes: 35,
        campaigns: [{ campaign: book, minutes: 35 }],
        logs: [
          workLog(),
          workLog({
            id: 2,
            title: "Lesen",
            startedAt: "2026-10-07T09:00:00.000Z",
            endedAt: "2026-10-07T09:05:00.000Z",
            minutes: 5,
          }),
        ],
      };
      return data;
    };
    const rows = (wrapper: Wrapper) =>
      wrapper.findAll("button.log-block strong").map((row) => row.text());
    /* Through the block's dialog, the keyboard's way too. */
    const remove = async (wrapper: Wrapper, title: string) => {
      await wrapper
        .findAll("button.log-block")
        .find((block) =>
          block.attributes("aria-label")!.startsWith(`${title},`),
        )!
        .trigger("click");
      await flushPromises();
      await button(wrapper, "Löschen").trigger("click");
    };

    it("takes the stretch out at once and holds the delete behind the toast", async () => {
      const wrapper = await renderDay(twoLogs());
      await remove(wrapper, "Kapitel");
      await flushPromises();
      expect(rows(wrapper)).toEqual(["Lesen"]);
      expect(
        wrapper.findAll("button.log-block").map((block) =>
          block.attributes("aria-label"),
        ),
      ).toEqual(["Lesen, 11:00 bis 11:05, 5 Min., Kampagne Buch, korrigieren"]);
      // The dialog closed with it.
      expect(wrapper.find('input[name="start"]').exists()).toBe(false);
      // The server's total still counts it: no figure rather than a wrong one.
      expect(wrapper.get(".day-calendar__title").text()).toBe("Logbuch");
      expect(wrapper.get(".undo-toast").text()).toContain(
        "Abschnitt „Kapitel“ gelöscht",
      );
      expect(deleteWorkLog).not.toHaveBeenCalled();
    });

    it("brings the stretch back with Rückgängig and never deletes it", async () => {
      const wrapper = await renderDay(twoLogs());
      await remove(wrapper, "Kapitel");
      await flushPromises();
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Rückgängig")!
        .trigger("click");
      await flushPromises();
      expect(rows(wrapper)).toEqual(["Kapitel", "Lesen"]);
      expect(wrapper.get(".day-calendar__title").text()).toBe("Logbuch 35 Min.");
      wrapper.unmount();
      await flushPromises();
      expect(deleteWorkLog).not.toHaveBeenCalled();
    });

    it("deletes when the next offer replaces the toast", async () => {
      vi.mocked(deleteWorkLog).mockResolvedValue();
      const wrapper = await renderDay(twoLogs());
      await remove(wrapper, "Kapitel");
      await flushPromises();
      await remove(wrapper, "Lesen");
      await flushPromises();
      expect(deleteWorkLog).toHaveBeenCalledTimes(1);
      expect(deleteWorkLog).toHaveBeenCalledWith(1);
      expect(wrapper.get(".undo-toast").text()).toContain(
        "Abschnitt „Lesen“ gelöscht",
      );
    });

    it("sends a held delete when the page closes or the view goes", async () => {
      vi.mocked(deleteWorkLog).mockResolvedValue();
      const wrapper = await renderDay(twoLogs());
      await remove(wrapper, "Kapitel");
      window.dispatchEvent(new Event("pagehide"));
      await flushPromises();
      expect(deleteWorkLog).toHaveBeenCalledWith(1);

      await remove(wrapper, "Lesen");
      wrapper.unmount();
      await flushPromises();
      expect(deleteWorkLog).toHaveBeenLastCalledWith(2);
    });

    it("shows the stretch again with the reason when the delete fails", async () => {
      vi.mocked(deleteWorkLog).mockRejectedValueOnce(
        new ApiError(
          "Der Server hatte gerade einen Fehler, die Änderung ist nicht gespeichert.",
          500,
        ),
      );
      const wrapper = await renderDay(twoLogs());
      await remove(wrapper, "Kapitel");
      window.dispatchEvent(new Event("pagehide"));
      await flushPromises();
      expect(rows(wrapper)).toEqual(["Kapitel", "Lesen"]);
      expect(wrapper.get('[role="alert"]').text()).toContain(
        "die Änderung ist nicht gespeichert",
      );
    });

    it("counts a stretch deleted elsewhere as deleted", async () => {
      vi.mocked(deleteWorkLog).mockRejectedValueOnce(
        new ApiError("Work log with ID 1 was not found", 404),
      );
      const wrapper = await renderDay(twoLogs());
      await remove(wrapper, "Kapitel");
      window.dispatchEvent(new Event("pagehide"));
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });

  it("names each day's worked time above its column and draws its stretches", async () => {
    const wrapper = await render();
    const week = weekResponse();
    week.days[2]!.work = {
      minutes: 135,
      campaigns: [
        { campaign: book, minutes: 90 },
        { campaign: null, minutes: 45 },
      ],
      logs: [
        workLog({
          endedAt: "2026-10-07T09:30:00.000Z",
          minutes: 90,
        }),
        workLog({
          id: 2,
          title: "Mails",
          startedAt: "2026-10-07T12:00:00.000Z",
          endedAt: "2026-10-07T12:45:00.000Z",
          minutes: 45,
          campaign: null,
        }),
      ],
    };
    week.days[3]!.work = {
      minutes: 45,
      campaigns: [{ campaign: book, minutes: 45 }],
      logs: [],
    };
    mock.mockResolvedValue(week);
    await chooseMode(wrapper, "Woche");
    const heads = wrapper.findAll(".week-head");
    expect(heads[0]!.find(".week-head__worked").exists()).toBe(false);
    expect(heads[2]!.get(".week-head__worked").text()).toBe("2 Std. 15 Min.");
    const description = heads[2]!.attributes("aria-describedby")!;
    expect(wrapper.get(`[id="${description}"]`).text()).toBe(
      "1 von 1 erledigt · 1 übersprungen, 2 Std. 15 Min. im Logbuch",
    );
    // Nothing planned is not nothing done: the measured time is named once.
    const quiet = heads[3]!.attributes("aria-describedby")!;
    expect(wrapper.get(`[id="${quiet}"]`).text()).toBe(
      "Nichts geplant · 45 Min. gemessen",
    );
    const column = wrapper.get('.week-column[data-date="2026-10-07"]');
    expect(
      column.findAll("button.log-block").map((block) =>
        block.attributes("aria-label"),
      ),
    ).toEqual([
      "Kapitel, 10:00 bis 11:30, 1 Std. 30 Min., Kampagne Buch, korrigieren",
      "Mails, 14:00 bis 14:45, 45 Min., ohne Kampagne, korrigieren",
    ]);
    // The old list of the week is gone.
    expect(wrapper.find(".week-logbook").exists()).toBe(false);
  });

  it("shows a day's worked time quietly in the month", async () => {
    mock.mockResolvedValue({
      ...month,
      days: month.days.map((day) =>
        day.date === "2026-10-07" ? { ...day, work: { minutes: 135 } } : day,
      ),
    });
    const wrapper = await render();
    const cell = wrapper.get('.month-day[data-date="2026-10-07"]');
    expect(cell.attributes("aria-label")).toBe(
      "7. Oktober, 1 erledigt, 2 Std. 15 Min. im Logbuch",
    );
    expect(cell.get(".month-day__work-long").text()).toBe("2 Std. 15 Min.");
    expect(cell.get(".month-day__work-short").text()).toBe("2:15 h");
    expect(
      wrapper.get('.month-day[data-date="2026-10-08"]').find(".month-day__work")
        .exists(),
    ).toBe(false);
  });
});

describe("CalendarView: Daily runs, counting and order of a day", () => {
  const run = (overrides: Partial<HistoryPlannedItem> = {}) =>
    plannedItem({
      key: "habit:4:2026-10-07",
      type: "habit",
      id: 5,
      habitId: 4,
      title: "Lesen",
      date: "2026-10-07",
      scheduledDate: "2026-10-07",
      ...overrides,
    });

  it("ticks today's Daily run in Tag through its occurrence, with undo", async () => {
    const data = dayResponse();
    data.days[0]!.planned = [run()];
    const wrapper = await renderDay(data);
    const row = wrapper.get('[data-focus-key="habit:4:2026-10-07"]');
    expect(row.text()).toContain("Daily");
    await row.get('[aria-label="Lesen erledigen"]').trigger("click");
    await flushPromises();
    expect(updateOccurrenceStatus).toHaveBeenCalledWith(5, "completed");
    expect(openRunToday).not.toHaveBeenCalled();
    expect(wrapper.get(".undo-toast").text()).toContain("„Lesen“ erledigt");
    await button(wrapper, "Rückgängig").trigger("click");
    await flushPromises();
    expect(updateOccurrenceStatus).toHaveBeenLastCalledWith(5, "pending");
  });

  it("finds the stored run of a forecast first, then ticks it", async () => {
    vi.mocked(openRunToday).mockResolvedValue(9);
    const data = dayResponse();
    data.days[0]!.planned = [run({ id: null })];
    const wrapper = await renderDay(data);
    await wrapper.get('[aria-label="Lesen erledigen"]').trigger("click");
    await flushPromises();
    expect(openRunToday).toHaveBeenCalledWith(4, "2026-10-07");
    expect(updateOccurrenceStatus).toHaveBeenCalledWith(9, "completed");
  });

  it("gives a run of a coming day no ring: it is not due yet", async () => {
    const future = dayResponse([], "2026-10-09");
    future.days[0]!.planned = [
      run({ date: "2026-10-09", scheduledDate: "2026-10-09" }),
    ];
    const wrapper = await renderDay(future);
    expect(wrapper.find('[aria-label="Lesen erledigen"]').exists()).toBe(
      false,
    );
  });

  it("counts the day like Heute and keeps the server's order of the day", async () => {
    const data = dayResponse([item({ date: "2026-10-07" })]);
    const open = (id: number, title: string, more = {}) =>
      plannedItem({
        key: `todo:${id}`,
        id,
        title,
        date: "2026-10-07",
        scheduledDate: "2026-10-07",
        ...more,
      });
    // As the server sorts it: appointments by time, then the day's order.
    data.days[0]!.planned = [
      open(3, "Zahnarzt", { timeOfDay: "09:00" }),
      open(4, "Zebra"),
      open(5, "Apfel"),
      open(6, "Alt", { scheduledDate: "2026-10-05", isOverdue: true }),
    ];
    const wrapper = await renderDay(data);
    expect(wrapper.get(".calendar-day__tally").text()).toBe(
      "1 von 4 erledigt · 1 von früher",
    );
    const own = wrapper.get('section[aria-label="Offen / geplant"]');
    expect(own.findAll("h3").map((title) => title.text())).toEqual([
      "Zahnarzt",
      "Zebra",
      "Apfel",
    ]);
  });

  it("names the week's day by the same rule", async () => {
    const wrapper = await render();
    const week = weekResponse();
    week.days[2]!.planned = [
      plannedItem({ date: "2026-10-07", scheduledDate: "2026-10-07" }),
      plannedItem({
        key: "todo:2",
        id: 2,
        date: "2026-10-07",
        scheduledDate: "2026-10-01",
        isOverdue: true,
      }),
    ];
    week.days[3]!.planned = [
      plannedItem({
        key: "todo:3",
        id: 3,
        date: "2026-10-08",
        scheduledDate: "2026-10-08",
      }),
    ];
    mock.mockResolvedValue(week);
    await wrapper.get('[name="historyDate"]').setValue("2026-10-07");
    await chooseMode(wrapper, "Woche");
    const heads = wrapper.findAll(".week-head");
    expect(heads[1]!.find(".week-head__summary").exists()).toBe(false);
    // Without a time, done and open; what waits from earlier is named apart.
    expect(heads[2]!.get(".week-head__summary").text()).toBe(
      "2 Quests · 1 von früher",
    );
    expect(heads[3]!.get(".week-head__summary").text()).toBe("1 Quest");
    const description = heads[2]!.attributes("aria-describedby")!;
    expect(wrapper.get(`[id="${description}"]`).text()).toBe(
      "1 von 2 erledigt · 1 von früher · 1 übersprungen",
    );
  });
});
