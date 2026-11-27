import { describe, expect, it, vi, type Mock } from "vitest";
import { ref } from "vue";
import type { TimerController } from "../composables/useTimer";
import type { DayPlannerItem } from "../types/day-planner";
import type { WeekPlanEntry } from "../types/week-plan";
import type { ShortcutId } from "./shortcuts";
import {
  measureOf,
  menuInOrder,
  plannerRow,
  planRow,
  questRow,
  quickMoveEntries,
  quickMoves,
  rowControl,
  rowMenu,
  rowShortcuts,
  timerTargetOf,
  whereLabel,
  type ActionRow,
  type QuestRow,
  type RowActions,
  type RunRow,
} from "./row-actions";

// 18 Nov 2026 is a Wednesday; next week's Monday is the 23rd.
const TODAY = "2026-11-18";
const TOMORROW = "2026-11-19";
const NEXT_WEEK = "2026-11-23";

const quest = (changes: Partial<QuestRow> = {}): QuestRow => ({
  type: "quest",
  todoId: 3,
  title: "Lesen",
  open: true,
  date: TODAY,
  timeOfDay: null,
  timerEligible: true,
  ...changes,
});
const run = (changes: Partial<RunRow> = {}): RunRow => ({
  type: "run",
  occurrenceId: 7,
  title: "Joggen",
  open: true,
  date: TODAY,
  moveUntil: "2026-11-25",
  timerEligible: true,
  monthChallenge: false,
  ...changes,
});
const board = (
  column: "todo" | "planned" | "working" | "done",
  changes: Partial<QuestRow> = {},
): QuestRow =>
  quest({
    open: column !== "done",
    date: column === "todo" ? null : TODAY,
    board: { column, blocked: false },
    ...changes,
  });

const controller = (timer: unknown = null, busy = false) =>
  ({
    timer: ref(timer),
    busy: ref(busy),
    start: vi.fn(),
    action: vi.fn(),
  }) as unknown as TimerController & { start: Mock; action: Mock };

/** A view that has every write: what shows is the rules' choice alone. */
function everything(row: ActionRow, changes: Partial<RowActions> = {}) {
  return {
    row,
    today: TODAY,
    busy: false,
    move: vi.fn(),
    pickDay: vi.fn(),
    unplan: vi.fn(),
    complete: vi.fn(),
    startWork: vi.fn(),
    setAside: vi.fn(),
    toggleBlocked: vi.fn(),
    skip: vi.fn(),
    edit: vi.fn(),
    reparent: vi.fn(),
    openChallenge: vi.fn(),
    step: () => vi.fn(),
    remove: vi.fn(),
    ...changes,
  } satisfies RowActions;
}

const labels = (actions: RowActions, past = false) =>
  rowMenu(actions, { past }).map((entry) => entry.label);

describe("quickMoves", () => {
  it("offers tomorrow and next week for an item of today", () => {
    expect(quickMoves(TODAY, { date: TODAY })).toEqual([
      { label: "Morgen", date: TOMORROW, shortcut: "row.tomorrow" },
      { label: "Nächste Woche", date: NEXT_WEEK, shortcut: "row.nextWeek" },
    ]);
  });

  it("offers today as well for a quest without a day or from another day", () => {
    expect(quickMoves(TODAY, { date: null }).map((m) => m.label)).toEqual([
      "Heute",
      "Morgen",
      "Nächste Woche",
    ]);
    expect(
      quickMoves(TODAY, { date: "2026-11-16" }).map((m) => m.label),
    ).toEqual(["Heute", "Morgen", "Nächste Woche"]);
    expect(quickMoves(TODAY, { date: TOMORROW }).map((m) => m.label)).toEqual([
      "Heute",
      "Nächste Woche",
    ]);
  });

  it("gives appointments none: they move only where it is confirmed", () => {
    expect(quickMoves(TODAY, { date: TODAY, timeOfDay: "09:00" })).toEqual([]);
  });

  it("keeps a daily run within the last day it may move to", () => {
    expect(
      quickMoves(TODAY, { date: TODAY, moveUntil: "2026-11-20" }).map(
        (m) => m.label,
      ),
    ).toEqual(["Morgen"]);
    expect(quickMoves(TODAY, { date: TODAY, moveUntil: null })).toEqual([]);
  });
});

