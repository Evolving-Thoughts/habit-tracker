import { describe, expect, it } from "vitest";
import { hierarchyTodo } from "../test/hierarchy";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  boardColumns,
  cardDay,
  campaignCards,
  columnLabel,
  columnOf,
  dropAction,
  movedLine,
  type BoardCard,
} from "./campaign-board";

const campaign = hierarchyTodo({ id: 1, title: "Buch" });
const series = hierarchyTodo({ id: 2, title: "Kapitel 1", parentId: 1 });
const inSeries = hierarchyTodo({ id: 3, title: "Entwurf", parentId: 2 });
const loose = hierarchyTodo({ id: 4, title: "Verlag suchen", parentId: 1 });
const otherCampaign = hierarchyTodo({ id: 5, title: "Garten" });
const elsewhere = hierarchyTodo({ id: 6, title: "Beet", parentId: 5 });

const ids = (cards: BoardCard[]) => cards.map((card) => card.todo.id);
const card = (id: number, changes: Partial<HierarchyTodo> = {}): BoardCard => ({
  todo: hierarchyTodo({ id, title: `Quest ${id}`, parentId: 1, ...changes }),
  series: null,
});

describe("columnOf", () => {
  it("puts a done quest in Erledigt, whatever else it says", () => {
    expect(
      columnOf({ completed: true, inProgress: true, scheduledDate: "2026-11-27" }),
    ).toBe("done");
  });

  it("puts an open quest in work in In Arbeit, with or without a day", () => {
    expect(
      columnOf({ completed: false, inProgress: true, scheduledDate: null }),
    ).toBe("working");
    expect(
      columnOf({ completed: false, inProgress: true, scheduledDate: "2026-11-27" }),
    ).toBe("working");
  });

  it("puts the rest in Geplant with a day and in To-Do without one", () => {
    expect(
      columnOf({ completed: false, inProgress: false, scheduledDate: "2026-11-27" }),
    ).toBe("planned");
    expect(
      columnOf({ completed: false, inProgress: false, scheduledDate: null }),
    ).toBe("todo");
  });
});

describe("campaignCards", () => {
  const todos = [campaign, series, inSeries, loose, otherCampaign, elsewhere];

  it("holds only the single quests below the campaign", () => {
    expect(ids(campaignCards(todos, 1))).toEqual([3, 4]);
  });

  it("names the Questreihe a quest belongs to, never the campaign", () => {
    const cards = campaignCards(todos, 1);
    expect(cards[0]!.series).toEqual({ id: 2, title: "Kapitel 1" });
    expect(cards[1]!.series).toBeNull();
  });

  it("has no cards for a campaign without quests", () => {
    expect(campaignCards([campaign], 1)).toEqual([]);
  });
});

describe("boardColumns", () => {
  it("sorts To-Do by the Questlog's order, unknown quests after it", () => {
    const columns = boardColumns([card(10), card(11), card(12)], {
      questlog: [12, 10],
    });
    expect(ids(columns.todo)).toEqual([12, 10, 11]);
  });

  it("keeps the page's order in To-Do without a Questlog order", () => {
    expect(ids(boardColumns([card(11), card(10)]).todo)).toEqual([11, 10]);
  });

  it("sorts Geplant by day, appointments by time before the rest of the day", () => {
    const columns = boardColumns([
      card(10, { scheduledDate: "2026-11-29" }),
      card(11, { scheduledDate: "2026-11-28" }),
      card(12, { scheduledDate: "2026-11-28", timeOfDay: "13:00" }),
      card(13, { scheduledDate: "2026-11-28", timeOfDay: "09:30" }),
    ]);
    expect(ids(columns.planned)).toEqual([13, 12, 11, 10]);
  });

  it("puts the quest the stopwatch is on first in In Arbeit", () => {
    const columns = boardColumns(
      [
        card(10, { inProgress: true }),
        card(11, { inProgress: true }),
        card(12, { inProgress: true }),
      ],
      { active: 12 },
    );
    expect(ids(columns.working)).toEqual([12, 10, 11]);
  });

  it("sorts Erledigt by the newest completion first", () => {
    const columns = boardColumns([
      card(10, { completed: true, completedAt: "2026-11-20T10:00:00.000Z" }),
      card(11, { completed: true, completedAt: "2026-11-26T08:00:00.000Z" }),
      card(12, { completed: true, completedAt: null }),
    ]);
    expect(ids(columns.done)).toEqual([11, 10, 12]);
  });

  it("puts each card in exactly one column", () => {
    const columns = boardColumns([
      card(10),
      card(11, { scheduledDate: "2026-11-27" }),
      card(12, { inProgress: true }),
      card(13, { completed: true }),
    ]);
    expect(ids(columns.todo)).toEqual([10]);
    expect(ids(columns.planned)).toEqual([11]);
    expect(ids(columns.working)).toEqual([12]);
    expect(ids(columns.done)).toEqual([13]);
  });
});

