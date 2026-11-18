import { describe, expect, it } from "vitest";
import { HISTORY_ITEM_FIELDS, PLANNED_FIELDS } from "../types/fixtures";
import type { HistoryWorkLog } from "../types/history";
import {
  axisHours,
  compactDuration,
  layoutLane,
  logBlocks,
  logLabel,
  minuteOfDay,
  planBlocks,
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
      { key: "log:1", log: night, start: 0, end: 45 },
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
  it("shows 8 to 18 and widens to every block", () => {
    expect(axisHours([])).toEqual({ from: 8, to: 18 });
    expect(axisHours([block("a", 6 * 60 + 30, 7 * 60)], 30)).toEqual({
      from: 6,
      to: 18,
    });
    expect(axisHours([block("a", 23 * 60 + 50, 24 * 60)], 40)).toEqual({
      from: 8,
      to: 24,
    });
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