describe("quickMoveEntries", () => {
  it("names each entry after its item and runs the move", () => {
    const run = vi.fn();
    const [entry] = quickMoveEntries(
      "Lesen",
      quickMoves(TODAY, { date: TODAY }),
      run,
    );
    expect(entry).toMatchObject({
      label: "Morgen",
      icon: "tomorrow",
      ariaLabel: "Lesen auf morgen",
      shortcut: "row.tomorrow",
    });
    entry!.run();
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ date: TOMORROW }),
    );
  });

  it("says planning for a quest without a day", () => {
    const entries = quickMoveEntries(
      "Lesen",
      quickMoves(TODAY, { date: null }),
      () => {},
      { plan: true },
    );
    expect(entries.map((entry) => entry.ariaLabel)).toEqual([
      "Lesen einplanen für heute",
      "Lesen einplanen für morgen",
      "Lesen einplanen für nächste Woche",
    ]);
  });
});

describe("rows and their stopwatch", () => {
  it("measures a quest as a todo and a run as an occurrence", () => {
    expect(timerTargetOf(quest())).toEqual({
      kind: "todo",
      targetId: 3,
      title: "Lesen",
    });
    expect(timerTargetOf(run())).toEqual({
      kind: "occurrence",
      targetId: 7,
      title: "Joggen",
    });
    expect(measureOf(run({ timerEligible: false }))).toEqual({
      kind: "occurrence",
      targetId: 7,
      eligible: false,
    });
  });

  it("measures nothing on a forecast, an event or a Daily", () => {
    expect(
      timerTargetOf({ type: "forecast", title: "Joggen", open: true }),
    ).toBeNull();
    expect(
      timerTargetOf({ type: "event", title: "Zahnarzt", open: true }),
    ).toBeNull();
    expect(
      timerTargetOf({ type: "daily", title: "Joggen", open: true }),
    ).toBeNull();
  });

  it("reads Heute's items, the Plan's entries and quests alike", () => {
    const item = {
      type: "habit",
      habitId: 2,
      occurrenceId: 7,
      title: "Joggen",
      status: "skipped",
      scheduledDate: TODAY,
      moveUntil: null,
      timerEligible: false,
      monthChallenge: true,
    } as DayPlannerItem;
    expect(plannerRow(item)).toEqual(
      run({
        open: false,
        moveUntil: null,
        timerEligible: false,
        monthChallenge: true,
      }),
    );
    const entry = {
      type: "todo",
      todoId: 3,
      title: "Lesen",
      status: "pending",
      scheduledDate: "2026-11-16",
      timeOfDay: "09:00",
    } as WeekPlanEntry;
    // A quest keeps its own day; any open quest of the Plan can be measured.
    expect(planRow(entry, null)).toEqual(
      quest({ date: "2026-11-16", timeOfDay: "09:00" }),
    );
    const forecast = {
      type: "habit",
      occurrenceId: null,
      title: "Joggen",
      status: "pending",
    };
    expect(planRow(forecast as WeekPlanEntry, TOMORROW)).toEqual({
      type: "forecast",
      title: "Joggen",
      open: true,
    });
    expect(
      questRow({ id: 3, title: "Lesen", timerEligible: true, completed: true }),
    ).toEqual(quest({ open: false, date: null }));
  });
});

