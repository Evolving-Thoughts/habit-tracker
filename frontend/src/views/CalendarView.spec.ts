import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory } from "../api/history.api";
import { getWorkDay } from "../api/work-logs.api";
import { notifyViewsChanged } from "../composables/data-sync";
import { HISTORY_ITEM_FIELDS, PLANNED_FIELDS } from "../types/fixtures";
import type {
  HistoryItem,
  HistoryPlannedItem,
  HistoryResponse,
} from "../types/history";
import CalendarView from "./CalendarView.vue";

vi.mock("../api/history.api", () => ({ getHistory: vi.fn() }));
vi.mock("../api/day-planner.api", () => ({
  rescheduleTodo: vi.fn(),
  rescheduleOccurrence: vi.fn(),
}));
vi.mock("../api/work-logs.api", () => ({
  getWorkDay: vi.fn(),
}));
vi.mock("../api/reflections.api", () => ({
  getReflection: vi.fn().mockResolvedValue({ date: "", text: "" }),
  saveReflection: vi.fn(),
}));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

const mock = vi.mocked(getHistory);
const TODAY = "2026-10-30";

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
    days: [{ date, items }],
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
  label: "Alle" | "Todos" | "Habits",
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
  vi.mocked(getWorkDay).mockResolvedValue({
    date: "",
    totalMinutes: 0,
    logs: [],
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
    expect(selected.attributes("aria-label")).toBe(
      "30. Oktober, heute, 2 offen",
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

  it("marks forecasts and offers moving only for stored entries", async () => {
    const wrapper = await render();
    const rows = wrapper.findAll(".planned-item");
    expect(rows[0]!.text()).toContain("Saugen");
    expect(rows[0]!.find("button").text()).toBe("Verschieben");
    expect(rows[1]!.text()).toContain("voraussichtlich");
    expect(rows[1]!.find("button").exists()).toBe(false);
  });

  it("opens the move dialog for a planned entry", async () => {
    const wrapper = await render();
    await wrapper.get('[aria-label="Saugen verschieben"]').trigger("click");
    expect(wrapper.text()).toContain("Morgen");
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

  it("offers the filter as one menu that closes on Escape", async () => {
    const wrapper = await render();
    const menuButton = wrapper.get('[aria-haspopup="menu"]');
    expect(menuButton.text()).toBe("Alle");
    expect(menuButton.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    await menuButton.trigger("click");
    await flushPromises();
    expect(menuButton.attributes("aria-expanded")).toBe("true");
    const options = wrapper.findAll('[role="menuitemradio"]');
    expect(options.map((o) => o.text())).toEqual(["Alle", "Todos", "Habits"]);
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
    await chooseFilter(wrapper, "Todos");
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
    expect(parts(rows[0]!)).not.toContain("Todo");
    expect(parts(rows[1]!)).not.toContain("Habit");
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
    mock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
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
    await chooseFilter(wrapper, "Habits");
    const menuButton = wrapper.get('[aria-haspopup="menu"]');
    expect(menuButton.text()).toBe("Habits");
    expect(menuButton.attributes("aria-label")).toBe("Einträge: Habits");
    const empty = wrapper.get(".empty-state");
    expect(empty.text()).toContain("Für diesen Zeitraum gibt es nichts.");
    expect(empty.text()).toContain("Gezeigt werden nur Habits.");
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

  it("lists done, skipped and open entries in that order with counts", async () => {
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
      "Erledigt",
      "Übersprungen",
      "Offen / geplant",
    ]);
    const done = wrapper.get('section[aria-label="Erledigt"]');
    expect(done.findAll("li")).toHaveLength(2);
    expect(done.get(".count").text()).toBe("2");
    expect(
      wrapper.get('section[aria-label="Übersprungen"]').findAll("li"),
    ).toHaveLength(1);
    expect(wrapper.text()).toContain("Gelöscht");
    expect(wrapper.text()).toContain("Aus dem Todo-Dump");
    expect(wrapper.text()).toContain("14:32");
    expect(wrapper.text()).toContain("Geplant für 5. Okt.");
    expect(wrapper.text()).toContain("30 Min. geplant");
    // History rows are a record: nothing to tick.
    expect(done.find("button").exists()).toBe(false);
  });

  it("does not invent an older Habit's completion time", async () => {
    const wrapper = await renderDay(
      dayResponse([item({ type: "habit", resolvedAt: null })]),
    );
    expect(wrapper.text()).not.toContain("Erledigt um");
  });

  it("passes the selected filter and date", async () => {
    const wrapper = await renderDay(dayResponse());
    await wrapper.get('[name="historyDate"]').setValue("2026-10-05");
    await chooseFilter(wrapper, "Habits");
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
    const planned = wrapper.get('section[aria-label="Offen / geplant"]');
    expect(planned.get(".count").text()).toBe("2");
    expect(planned.text()).toContain("noch offen seit 5. Okt.");
    expect(planned.text()).not.toContain("überfällig");
    expect(planned.text()).toContain("15 Min. geplant");
    expect(planned.findAll(".planned-item")[1]!.text()).toContain(
      "voraussichtlich",
    );
    const targets = wrapper.get('section[aria-label="Wochenziele"]').text();
    expect(targets).toContain("Noch 2 von 3 · 1 erledigt");
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
    expect(wrapper.find(".work-time").exists()).toBe(false);
    expect(wrapper.get('[aria-label="Saugen verschieben"]').text()).toBe(
      "Verschieben",
    );
  });

  it("keeps time logging behind a disclosure", async () => {
    const wrapper = await renderDay(dayResponse([item()]));
    const toggle = button(wrapper, "Zeit nachtragen");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find('section[aria-label="Arbeitszeit"]').exists()).toBe(
      false,
    );
    await toggle.trigger("click");
    await flushPromises();
    expect(toggle.attributes("aria-expanded")).toBe("true");
    const logs = wrapper.get('section[aria-label="Arbeitszeit"]');
    expect(logs.find('select[name="target"]').text()).toContain("Artikel");
  });
});

describe("CalendarView week", () => {
  it("renders seven day rows with only the non-zero counts and opens a day", async () => {
    const wrapper = await render();
    mock.mockResolvedValue(weekResponse());
    await wrapper.get('[name="historyDate"]').setValue("2026-10-07");
    await chooseMode(wrapper, "Woche");
    expect(wrapper.get("h1").text()).toBe("5.–11. Okt.");
    const rows = wrapper.findAll(".week-day");
    expect(rows).toHaveLength(7);
    expect(rows[0]!.attributes("aria-label")).toBe("Montag, 5. Okt. öffnen");
    expect(rows[0]!.text()).toContain("Nichts geplant");
    expect(rows[2]!.text()).toContain("1 erledigt · 1 übersprungen");
    await rows[2]!.trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-07",
      "day",
      "all",
      expect.any(AbortSignal),
    );
    expect(button(wrapper, "Tag").attributes("aria-pressed")).toBe("true");
  });

  it("puts the habit quota first and shows the perfect week per category", async () => {
    const wrapper = await render();
    mock.mockResolvedValue({
      ...weekResponse(),
      weekQuota: { completed: 5, total: 8, percentage: 63 },
      perfectWeek: {
        perfect: true,
        categories: [
          { id: 1, name: "Sport", target: 4, completed: 4, reached: true },
        ],
      },
    });
    await chooseMode(wrapper, "Woche");
    const quota = wrapper.get(".quota");
    expect(quota.get(".quota__value").text()).toBe("5 von 8");
    expect(quota.text()).toContain("Habits diese Woche");
    expect(quota.get('[role="progressbar"]').attributes("aria-valuenow")).toBe(
      "5",
    );
    const perfect = wrapper.get(".perfect-week");
    expect(perfect.get("h2").text()).toBe("Perfekte Woche!");
    expect(perfect.text()).toContain("Sport");
    expect(perfect.text()).toContain("4 von 4");
    expect(perfect.text()).toContain("erreicht");
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
    expect(wrapper.text()).toContain("Noch 0 von 3 · 3 erledigt");
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
