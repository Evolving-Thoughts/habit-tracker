import { describe, expect, it } from "vitest";
import { HISTORY_ITEM_FIELDS, PLANNED_FIELDS } from "../types/fixtures";
import type { HistoryWorkLog } from "../types/history";
import {
  DONE_MARK_MINUTES,
  axisHours,
  calendarBlocks,
  clockLabel,
  compactDuration,
  drawnEnd,
  layoutLane,
  logBlocks,
  logLabel,
  minuteOfDay,
  planBlocks,
  resizedEdge,
  wallTime,
} from "./logbook";

const DAY = "2026-11-17";
const log = (overrides: Partial<HistoryWorkLog> = {}): HistoryWorkLog => ({
  id: 1,
  title: "Kapitel 1",
  startedAt: "2026-11-17T08:10:00.000Z",
  endedAt: "2026-11-17T08:35:00.000Z",
  minutes: 25,
  source: "timer",
  todoId: 4,
  occurrenceId: null,
  habitId: null,
  campaign: { id: 2, title: "Buch", color: null, icon: null },
  ...overrides,
});
const block = (key: string, start: number, end: number) => ({
  key,
  start,
  end,
});

describe("minuteOfDay", () => {
  it("reads the Berlin wall clock and clamps to the day", () => {
    expect(minuteOfDay("2026-11-17T08:10:00.000Z", DAY)).toBe(9 * 60 + 10);
    expect(minuteOfDay("2026-11-16T22:30:00.000Z", DAY)).toBe(0);
    expect(minuteOfDay("2026-11-17T23:30:00.000Z", DAY)).toBe(24 * 60);
  });
});

describe("blocks of a day", () => {
  it("cuts a stretch across midnight to the shown day", () => {
    const night = log({
      startedAt: "2026-11-16T22:30:00.000Z",
      endedAt: "2026-11-16T23:45:00.000Z",
    });
    expect(logBlocks({ minutes: 45, logs: [night] }, DAY)).toEqual([
      { key: "log:1", log: night, start: 0, end: 45, minLength: 0 },
    ]);
  });

  it("puts appointments, timed runs and events on the plan, not skipped runs", () => {
    const blocks = planBlocks({
      date: DAY,
      items: [
        {
          ...HISTORY_ITEM_FIELDS,
          type: "todo",
          id: 1,
          habitId: null,
          title: "Zahnarzt",
          status: "completed",
          date: DAY,
          scheduledDate: DAY,
          resolvedAt: null,
          plannedDurationMinutes: 45,
          timeOfDay: "10:00",
          deleted: false,
        },
        {
          ...HISTORY_ITEM_FIELDS,
          type: "habit",
          id: 2,
          habitId: 3,
          title: "Laufen",
          status: "skipped",
          date: DAY,
          scheduledDate: DAY,
          resolvedAt: null,
          plannedDurationMinutes: 20,
          timeOfDay: "07:00",
          deleted: false,
        },
      ],
      planned: [
        {
          ...PLANNED_FIELDS,
          key: "todo:5",
          type: "todo",
          id: 5,
          habitId: null,
          title: "Telefonat",
          date: DAY,
          scheduledDate: DAY,
          isOverdue: false,
          plannedDurationMinutes: null,
          timeOfDay: "16:30",
        },
      ],
      external: [
        {
          id: 9,
          title: "Besprechung",
          start: "2026-11-17T12:00:00.000Z",
          end: "2026-11-17T13:00:00.000Z",
        },
      ],
    });
    expect(blocks.map(({ title, start, end, time }) => [title, start, end, time])).toEqual([
      ["Zahnarzt", 600, 645, "10:00"],
      ["Telefonat", 990, 1020, "16:30"],
      ["Besprechung", 780, 840, "13:00–14:00"],
    ]);
  });
});

