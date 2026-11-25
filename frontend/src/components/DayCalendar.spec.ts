import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateWorkLog } from "../api/work-logs.api";
import { HISTORY_ITEM_FIELDS } from "../types/fixtures";
import type { HistoryResponse, HistoryWorkLog } from "../types/history";
import DayCalendar from "./DayCalendar.vue";

vi.mock("../api/work-logs.api", () => ({
  createWorkLog: vi.fn(),
  updateWorkLog: vi.fn(),
  deleteWorkLog: vi.fn(),
}));
enableAutoUnmount(afterEach);

type Day = HistoryResponse["days"][number];
const DATE = "2026-10-07";
/* Without layout, a pixel of the axis is 60 / (4rem × 16px) minutes. */
const PX_PER_MINUTE = (4 * 16) / 60;

const log = (overrides: Partial<HistoryWorkLog> = {}): HistoryWorkLog => ({
  id: 1,
  title: "Kapitel",
  // 10:00–10:30 in Berlin (summer time).
  startedAt: "2026-10-07T08:00:00.000Z",
  endedAt: "2026-10-07T08:30:00.000Z",
  minutes: 30,
  source: "timer",
  todoId: 4,
  occurrenceId: null,
  habitId: null,
  campaign: { id: 9, title: "Buch", color: null, icon: null },
  ...overrides,
});

function day(overrides: Partial<Day> = {}): Day {
  return {
    date: DATE,
    items: [
      {
        ...HISTORY_ITEM_FIELDS,
        type: "todo",
        id: 4,
        habitId: null,
        title: "Kapitel",
        status: "completed",
        date: DATE,
        scheduledDate: DATE,
        resolvedAt: "2026-10-07T09:00:00.000Z",
        plannedDurationMinutes: null,
        timeOfDay: null,
        deleted: false,
      },
    ],
    work: { minutes: 30, campaigns: [], logs: [log()] },
    ...overrides,
  };
}

const reload = vi.fn(() => Promise.resolve());

function render(props: Partial<InstanceType<typeof DayCalendar>["$props"]> = {}) {
  return mount(DayCalendar, {
    attachTo: document.body,
    props: { day: day(), today: DATE, reload, ...props },
    global: { stubs: { ModalDialog: { template: "<div><slot /></div>" } } },
  });
}
type Wrapper = ReturnType<typeof render>;

const block = (wrapper: Wrapper) => wrapper.get("button.log-block");
async function drag(
  wrapper: Wrapper,
  edge: "start" | "end",
  minutes: number,
  finish: "up" | "escape" = "up",
) {
  const handle = wrapper.get(`.log-handle--${edge}`);
  await handle.trigger("pointerdown", { button: 0, pointerId: 1, clientY: 100 });
  await handle.trigger("pointermove", {
    pointerId: 1,
    clientY: 100 + minutes * PX_PER_MINUTE,
  });
  if (finish === "escape")
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  else await handle.trigger("pointerup", { pointerId: 1 });
  await flushPromises();
}