describe("rowMenu", () => {
  /*
   * Per row kind, with a view that has every write: which entries exist.
   * Up and down come from the view's order; Löschen is always last.
   */
  it.each<[string, ActionRow, string[]]>([
    [
      "an open quest of today",
      quest(),
      [
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Zurück ins To-Do",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      "a quest without a day",
      quest({ date: null }),
      [
        "Heute",
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      "an appointment",
      quest({ timeOfDay: "09:00" }),
      [
        "Termin verschieben …",
        "Zurück ins To-Do",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    ["a completed quest", quest({ open: false }), []],
    [
      "a due run",
      run(),
      [
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Überspringen",
        "Bearbeiten",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      "a run left behind",
      run({ date: null }),
      [
        "Heute",
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Überspringen",
        "Bearbeiten",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      // Its window ends on its day: no dialog, no skipping before its day.
      "a run not due yet",
      run({ date: TOMORROW, moveUntil: TOMORROW }),
      ["Heute", "Bearbeiten", "Nach oben", "Nach unten", "Löschen"],
    ],
    [
      "the Monats-Challenge's run",
      run({ moveUntil: null, monthChallenge: true }),
      [
        "Überspringen",
        "Bearbeiten",
        "Zur Monats-Challenge",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    ["a skipped run", run({ open: false }), []],
    [
      "a forecast run",
      { type: "forecast", title: "Joggen", open: true },
      ["Bearbeiten", "Löschen"],
    ],
    ["a Google event", { type: "event", title: "Zahnarzt", open: true }, []],
    [
      "a Daily",
      { type: "daily", title: "Joggen", open: true },
      ["Bearbeiten", "Löschen"],
    ],
    [
      "a board card in To-Do",
      board("todo"),
      [
        "Heute",
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Erledigen",
        "In Arbeit nehmen",
        "Als geblockt markieren",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      "a board card in Geplant",
      board("planned"),
      [
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Zurück ins To-Do",
        "Erledigen",
        "In Arbeit nehmen",
        "Als geblockt markieren",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      // "Zurückstellen …" asks about the blocker there.
      "a board card in work",
      board("working"),
      [
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Zurück ins To-Do",
        "Erledigen",
        "Zurückstellen …",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      // A done card stays at work: it can go back to any column.
      "a done board card",
      board("done"),
      [
        "Anderer Tag …",
        "Zurück ins To-Do",
        "In Arbeit nehmen",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
    [
      "a done quest of a campaign's tree",
      quest({ open: false, date: null, tree: true }),
      [
        "Anderer Tag …",
        "Zurück ins To-Do",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Nach oben",
        "Nach unten",
        "Löschen",
      ],
    ],
  ])("%s", (_name, row, expected) => {
    expect(labels(everything(row))).toEqual(expected);
  });

  it("offers only the writes a view has", () => {
    // Heute on another day moves its cards, nothing more.
    expect(
      labels({ row: run(), today: TODAY, busy: false, move: vi.fn() }),
    ).toEqual(["Morgen", "Nächste Woche"]);
    expect(labels({ row: quest(), today: TODAY, busy: false })).toEqual([]);
  });

  it("lifts a blocker in work, where it cannot be set", () => {
    expect(
      labels(
        everything(
          board("working", { board: { column: "working", blocked: true } }),
        ),
      ),
    ).toContain("Blocker aufheben");
  });

  it("leads with Anderer Tag … for a past, still open appointment", () => {
    const entries = rowMenu(everything(quest({ timeOfDay: "09:00" })), {
      past: true,
    });
    expect(entries[0]).toMatchObject({
      label: "Anderer Tag …",
      ariaLabel: "Lesen auf einen anderen Tag",
    });
  });

  it("names its steps after the row", () => {
    const aria = (row: ActionRow) =>
      Object.fromEntries(
        rowMenu(everything(row)).map((entry) => [entry.id, entry.ariaLabel]),
      );
    expect(aria(quest({ date: null }))).toMatchObject({
      "move-row.today": "Lesen einplanen für heute",
      move: "Tag für Lesen wählen",
      delete: "Lesen löschen",
    });
    expect(aria(quest({ timeOfDay: "09:00" }))).toMatchObject({
      move: "Lesen verschieben",
    });
    expect(aria(run())).toMatchObject({
      skip: "Joggen überspringen",
      delete: "Daily Joggen ganz löschen",
    });
    expect(
      aria({ type: "forecast", title: "Joggen", open: true }),
    ).toMatchObject({
      delete: "Daily Joggen ganz löschen",
    });
    expect(aria({ type: "daily", title: "Joggen", open: true })).toMatchObject({
      delete: "Joggen löschen",
    });
    expect(aria(quest({ tree: true }))).toMatchObject({
      delete: "Lesen mit allen Unter-Quests löschen",
    });
  });

  it("runs the view's writes; a quick move goes to its day", () => {
    const actions = everything(quest());
    const entries = rowMenu(actions);
    entries.find((entry) => entry.label === "Nächste Woche")!.run();
    expect(actions.move).toHaveBeenCalledWith(NEXT_WEEK);
    entries.find((entry) => entry.label === "Löschen")!.run();
    expect(actions.remove).toHaveBeenCalled();
  });

  it("puts the board's days in place of the quick moves (the Plan's Questlog column)", () => {
    const actions = everything(quest({ date: null }), {
      planDays: [{ date: TOMORROW, label: "Do., 19.11." }],
    });
    const [day] = rowMenu(actions);
    expect(day).toMatchObject({
      id: `plan-${TOMORROW}`,
      label: "Do., 19.11.",
      icon: "calendar",
      ariaLabel: "Lesen einplanen am Do., 19.11.",
    });
    day!.run();
    expect(actions.move).toHaveBeenCalledWith(TOMORROW);
  });

  it("gives the focus card its way into the Fokus-Modus and a tree row its Unter-Quest", () => {
    expect(
      labels({ ...everything(quest()), focusMode: vi.fn(), addChild: vi.fn() }),
    ).toEqual(
      expect.arrayContaining(["Fokus-Modus", "Unter-Quest hinzufügen"]),
    );
  });

  it("holds every step while the row is busy", () => {
    const entries = rowMenu(everything(quest(), { busy: true }));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.disabled)).toBe(true);
  });

  describe("the stopwatch of a card without ▶", () => {
    const timerEntry = (actions: RowActions) =>
      rowMenu(actions).find((entry) => entry.id === "timer");

    it("starts like ▶ where measuring is allowed", () => {
      const own = controller();
      const entry = timerEntry({
        row: quest(),
        today: TODAY,
        busy: false,
        menuTimer: own,
      });
      expect(entry).toMatchObject({
        label: "Stoppuhr starten",
        ariaLabel: "Stoppuhr starten: Lesen",
        disabled: false,
      });
      entry!.run();
      expect(own.start).toHaveBeenCalledWith(timerTargetOf(quest()));
      const ineligible = quest({ timerEligible: false });
      expect(
        timerEntry({
          row: ineligible,
          today: TODAY,
          busy: false,
          menuTimer: own,
        })?.disabled,
      ).toBe(true);
      expect(
        timerEntry({ row: quest(), today: TODAY, busy: false, menuTimer: null })
          ?.disabled,
      ).toBe(true);
    });

    it("pauses the stopwatch already running on this card", () => {
      const own = controller({
        kind: "occurrence",
        targetId: 7,
        state: "running",
      });
      const entry = timerEntry({
        row: run({ timerEligible: false }),
        today: TODAY,
        busy: false,
        menuTimer: own,
      });
      expect(entry).toMatchObject({
        label: "Stoppuhr pausieren",
        disabled: false,
      });
      entry!.run();
      expect(own.action).toHaveBeenCalledWith("pause");
    });

    it("is no entry where the card has ▶", () => {
      expect(timerEntry(everything(quest()))).toBeUndefined();
    });
  });
});

describe("menuInOrder", () => {
  const run = () => {};
  it("puts every step in the one order, Löschen last and set apart", () => {
    const entries = menuInOrder("Lesen", {
      remove: { run },
      down: run,
      up: run,
      challenge: run,
      reparent: run,
      child: run,
      timer: { run, label: "Stoppuhr starten", disabled: false },
      focusMode: run,
      edit: run,
      skip: run,
      block: { run, blocked: false },
      setAside: run,
      startWork: run,
      complete: run,
      unplan: run,
      otherDay: { run },
      quickMoves: quickMoveEntries(
        "Lesen",
        quickMoves(TODAY, { date: TODAY }),
        run,
      ),
    });
    expect(entries.map((entry) => entry.label)).toEqual([
      "Morgen",
      "Nächste Woche",
      "Anderer Tag …",
      "Zurück ins To-Do",
      "Erledigen",
      "In Arbeit nehmen",
      "Zurückstellen …",
      "Als geblockt markieren",
      "Überspringen",
      "Bearbeiten",
      "Fokus-Modus",
      "Stoppuhr starten",
      "Unter-Quest hinzufügen",
      "In Kampagne verschieben …",
      "Zur Monats-Challenge",
      "Nach oben",
      "Nach unten",
      "Löschen",
    ]);
    expect(entries.filter((entry) => entry.last).map((e) => e.label)).toEqual([
      "Löschen",
    ]);
  });
});

describe("rowShortcuts", () => {
  const KEYS: ShortcutId[] = [
    "row.timer",
    "row.done",
    "row.today",
    "row.tomorrow",
    "row.nextWeek",
  ];
  /** What each key does on the row: "–" passes it on, otherwise the write it ran. */
  function keysOn(actions: RowActions | null, timer = controller()) {
    const handlers = rowShortcuts(() => actions, timer);
    return Object.fromEntries(
      KEYS.map((id) => {
        vi.clearAllMocks();
        const handled = handlers[id]!({ row: null, key: "row" }) !== false;
        if (!handled) return [id, "–"];
        if (timer.start.mock.calls.length) return [id, "start"];
        if (timer.action.mock.calls.length) return [id, "pause"];
        const ran = Object.entries(actions ?? {}).find(
          ([, value]) => vi.isMockFunction(value) && value.mock.calls.length,
        );
        const [name, spy] = ran as [string, Mock];
        return [
          id,
          spy.mock.calls[0]?.length ? `${name} ${spy.mock.calls[0][0]}` : name,
        ];
      }),
    );
  }

  it.each<[string, ActionRow, Record<string, string>]>([
    [
      "an open quest of today",
      quest(),
      {
        "row.timer": "start",
        "row.done": "complete",
        "row.today": "–",
        "row.tomorrow": `move ${TOMORROW}`,
        "row.nextWeek": `move ${NEXT_WEEK}`,
      },
    ],
    [
      "a quest without a day",
      quest({ date: null }),
      {
        "row.timer": "start",
        "row.done": "complete",
        "row.today": `move ${TODAY}`,
        "row.tomorrow": `move ${TOMORROW}`,
        "row.nextWeek": `move ${NEXT_WEEK}`,
      },
    ],
    [
      // Its move is confirmed in "Anderer Tag …"; its own day stays put.
      "an appointment",
      quest({ timeOfDay: "09:00" }),
      {
        "row.timer": "start",
        "row.done": "complete",
        "row.today": "–",
        "row.tomorrow": "pickDay",
        "row.nextWeek": "pickDay",
      },
    ],
    [
      "a completed quest",
      quest({ open: false }),
      {
        "row.timer": "–",
        "row.done": "–",
        "row.today": "–",
        "row.tomorrow": "–",
        "row.nextWeek": "–",
      },
    ],
    [
      "a due run",
      run(),
      {
        "row.timer": "start",
        "row.done": "complete",
        "row.today": "–",
        "row.tomorrow": `move ${TOMORROW}`,
        "row.nextWeek": `move ${NEXT_WEEK}`,
      },
    ],
    [
      "a run not due yet, its window ending on its day",
      run({ date: TOMORROW, moveUntil: TOMORROW }),
      {
        "row.timer": "start",
        "row.done": "–",
        "row.today": `move ${TODAY}`,
        "row.tomorrow": "–",
        "row.nextWeek": "–",
      },
    ],
    [
      "a forecast run",
      { type: "forecast", title: "Joggen", open: true },
      {
        "row.timer": "–",
        "row.done": "–",
        "row.today": "–",
        "row.tomorrow": "–",
        "row.nextWeek": "–",
      },
    ],
    [
      "a Google event",
      { type: "event", title: "Zahnarzt", open: true },
      {
        "row.timer": "–",
        "row.done": "–",
        "row.today": "–",
        "row.tomorrow": "–",
        "row.nextWeek": "–",
      },
    ],
    [
      // The board leaves an appointment be.
      "an appointment on the board",
      board("planned", { timeOfDay: "09:00" }),
      {
        "row.timer": "start",
        "row.done": "complete",
        "row.today": "–",
        "row.tomorrow": "–",
        "row.nextWeek": "–",
      },
    ],
    [
      // Not in Geplant yet: even its own day moves it there.
      "a board card in work",
      board("working"),
      {
        "row.timer": "start",
        "row.done": "complete",
        "row.today": `move ${TODAY}`,
        "row.tomorrow": `move ${TOMORROW}`,
        "row.nextWeek": `move ${NEXT_WEEK}`,
      },
    ],
    [
      "a board card in Geplant",
      board("planned"),
      {
        "row.timer": "start",
        "row.done": "complete",
        "row.today": "–",
        "row.tomorrow": `move ${TOMORROW}`,
        "row.nextWeek": `move ${NEXT_WEEK}`,
      },
    ],
  ])("%s", (_name, row, expected) => {
    expect(keysOn(everything(row))).toEqual(expected);
  });

  it("pauses the row's own stopwatch with Space", () => {
    const own = controller({ kind: "todo", targetId: 3, state: "running" });
    expect(
      keysOn(everything(quest({ timerEligible: false })), own)["row.timer"],
    ).toBe("pause");
  });

  it("passes every key but Space while the row is busy", () => {
    expect(keysOn(everything(quest({ date: null }), { busy: true }))).toEqual({
      "row.timer": "start",
      "row.done": "–",
      "row.today": "–",
      "row.tomorrow": "–",
      "row.nextWeek": "–",
    });
  });

  it("passes a key the view cannot do, or a move it refused", () => {
    expect(keysOn({ row: quest(), today: TODAY, busy: false })).toMatchObject({
      "row.done": "–",
      "row.tomorrow": "–",
    });
    expect(
      keysOn(everything(quest(), { move: vi.fn(() => false) }))["row.tomorrow"],
    ).toBe("–");
    expect(keysOn(null)).toEqual({
      "row.timer": "–",
      "row.done": "–",
      "row.today": "–",
      "row.tomorrow": "–",
      "row.nextWeek": "–",
    });
  });
});

describe("whereLabel", () => {
  it("says where a moved row stands now", () => {
    expect(whereLabel(TODAY, TODAY)).toBe("bei heute");
    expect(whereLabel(TOMORROW, TODAY)).toBe("bei morgen");
    expect(whereLabel(NEXT_WEEK, TODAY)).toBe("am Montag, 23. Nov.");
  });
});

describe("rowControl", () => {
  it("finds a row's menu button or its title", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <article data-focus-key="todo-3">
        <button data-edit-button>Lesen</button>
        <button aria-haspopup="menu">…</button>
      </article>`;
    expect(rowControl(root, "todo-3")?.textContent).toBe("…");
    expect(rowControl(root, "todo-3", "card")?.textContent).toBe("Lesen");
    expect(rowControl(root, "todo-4")).toBeNull();
    expect(rowControl(null, "todo-3")).toBeNull();
  });
});
