import { describe, expect, it } from "vitest";
import { hierarchyTodo } from "../test/hierarchy";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  BOARD_COLUMNS,
  boardColumns,
  cardDay,
  campaignCards,
  columnLabel,
  columnOf,
  dropAction,
  landedLine,
  movedGroupLine,
  movedLine,
  planBoardMove,
  travelLabel,
  type BoardCard,
  type BoardColumn,
  type FinishedMove,
  type MoveAnswers,
  type MoveRequest,
  type PlannedStep,
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

describe("group words", () => {
  it("says how many moved together, and how many made it", () => {
    expect(movedGroupLine(3, 3, "planned")).toBe(
      "3 Quests stehen jetzt in Geplant.",
    );
    expect(movedGroupLine(2, 3, "working")).toBe(
      "2 von 3 Quests stehen jetzt in In Arbeit.",
    );
    expect(movedGroupLine(0, 3, "todo")).toBe("");
  });

  it("names how many cards travel with the carried one", () => {
    expect(travelLabel(3)).toBe("3 Karten");
  });
});

describe("planBoardMove", () => {
  const NOW = "2026-11-27T10:00:00.000Z";
  const DAY = "2026-11-28";
  const inColumn: Record<BoardColumn, BoardCard> = {
    todo: card(10),
    planned: card(11, { scheduledDate: "2026-11-27" }),
    working: card(12, { inProgress: true }),
    done: card(13, { completed: true, completedAt: "2026-11-26T10:00:00.000Z" }),
  };
  const board = Object.values(inColumn);
  const drop = (
    dropped: BoardCard,
    to: BoardColumn,
    marked: number[] = [],
    cards: BoardCard[] = board,
  ): MoveRequest => ({
    via: "drop",
    card: dropped,
    to,
    cards,
    marked: new Set(marked),
  });
  /** Answers every question as it comes (blocked: yes, the day: DAY). */
  function answered(request: MoveRequest) {
    const asked: { kind: string; ids: number[]; group: boolean }[] = [];
    const answers: MoveAnswers = {};
    let plan = planBoardMove(request, answers, NOW);
    while (plan?.question) {
      const { kind, todos, group } = plan.question;
      asked.push({ kind, ids: todos.map((todo) => todo.id), group });
      if (kind === "blocked") answers.blocked = true;
      else answers.day = DAY;
      plan = planBoardMove(request, answers, NOW);
    }
    return { asked: asked.map((entry) => entry.kind), questions: asked, plan };
  }
  const finishedOf = (request: MoveRequest): FinishedMove => {
    const { plan } = answered(request);
    if (!plan || plan.question) throw new Error("no finished plan");
    return plan;
  };
  const writesOf = (step: PlannedStep) =>
    step.kind === "complete" ? ["complete"] : step.writes;

  const open = { completed: false, completedAt: null };
  const outOfWork = { inProgress: false };
  const COMPLETE = { completed: true, completedAt: NOW };
  const START = { inProgress: true, blocked: false };
  const TODO = { scheduledDate: null, timeOfDay: null };

  it.each<{
    from: BoardColumn;
    to: BoardColumn;
    asked: string[];
    writes: unknown[];
    changes: Partial<HierarchyTodo>;
  }>([
    { from: "todo", to: "planned", asked: ["day"], writes: [{ kind: "plan", day: DAY }], changes: { ...outOfWork, scheduledDate: DAY } },
    { from: "todo", to: "working", asked: [], writes: [{ kind: "start" }], changes: START },
    { from: "todo", to: "done", asked: [], writes: ["complete"], changes: COMPLETE },
    { from: "planned", to: "todo", asked: [], writes: [{ kind: "unplan" }], changes: { ...outOfWork, ...TODO } },
    { from: "planned", to: "working", asked: [], writes: [{ kind: "start" }], changes: START },
    { from: "planned", to: "done", asked: [], writes: ["complete"], changes: COMPLETE },
    { from: "working", to: "todo", asked: ["blocked"], writes: [{ kind: "setAside", blocked: true }], changes: { ...outOfWork, blocked: true, ...TODO } },
    { from: "working", to: "planned", asked: ["blocked", "day"], writes: [{ kind: "setAside", blocked: true }, { kind: "plan", day: DAY }], changes: { ...outOfWork, blocked: true, scheduledDate: DAY } },
    { from: "working", to: "done", asked: [], writes: ["complete"], changes: COMPLETE },
    { from: "done", to: "todo", asked: [], writes: [{ kind: "reopen" }], changes: { ...outOfWork, ...open, ...TODO } },
    { from: "done", to: "planned", asked: ["day"], writes: [{ kind: "reopen" }, { kind: "plan", day: DAY }], changes: { ...outOfWork, ...open, scheduledDate: DAY } },
    { from: "done", to: "working", asked: [], writes: [{ kind: "reopen" }, { kind: "start" }], changes: { ...START, ...open } },
  ])("a single card from $from onto $to asks $asked", ({ from, to, asked, writes, changes }) => {
    const result = answered(drop(inColumn[from], to));
    expect(result.asked).toEqual(asked);
    const plan = result.plan as FinishedMove;
    expect(plan).toMatchObject({ to, group: false, clearMarks: null, line: null });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]!.card.todo.id).toBe(inColumn[from].todo.id);
    expect(writesOf(plan.steps[0]!)).toEqual(writes);
    expect(plan.steps[0]!.changes).toEqual(changes);
  });

  it("moves nothing within a column", () => {
    for (const column of BOARD_COLUMNS.map((entry) => entry.key))
      expect(planBoardMove(drop(inColumn[column], column), {}, NOW)).toBeNull();
  });

  it("takes the day of a quest in work away only where it has one", () => {
    const planned = card(14, { inProgress: true, scheduledDate: "2026-11-27" });
    expect(writesOf(finishedOf(drop(planned, "todo")).steps[0]!)).toEqual([
      { kind: "setAside", blocked: true },
      { kind: "unplan" },
    ]);
  });

  it("asks nothing more once a question is answered, and ignores answers not asked for", () => {
    const request = drop(inColumn.todo, "working");
    expect(planBoardMove(request, { blocked: false, day: DAY }, NOW)).toEqual(
      planBoardMove(request, {}, NOW),
    );
    const out = drop(inColumn.working, "planned");
    expect(planBoardMove(out, { blocked: false }, NOW)?.question?.kind).toBe("day");
    expect(planBoardMove(out, { day: DAY }, NOW)?.question?.kind).toBe("blocked");
    expect(planBoardMove(out, { blocked: false, day: DAY }, NOW)?.question).toBeNull();
  });

  it("writes nothing while a question is open: a dismissed one leaves no plan to write", () => {
    const plan = planBoardMove(drop(inColumn.working, "todo"), {}, NOW)!;
    expect(plan.question).toMatchObject({ kind: "blocked" });
    expect("steps" in plan).toBe(false);
  });

  describe("from the menu", () => {
    it("plans for the day the step names, without asking", () => {
      const { asked, plan } = answered({
        via: "menu",
        card: inColumn.todo,
        to: "planned",
        date: DAY,
      });
      expect(asked).toEqual([]);
      expect(writesOf((plan as FinishedMove).steps[0]!)).toEqual([
        { kind: "plan", day: DAY },
      ]);
    });

    it("moves a planned quest to another day, an appointment with its time", () => {
      const appointment = card(15, { scheduledDate: "2026-11-27", timeOfDay: "13:00" });
      const request: MoveRequest = { via: "menu", card: appointment, to: "planned", date: DAY };
      const plan = finishedOf(request);
      expect(answered(request).asked).toEqual([]);
      expect(writesOf(plan.steps[0]!)).toEqual([{ kind: "reschedule", day: DAY }]);
      expect(plan.steps[0]!.changes).toEqual({ inProgress: false, scheduledDate: DAY });
    });

    it("asks another day for a planned quest, and does nothing for its own day", () => {
      const planned = inColumn.planned;
      expect(answered({ via: "menu", card: planned, to: "planned" }).asked).toEqual(["day"]);
      expect(
        planBoardMove({ via: "menu", card: planned, to: "planned", date: "2026-11-27" }, {}, NOW),
      ).toBeNull();
    });

    it("sets aside out of In Arbeit, keeping the day, after asking whether it is blocked", () => {
      const planned = card(14, { inProgress: true, scheduledDate: "2026-11-27" });
      const withDay = answered({ via: "setAside", card: planned });
      expect(withDay.asked).toEqual(["blocked"]);
      const plan = withDay.plan as FinishedMove;
      expect(plan.to).toBe("planned");
      expect(writesOf(plan.steps[0]!)).toEqual([{ kind: "setAside", blocked: true }]);
      expect(plan.steps[0]!.changes).toEqual({ inProgress: false, blocked: true });
      expect(finishedOf({ via: "setAside", card: inColumn.working }).to).toBe("todo");
    });
  });

  describe("marked cards", () => {
    it("moves an unmarked card alone and leaves the marks", () => {
      const plan = finishedOf(drop(inColumn.planned, "todo", [10, 12]));
      expect(plan).toMatchObject({ group: false, clearMarks: null });
      expect(plan.steps.map((step) => step.card.todo.id)).toEqual([11]);
    });

    it("moves a card marked alone by itself and lets go of the marks at once", () => {
      const plan = planBoardMove(drop(inColumn.todo, "planned", [10]), {}, NOW)!;
      expect(plan).toMatchObject({ group: false, clearMarks: "at-once" });
      expect(plan.question).toMatchObject({ kind: "day", group: false });
    });

    it("moves every marked card by its own rule, the carried first, asking each question once", () => {
      const { questions, plan } = answered(drop(inColumn.todo, "planned", [10, 11, 12]));
      // Geplant's own card stays; only In Arbeit's waits for "blocked?".
      expect(questions).toEqual([
        { kind: "blocked", ids: [12], group: false },
        { kind: "day", ids: [10, 12], group: true },
      ]);
      const finished = plan as FinishedMove;
      expect(finished).toMatchObject({
        to: "planned",
        group: true,
        clearMarks: "on-write",
        line: "2 Quests stehen jetzt in Geplant.",
      });
      expect(
        finished.steps.map((step) => [step.card.todo.id, writesOf(step)]),
      ).toEqual([
        [10, [{ kind: "plan", day: DAY }]],
        [12, [{ kind: "setAside", blocked: true }, { kind: "plan", day: DAY }]],
      ]);
      expect(finished.steps.map((step) => step.changes)).toEqual([
        { inProgress: false, scheduledDate: DAY },
        { inProgress: false, blocked: true, scheduledDate: DAY },
      ]);
    });

    it("puts the carried card first, then the rest in the board's order", () => {
      const plan = finishedOf(drop(inColumn.done, "working", [10, 11, 13]));
      expect(plan.steps.map((step) => step.card.todo.id)).toEqual([13, 10, 11]);
      expect(plan.steps.map(writesOf)).toEqual([
        [{ kind: "reopen" }, { kind: "start" }],
        [{ kind: "start" }],
        [{ kind: "start" }],
      ]);
    });

    it("asks once whether several quests out of In Arbeit are blocked, and no day for To-Do", () => {
      const other = card(14, { inProgress: true });
      const { questions, plan } = answered(
        drop(other, "todo", [12, 14], [...board, other]),
      );
      expect(questions).toEqual([{ kind: "blocked", ids: [14, 12], group: true }]);
      expect((plan as FinishedMove).steps.map(writesOf)).toEqual([
        [{ kind: "setAside", blocked: true }],
        [{ kind: "setAside", blocked: true }],
      ]);
    });

    it("completes every marked card, each through the ring's path", () => {
      const plan = finishedOf(drop(inColumn.planned, "done", [10, 11, 13]));
      expect(plan.steps.map((step) => [step.card.todo.id, step.kind])).toEqual([
        [11, "complete"],
        [10, "complete"],
      ]);
      expect(plan.line).toBe("2 Quests stehen jetzt in Erledigt.");
    });

    it("says after the reload how many of the group landed", () => {
      const plan = finishedOf(drop(inColumn.todo, "working", [10, 11]));
      const reloaded = [
        card(10, { inProgress: true }),
        card(11, { scheduledDate: "2026-11-27" }),
      ];
      expect(landedLine(plan, reloaded)).toBe(
        "1 von 2 Quests stehen jetzt in In Arbeit.",
      );
      expect(landedLine(plan, [])).toBe("");
    });
  });
});