describe("completions on the axis", () => {
  const done = (
    id: number,
    resolvedAt: string | null,
    timeOfDay: string | null = null,
    status: "completed" | "skipped" = "completed",
  ) => ({
    ...HISTORY_ITEM_FIELDS,
    type: "todo" as const,
    id,
    habitId: null,
    title: `Quest ${id}`,
    status,
    date: DAY,
    scheduledDate: null,
    resolvedAt,
    plannedDurationMinutes: null,
    timeOfDay,
    deleted: false,
  });

  it("marks the moment an untimed entry was ticked off, not the timed or skipped ones", () => {
    const blocks = planBlocks({
      date: DAY,
      items: [
        // 05:37 in Berlin.
        done(1, "2026-11-17T04:37:00.000Z"),
        done(2, "2026-11-17T09:00:00.000Z", "10:00"),
        done(3, "2026-11-17T07:00:00.000Z", null, "skipped"),
        done(4, null),
      ],
    });
    expect(
      blocks.map(({ key, source, start, end, time }) => [
        key,
        source,
        start,
        end,
        time,
      ]),
    ).toEqual([
      ["item:todo-2", "appointment", 600, 630, "10:00"],
      ["done:todo-1", "done", 337, 337, "05:37"],
    ]);
    expect(blocks[1]!.minLength).toBe(DONE_MARK_MINUTES);
  });

  it("stacks marks of the same moment below each other", () => {
    const blocks = planBlocks({
      date: DAY,
      items: [
        done(1, "2026-11-17T13:58:00.000Z"),
        done(2, "2026-11-17T13:58:00.000Z"),
      ],
    });
    expect(blocks.map(({ start, time }) => [start, time])).toEqual([
      [898, "14:58"],
      [898 + DONE_MARK_MINUTES, "14:58"],
    ]);
    expect(
      layoutLane(blocks).map(({ column, columns }) => [column, columns]),
    ).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("starts the axis at the hour of an early completion", () => {
    const blocks = planBlocks({
      date: DAY,
      items: [done(1, "2026-11-17T04:37:00.000Z")],
    });
    expect(axisHours(blocks)).toEqual({ from: 5, to: 24 });
  });

  it("draws a mark only as long as it is", () => {
    const mark = { key: "m", start: 600, end: 600, minLength: 20 };
    expect(drawnEnd(mark, 40)).toBe(620);
    expect(drawnEnd({ key: "b", start: 600, end: 610 }, 40)).toBe(640);
    // Two marks 25 minutes apart do not need two columns.
    const placed = layoutLane([mark, { ...mark, key: "n", start: 625, end: 625 }], 40);
    expect(placed.map(({ columns }) => columns)).toEqual([1, 1]);
  });
});

describe("layoutLane", () => {
  it("keeps separate blocks in one full-width column", () => {
    const placed = layoutLane([block("a", 60, 120), block("b", 180, 240)], 30);
    expect(placed.map(({ column, columns }) => [column, columns])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("puts overlapping blocks side by side for their whole group", () => {
    const placed = layoutLane(
      [block("a", 60, 180), block("b", 90, 120), block("c", 150, 170)],
      10,
    );
    expect(
      placed.map(({ key, column, columns }) => [key, column, columns]),
    ).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 1, 2],
    ]);
  });

  it("gives a very short block the room it is drawn with", () => {
    const placed = layoutLane([block("a", 60, 62), block("b", 70, 100)], 40);
    expect(placed.map(({ column, columns }) => [column, columns])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });
});

describe("axisHours", () => {
  it("runs from early morning to midnight", () => {
    expect(axisHours([])).toEqual({ from: 6, to: 24 });
    expect(axisHours([block("a", 11 * 60, 12 * 60)], 30)).toEqual({
      from: 6,
      to: 24,
    });
    expect(axisHours([block("a", 23 * 60 + 50, 24 * 60)], 40)).toEqual({
      from: 6,
      to: 24,
    });
  });

  it("starts earlier at the full hour of an earlier entry", () => {
    // A stretch from 05:37 and an appointment until 21:10.
    expect(
      axisHours(
        [block("log", 5 * 60 + 37, 6 * 60), block("plan", 20 * 60, 21 * 60 + 10)],
        30,
      ),
    ).toEqual({ from: 5, to: 24 });
    expect(axisHours([block("a", 30, 60)], 30)).toEqual({ from: 0, to: 24 });
  });
});

describe("calendarBlocks", () => {
  it("puts the plan and the Logbuch on one column, side by side where they overlap", () => {
    const placed = calendarBlocks(
      [{ ...block("plan", 9 * 60, 10 * 60), title: "Teamrunde", time: "09:00", source: "appointment" }],
      logBlocks({ minutes: 25, logs: [log()] }, DAY),
    );
    expect(placed.map((item) => [item.kind, item.column, item.columns])).toEqual([
      ["plan", 0, 2],
      ["log", 1, 2],
    ]);
  });
});

describe("resizing a stretch", () => {
  const stretch = { start: 9 * 60, end: 10 * 60 };

  it("snaps an edge to five minutes", () => {
    expect(resizedEdge("start", 8 * 60 + 47, stretch, 1440)).toBe(8 * 60 + 45);
    expect(resizedEdge("end", 10 * 60 + 13, stretch, 1440)).toBe(10 * 60 + 15);
  });

  it("never lets an edge pass the other one", () => {
    expect(resizedEdge("start", 10 * 60 + 20, stretch, 1440)).toBe(9 * 60 + 55);
    expect(resizedEdge("end", 8 * 60, stretch, 1440)).toBe(9 * 60 + 5);
  });

  it("stays within the day and never reaches past now", () => {
    expect(resizedEdge("start", -40, stretch, 1440)).toBe(0);
    expect(resizedEdge("end", 26 * 60, stretch, 1440)).toBe(1440);
    // Now is 10:32: the end stops there, off the grid if it must.
    expect(resizedEdge("end", 11 * 60, stretch, 10 * 60 + 32)).toBe(10 * 60 + 32);
  });

  it("turns minutes of a day into instants on the Berlin wall clock", () => {
    expect(clockLabel(9 * 60 + 5)).toBe("09:05");
    expect(wallTime(DAY, 9 * 60 + 5)).toBe("2026-11-17T08:05:00.000Z");
    expect(wallTime(DAY, 1440)).toBe("2026-11-17T23:00:00.000Z");
  });
});

describe("labels", () => {
  it("names a stretch fully in words and shortens a total", () => {
    expect(logLabel(log())).toBe(
      "Kapitel 1, 09:10 bis 09:35, 25 Min., Kampagne Buch",
    );
    expect(logLabel(log({ campaign: null }))).toContain("ohne Kampagne");
    expect(compactDuration(135)).toBe("2:15 h");
    expect(compactDuration(45)).toBe("0:45 h");
  });
});
