import { describe, expect, it } from "vitest";
import { TODO_FIELDS } from "../types/fixtures";
import type { QuestHoursResponse } from "../types/quest-hours";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  againstTarget,
  campaignTiles,
  hoursToMinutes,
  minutesToHours,
  questHoursLine,
  trendText,
} from "./quest-hours";

describe("hoursToMinutes", () => {
  it.each([
    ["", null],
    ["  ", null],
    ["1", 60],
    ["3.5", 210],
    ["3,5", 210],
    [0.5, 30],
    ["100", 6000],
  ])("reads %p as %p minutes", (value, minutes) => {
    expect(hoursToMinutes(value)).toBe(minutes);
  });

  it.each(["0", "0.25", "2.75", "100.5", "-1", "abc", "1e3"])(
    "rejects %p",
    (value) => {
      expect(() => hoursToMinutes(value)).toThrow("halben Stunden");
    },
  );
});

describe("minutesToHours", () => {
  it("shows stored minutes as hours, nothing without a goal", () => {
    expect(minutesToHours(null)).toBe("");
    expect(minutesToHours(210)).toBe("3.5");
    expect(minutesToHours(6000)).toBe("100");
  });
});

describe("againstTarget", () => {
  it("speaks of the goal only when there is one", () => {
    expect(againstTarget(210, 360)).toBe("3 Std. 30 Min. von 6 Std.");
    expect(againstTarget(45, null)).toBe("45 Min.");
    // More than the goal is just a bigger number.
    expect(againstTarget(400, 360)).toBe("6 Std. 40 Min. von 6 Std.");
  });
});

describe("questHoursLine", () => {
  it("names today and the week against the goal", () => {
    expect(
      questHoursLine({
        todayMinutes: 80,
        weekMinutes: 360,
        weeklyTargetMinutes: 1200,
      }),
    ).toBe("Quest-Stunden heute 1 Std. 20 Min. · Woche 6 Std. von 20 Std.");
  });

  it("shows just the numbers without a goal", () => {
    expect(
      questHoursLine({
        todayMinutes: 0,
        weekMinutes: 95,
        weeklyTargetMinutes: null,
      }),
    ).toBe("Quest-Stunden heute 0 Min. · Woche 1 Std. 35 Min.");
  });

  it("shows a goal before any time is measured", () => {
    expect(
      questHoursLine({
        todayMinutes: 0,
        weekMinutes: 0,
        weeklyTargetMinutes: 600,
      }),
    ).toBe("Quest-Stunden heute 0 Min. · Woche 0 Min. von 10 Std.");
  });

  it("says nothing without measured quest time and without a goal", () => {
    expect(
      questHoursLine({
        todayMinutes: 0,
        weekMinutes: 0,
        weeklyTargetMinutes: null,
      }),
    ).toBeNull();
  });
});

describe("campaignTiles", () => {
  const todo = (
    id: number,
    parentId: number | null,
    changes: Partial<HierarchyTodo> = {},
  ): HierarchyTodo => ({
    ...TODO_FIELDS,
    id,
    parentId,
    title: `Quest ${id}`,
    completed: false,
    completedAt: null,
    scheduledDate: null,
    timeOfDay: null,
    plannedDurationMinutes: null,
    timerEligible: true,
    progress: {
      mode: "count",
      completed: 0,
      total: 1,
      percentage: 0,
      knownDurationMinutes: 0,
      todoCount: 1,
    },
    ...changes,
  });
  const hours = (campaigns: QuestHoursResponse["campaigns"]) =>
    ({
      weeks: Array.from({ length: 8 }, (_, index) => ({
        startDate: `2026-10-0${index + 1}`,
        questMinutes: 0,
      })),
      campaigns,
    }) as QuestHoursResponse;

  it("makes a tile of every campaign and none of a loose quest", () => {
    const tiles = campaignTiles(
      [
        todo(1, null),
        todo(2, 1),
        todo(3, null, { color: "moss" }),
        todo(4, null, { weeklyTargetMinutes: 60 }),
        todo(5, null),
        todo(6, null),
      ],
      hours([
        {
          // A lone goal counting a daily: the server counts it.
          campaign: { id: 6, title: "Quest 6", color: null, icon: null },
          minutes: 30,
          weeklyTargetMinutes: null,
          weeks: [0, 0, 0, 0, 0, 0, 0, 30],
          totalMinutes: 30,
        },
      ]),
    );
    expect(tiles.map((tile) => tile.todo.id)).toEqual([1, 3, 4, 6]);
    expect(tiles[0]).toMatchObject({
      minutes: 0,
      weeks: [0, 0, 0, 0, 0, 0, 0, 0],
      totalMinutes: 0,
    });
    expect(tiles[3]).toMatchObject({ minutes: 30, totalMinutes: 30 });
  });

  it("drops a colour or icon key it does not know", () => {
    const [tile] = campaignTiles(
      [todo(1, null, { color: "orange", icon: "book" })],
      null,
    );
    expect(tile).toMatchObject({ color: null, icon: "book", weeks: [] });
  });
});

describe("trendText", () => {
  it("names every week and its time", () => {
    expect(
      trendText([0, 90], ["2026-11-09", "2026-11-16"], (date) => date.slice(5)),
    ).toBe(
      "Quest-Stunden der letzten 2 Wochen. Woche ab 11-09: 0 Min., Woche ab 11-16: 1 Std. 30 Min.",
    );
  });
});
