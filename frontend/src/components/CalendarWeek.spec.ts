import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryResponse } from "../types/history";
import CalendarWeek from "./CalendarWeek.vue";

enableAutoUnmount(afterEach);

const NO_WORK = { minutes: 0, logs: [] } as unknown as HistoryResponse["days"][number]["work"];

function week(today: string): HistoryResponse {
  return {
    today,
    timeZone: "Europe/Berlin",
    startDate: "2026-10-05",
    endDate: "2026-10-11",
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${String(i + 5).padStart(2, "0")}`,
      items: [],
      work: NO_WORK,
    })),
    weeklyTargets: [
      {
        key: "weekly:4",
        habitId: 4,
        title: "Lesen",
        target: 4,
        completed: 2,
        remaining: 2,
        fromDate: "2026-10-05",
        untilDate: "2026-10-11",
      },
    ],
  } as HistoryResponse;
}

/*
 * A phone's layout, which jsdom lacks: the hours 48px, each day 120px, the
 * board 375px wide. Only the sideways scroll is looked at.
 */
const HOURS = 48;
const COLUMN = 120;
const scrolled = new WeakMap<Element, number>();
beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    const left = (x: number, width: number) =>
      ({ left: x, width, right: x + width, top: 0, bottom: 0, height: 0 }) as DOMRect;
    if (this.classList.contains("calendar-week__corner")) return left(0, HOURS);
    const date = this.getAttribute("data-date");
    if (this.classList.contains("week-head") && date) {
      const index = Number(date.slice(8, 10)) - 5;
      const board = this.parentElement!;
      return left(HOURS + index * COLUMN - (scrolled.get(board) ?? 0), COLUMN);
    }
    return left(0, 375);
  });
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
    configurable: true,
    get(this: Element) {
      return scrolled.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      scrolled.set(this, value);
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => HOURS + 7 * COLUMN,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 375,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ["scrollLeft", "scrollWidth", "clientWidth"])
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
});

function mountWeek(today: string) {
  return mount(CalendarWeek, {
    props: {
      result: week(today),
      filter: "all",
      filterLabel: "Alle",
      reload: async () => {},
    },
    global: { stubs: { DayCalendar: true } },
  });
}

describe("CalendarWeek", () => {
  it("starts the current week with today beside the hours on a phone", async () => {
    const wrapper = mountWeek("2026-10-07");
    await flushPromises();
    const board = wrapper.get(".calendar-week").element as HTMLElement;
    // Monday and Tuesday scroll out of view; Wednesday comes first.
    expect(board.scrollLeft).toBe(2 * COLUMN);
  });

  it("names today in words in its head, the first column on a phone", async () => {
    const wrapper = mountWeek("2026-10-07");
    await flushPromises();
    const heads = wrapper.findAll(".week-head");
    expect(heads[2]!.get(".week-head__today").text()).toBe("Heute");
    expect(heads[2]!.attributes("aria-current")).toBe("date");
    expect(wrapper.findAll(".week-head__today")).toHaveLength(1);
  });

  it("starts any other week with Monday", async () => {
    const wrapper = mountWeek("2026-10-20");
    await flushPromises();
    expect((wrapper.get(".calendar-week").element as HTMLElement).scrollLeft).toBe(0);
  });

  it("names a weekly target's done runs first, then what is left", async () => {
    const wrapper = mountWeek("2026-10-07");
    await flushPromises();
    expect(wrapper.get('section[aria-label="Wochenziele"] .count').text()).toBe(
      "2 von 4 erledigt · noch 2",
    );
  });
});
