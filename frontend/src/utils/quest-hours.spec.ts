import { describe, expect, it } from "vitest";
import { TODO_FIELDS } from "../types/fixtures";
import type { QuestHoursResponse } from "../types/quest-hours";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  againstTarget,
  campaignTiles,
  hoursToMinutes,
  minutesToHours,
  workLine,
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

describe("workLine", () => {
  const hours = (
    todayMinutes: number,
    weekMinutes: number,
    weeklyTargetMinutes: number | null = 1200,
  ) => ({ todayMinutes, weekMinutes, weeklyTargetMinutes });

  it("relates today's quest hours to what was worked, then the week", () => {
    expect(workLine(100, hours(80, 251))).toBe(
      "1 Std. 40 Min. gearbeitet, davon 1 Std. 20 Min. auf Kampagnen · Woche 4 Std. 11 Min. von 20 Std.",
    );
  });

  it("says so when all of today went to campaigns", () => {
    expect(workLine(80, hours(80, 80, null))).toBe(
      "1 Std. 20 Min. gearbeitet, alles auf Kampagnen · Woche 1 Std. 20 Min.",
    );
  });

  it("names the week by what it counts when today had no quest time", () => {
    expect(workLine(40, hours(0, 251))).toBe(
      "40 Min. gearbeitet · Kampagnen diese Woche 4 Std. 11 Min. von 20 Std.",
    );
  });

  it("shows only the week before anything was worked today", () => {
    expect(workLine(0, hours(0, 95, null))).toBe(
      "Kampagnen diese Woche 1 Std. 35 Min.",
    );
    expect(workLine(0, hours(0, 0, 600))).toBe(
      "Kampagnen diese Woche 0 Min. von 10 Std.",
    );
  });

  it("shows only the work without week time and without a goal", () => {
    expect(workLine(25, hours(0, 0, null))).toBe("25 Min. gearbeitet");
  });

  it("says nothing without any time and without a goal", () => {
    expect(workLine(0, hours(0, 0, null))).toBeNull();
  });

  it("never claims more on campaigns than was worked", () => {
    expect(workLine(30, hours(45, 45, null))).toBe(
      "30 Min. gearbeitet, alles auf Kampagnen · Woche 45 Min.",
    );
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
      total: 0,
      percentage: 0,
      knownDurationMinutes: 0,
      todoCount: 0,
      doneCount: 0,
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