describe("DayCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 14:00 in Berlin.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    vi.mocked(updateWorkLog).mockResolvedValue(undefined as never);
  });
  afterEach(() => vi.useRealTimers());

  it("draws the plan, completions and the Logbuch on one column with a Jetzt line", () => {
    const wrapper = render({
      day: day({
        external: [
          {
            id: 5,
            title: "Besprechung",
            start: "2026-10-07T06:00:00.000Z",
            end: "2026-10-07T07:00:00.000Z",
          },
        ],
      }),
    });
    const lane = wrapper.get('ol[aria-label="Zeitachse"]');
    expect(lane.findAll("li")).toHaveLength(2);
    expect(lane.text()).toContain("Besprechung");
    expect(lane.text()).not.toContain("Kapitel, erledigt um 11:00");
    expect(block(wrapper).attributes("aria-label")).toBe(
      "Kapitel, 10:00 bis 10:30, 30 Min., Kampagne Buch, korrigieren",
    );
    expect(wrapper.get("h2").text()).toBe("Logbuch 30 Min.");
    expect(wrapper.find(".day-calendar__now").exists()).toBe(true);
    expect(wrapper.get(".day-calendar__now-time").text()).toBe("14:00");
  });

  it("shows the completion while the delete of its only stretch is held back", () => {
    const wrapper = render({ hiddenLogs: new Set([1]) });
    const lane = wrapper.get('ol[aria-label="Zeitachse"]');
    expect(wrapper.find("button.log-block").exists()).toBe(false);
    expect(lane.text()).toContain("Kapitel, erledigt um 11:00");
  });

  it("shows no Jetzt line on another day and only appointments on a coming one", () => {
    const wrapper = render({ day: day({ date: "2026-10-09", items: [] }) });
    expect(wrapper.find(".day-calendar__now").exists()).toBe(false);
    expect(wrapper.get("h2").text()).toBe("Termine");
    expect(wrapper.find("button.log-block").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Zeit nachtragen");
  });

  it("resizes a stretch by its bottom edge on a 5-minute grid and saves it", async () => {
    const wrapper = render();
    const handle = wrapper.get(".log-handle--end");
    await handle.trigger("pointerdown", { button: 0, pointerId: 1, clientY: 100 });
    // 32 minutes down snap to 30; the block says its new time while it moves.
    await handle.trigger("pointermove", {
      pointerId: 1,
      clientY: 100 + 32 * PX_PER_MINUTE,
    });
    expect(block(wrapper).text()).toContain("10:00–11:00");
    expect(updateWorkLog).not.toHaveBeenCalled();
    await handle.trigger("pointerup", { pointerId: 1 });
    await flushPromises();
    expect(updateWorkLog).toHaveBeenCalledWith(1, {
      startedAt: "2026-10-07T08:00:00.000Z",
      endedAt: "2026-10-07T09:00:00.000Z",
    });
    expect(reload).toHaveBeenCalledWith(false);
    expect(wrapper.get('[role="status"]').text()).toBe(
      "„Kapitel“ geht jetzt von 10:00 bis 11:00.",
    );
  });

  it("moves the start by the top edge, never past the end", async () => {
    const wrapper = render();
    await drag(wrapper, "start", -17);
    expect(updateWorkLog).toHaveBeenLastCalledWith(1, {
      startedAt: "2026-10-07T07:45:00.000Z",
      endedAt: "2026-10-07T08:30:00.000Z",
    });
    await drag(wrapper, "start", 90);
    expect(updateWorkLog).toHaveBeenLastCalledWith(1, {
      startedAt: "2026-10-07T08:25:00.000Z",
      endedAt: "2026-10-07T08:30:00.000Z",
    });
  });

  it("never stretches into the future", async () => {
    const wrapper = render();
    await drag(wrapper, "end", 10 * 60);
    expect(updateWorkLog).toHaveBeenCalledWith(1, {
      startedAt: "2026-10-07T08:00:00.000Z",
      endedAt: "2026-10-07T12:00:00.000Z",
    });
  });

  it("cancels a drag with Escape", async () => {
    const wrapper = render();
    await drag(wrapper, "end", 30, "escape");
    expect(block(wrapper).text()).toContain("10:00–10:30");
    await wrapper
      .get(".log-handle--end")
      .trigger("pointerup", { pointerId: 1 });
    await flushPromises();
    expect(updateWorkLog).not.toHaveBeenCalled();
  });

  it("keeps the edge of a stretch that began the day before", () => {
    const wrapper = render({
      day: day({
        work: {
          minutes: 30,
          logs: [log({ startedAt: "2026-10-06T21:30:00.000Z" })],
        },
      }),
    });
    expect(wrapper.find(".log-handle--start").exists()).toBe(false);
    expect(wrapper.find(".log-handle--end").exists()).toBe(true);
  });

  it("opens a stretch to correct it, and hands its delete to the host", async () => {
    const wrapper = render();
    await block(wrapper).trigger("click");
    await flushPromises();
    expect(
      (wrapper.get('input[name="start"]').element as HTMLInputElement).value,
    ).toBe("10:00");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Löschen")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.emitted("removeLog")).toEqual([[log()]]);
    expect(wrapper.find('input[name="start"]').exists()).toBe(false);
  });

  it("adds time from the head or from a tap on empty time", async () => {
    const wrapper = render();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Zeit nachtragen")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get('select[name="target"]').text()).toContain("Kapitel");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Abbrechen")!
      .trigger("click");
    await flushPromises();

    // A tap 2 hours and 10 minutes below 06:00 starts at the quarter hour.
    await wrapper
      .get(".day-calendar__lane")
      .trigger("click", { clientY: 130 * PX_PER_MINUTE });
    await flushPromises();
    const value = (name: string) =>
      (wrapper.get(`input[name="${name}"]`).element as HTMLInputElement).value;
    expect([value("from"), value("to")]).toEqual(["08:00", "08:30"]);
  });

  describe("short stretches", () => {
    /* Stretches from 10:00 Berlin, each `minutes` long, one after the other. */
    const run = (...lengths: number[]) => {
      let at = Date.parse("2026-10-07T08:00:00.000Z");
      return lengths.map((minutes, index) => {
        const startedAt = new Date(at).toISOString();
        at += minutes * 60_000;
        return log({
          id: index + 1,
          title: `Abschnitt ${index + 1}`,
          startedAt,
          endedAt: new Date(at).toISOString(),
          minutes,
        });
      });
    };
    /* What a block reads: its title, then its times or its length. */
    const words = (element: Pick<Wrapper, "findAll">) =>
      element
        .findAll(".day-calendar__title-text, .day-calendar__meta")
        .map((part) => part.text().replace(/\s+/g, " "))
        .join(" ");
    const slots = (wrapper: Wrapper) =>
      wrapper.findAll("li.day-calendar__slot--log").map((slot) => ({
        mode: slot.classes("day-calendar__slot--chip")
          ? "chip"
          : slot.classes("day-calendar__slot--line")
            ? "line"
            : "full",
        text: words(slot),
        style: slot.attributes("style"),
      }));

    it("name themselves on one line under half an hour, title and times above", () => {
      const wrapper = render({
        day: day({ work: { minutes: 90, logs: run(45, 25, 5) } }),
      });
      expect(slots(wrapper).map(({ mode, text }) => [mode, text])).toEqual([
        ["full", "Abschnitt 1 10:00–10:45"],
        ["line", "Abschnitt 2 · 25 Min."],
        ["chip", "Abschnitt 3 · 5 Min."],
      ]);
      // The whole stretch is always there for the pointer and screen readers.
      const short = wrapper.findAll("button.log-block")[2]!;
      expect(short.attributes("title")).toBe(
        "Abschnitt 3, 11:10 bis 11:15, 5 Min., Kampagne Buch",
      );
      expect(short.attributes("aria-label")).toBe(
        "Abschnitt 3, 11:10 bis 11:15, 5 Min., Kampagne Buch, korrigieren",
      );
    });

    it("stand side by side when they follow each other, each a line high", () => {
      const wrapper = render({
        day: day({ work: { minutes: 18, logs: run(3, 5, 10) } }),
      });
      const placed = slots(wrapper);
      expect(placed.map(({ mode }) => mode)).toEqual(["chip", "chip", "chip"]);
      expect(placed.map(({ style }) => style)).toEqual([
        expect.stringContaining("--column: 0; --columns: 3"),
        expect.stringContaining("--column: 1; --columns: 3"),
        expect.stringContaining("--column: 2; --columns: 3"),
      ]);
      // Sharing the width, the title alone tells them apart.
      expect(placed.map(({ text }) => text)).toEqual([
        "Abschnitt 1",
        "Abschnitt 2",
        "Abschnitt 3",
      ]);
      // The real length stays on the axis for the gauge: 3 minutes are 3.
      expect(placed[0]!.style).toContain("--length: 3");
    });

    it("leave the length out in a column of the week, but say the times while dragged", async () => {
      const wrapper = render({
        compact: true,
        day: day({ work: { minutes: 25, logs: run(25) } }),
      });
      expect(block(wrapper).text()).toBe("Abschnitt 1");
      const handle = wrapper.get(".log-handle--end");
      await handle.trigger("pointerdown", {
        button: 0,
        pointerId: 1,
        clientY: 100,
      });
      await handle.trigger("pointermove", {
        pointerId: 1,
        clientY: 100 - 10 * PX_PER_MINUTE,
      });
      // Now 15 minutes: drawn a line high, the handles at its sides.
      expect(wrapper.get("li").classes()).toContain("day-calendar__slot--chip");
      expect(words(block(wrapper))).toBe("Abschnitt 1 · 10:00–10:15");
    });
  });

  it("lays out a column of the week without its own head or hour labels", () => {
    const wrapper = render({ compact: true, hours: { from: 5, to: 24 } });
    expect(wrapper.find("h2").exists()).toBe(false);
    expect(wrapper.find(".day-calendar__hours").exists()).toBe(false);
    expect(wrapper.attributes("aria-label")).toBe("Mittwoch, 7. Okt.");
    expect(wrapper.attributes("style")).toContain("--from: 5");
  });
});