describe("dropAction", () => {
  it("does nothing within a column", () => {
    for (const column of ["todo", "planned", "working", "done"] as const)
      expect(dropAction(column, column)).toBeNull();
  });

  it("takes a quest into In Arbeit by hand, opening a done one first", () => {
    expect(dropAction("todo", "working")).toEqual({ kind: "start", reopen: false });
    expect(dropAction("planned", "working")).toEqual({ kind: "start", reopen: false });
    expect(dropAction("done", "working")).toEqual({ kind: "start", reopen: true });
  });

  it("asks the day for Geplant and takes it away for To-Do", () => {
    expect(dropAction("todo", "planned")).toEqual({
      kind: "plan",
      reopen: false,
      setAside: false,
    });
    expect(dropAction("planned", "todo")).toEqual({
      kind: "unplan",
      reopen: false,
      setAside: false,
    });
  });

  it("completes whatever lands in Erledigt, In Arbeit included", () => {
    expect(dropAction("todo", "done")).toEqual({ kind: "complete" });
    expect(dropAction("planned", "done")).toEqual({ kind: "complete" });
    expect(dropAction("working", "done")).toEqual({ kind: "complete" });
  });

  it("reopens what leaves Erledigt", () => {
    expect(dropAction("done", "todo")).toEqual({
      kind: "unplan",
      reopen: true,
      setAside: false,
    });
    expect(dropAction("done", "planned")).toEqual({
      kind: "plan",
      reopen: true,
      setAside: false,
    });
  });

  it("sets aside what leaves In Arbeit for To-Do or Geplant", () => {
    expect(dropAction("working", "todo")).toEqual({
      kind: "unplan",
      reopen: false,
      setAside: true,
    });
    expect(dropAction("working", "planned")).toEqual({
      kind: "plan",
      reopen: false,
      setAside: true,
    });
  });
});

describe("words", () => {
  it("says where a card stands now", () => {
    expect(movedLine("Entwurf", "planned")).toBe(
      "„Entwurf“ steht jetzt in Geplant.",
    );
  });

  it("names a column with its count", () => {
    expect(columnLabel("todo", 1)).toBe("To-Do, 1 Quest");
    expect(columnLabel("done", 3)).toBe("Erledigt, 3 Quests");
  });
});

describe("cardDay", () => {
  const today = "2026-11-27";

  it("says today and tomorrow in words", () => {
    expect(cardDay(today, null, today)).toBe("Heute");
    expect(cardDay("2026-11-28", null, today)).toBe("Morgen");
  });

  it("gives a later day its date and an earlier one its start", () => {
    expect(cardDay("2026-12-03", null, today)).toBe("3. Dez.");
    expect(cardDay("2026-11-20", null, today)).toBe("seit 20. Nov.");
  });

  it("adds an appointment's time, and says nothing without a day", () => {
    expect(cardDay(today, "13:00", today)).toBe("Heute, 13:00 Uhr");
    expect(cardDay(null, null, today)).toBeNull();
  });
});
