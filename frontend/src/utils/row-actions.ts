import {
  timerStateOf,
  toggleTimer,
  type TimerController,
} from "../composables/useTimer";
import type { ShortcutHandler } from "../composables/useShortcuts";
import type { DayPlannerItem } from "../types/day-planner";
import type { TimerTarget } from "../types/timer";
import type { WeekPlanEntry } from "../types/week-plan";
import type { BoardColumn } from "./campaign-board";
import { addDays, weekStart } from "./date";
import { dayLabel } from "./history";
import type { ShortcutId } from "./shortcuts";

/**
 * The card contract (DESIGN.md › Karten): a ring where the item can be done,
 * the card opens the editor, ▶ where measuring makes sense, and everything
 * else in one menu "Aktionen für …". This file answers, for any row of any
 * view, what can be done with it: its stopwatch target (`timerTargetOf`),
 * its menu (`rowMenu`) and its keys (`rowShortcuts`). A view describes the
 * row (`plannerRow`, `planRow`, `questRow`, `dailyRow`) and hands over the
 * writes it has (`RowActions`); when an entry or a key applies is decided
 * here, never in the view.
 */

/** Icons the menu entries use; a subset of AppIcon's names. */
export type MenuIcon =
  | "today"
  | "tomorrow"
  | "calendar"
  | "move"
  | "skip"
  | "edit"
  | "child"
  | "timer"
  | "trash"
  | "check"
  | "stop"
  | "focus"
  | "arrow-up"
  | "arrow-down"
  | "campaigns"
  | "challenge"
  | "questlog"
  | "pause"
  | "play"
  | "blocked";

/** One entry of an action menu. */
export type MenuEntry = {
  id: string;
  label: string;
  icon: MenuIcon;
  run: () => void;
  /** Spoken name when the visible label needs the title ("Joggen überspringen"). */
  ariaLabel?: string;
  disabled?: boolean;
  /** Set apart by a hairline at the end, like "Löschen". */
  last?: boolean;
  /** The key that does the same on the row; shown as a key cap where a keyboard is likely. */
  shortcut?: ShortcutId;
};

/* The rows */

/** A quest: on a day, in the Questlog, or on a campaign's page. */
export type QuestRow = {
  type: "quest";
  todoId: number;
  title: string;
  open: boolean;
  /** The day it is planned for; null without one (the Questlog). */
  date: string | null;
  /** An appointment's time: it moves only where the move is confirmed. */
  timeOfDay: string | null;
  timerEligible: boolean;
  /** A card of the campaign board, in its column. */
  board?: { column: BoardColumn; blocked: boolean };
  /** A row of a campaign's tree: Löschen takes the quests below along. */
  tree?: boolean;
};

/** A daily's stored run. */
export type RunRow = {
  type: "run";
  occurrenceId: number;
  title: string;
  open: boolean;
  /** The day it stands on; null for one left behind (the Plan). */
  date: string | null;
  /** The last day it may move to; null once it may not move. */
  moveUntil: string | null;
  timerEligible: boolean;
  /** A run of the Daily carrying the running Monats-Challenge. */
  monthChallenge: boolean;
};

/**
 * A row as the rules read it. Besides quests and runs: a run the schedule
 * only forecasts (nothing stored yet), a Google event (changed in Google
 * only) and a Daily itself (the Dailies page).
 */
export type ActionRow =
  | QuestRow
  | RunRow
  | { type: "forecast"; title: string; open: boolean }
  | { type: "event"; title: string; open: boolean }
  | { type: "daily"; title: string; open: boolean };

/** A row of Heute and of the Fokus-Modus. */
export function plannerRow(item: DayPlannerItem): QuestRow | RunRow {
  const open = item.status === "pending";
  if (item.type === "todo")
    return {
      type: "quest",
      todoId: item.todoId,
      title: item.title,
      open,
      date: item.scheduledDate,
      timeOfDay: item.timeOfDay,
      timerEligible: item.timerEligible,
    };
  return {
    type: "run",
    occurrenceId: item.occurrenceId,
    title: item.title,
    open,
    date: item.scheduledDate,
    moveUntil: item.moveUntil,
    timerEligible: item.timerEligible,
    monthChallenge: !!item.monthChallenge,
  };
}

/**
 * An entry of the Plan's read (the Plan, Heute on another day) in the
 * column of `date`; null for what was left behind. A quest keeps its own
 * day, and any open quest can be measured.
 */
export function planRow(entry: WeekPlanEntry, date: string | null): ActionRow {
  const open = entry.status === "pending";
  if (entry.type === "event")
    return { type: "event", title: entry.title, open };
  if (entry.type === "todo")
    return {
      type: "quest",
      todoId: entry.todoId,
      title: entry.title,
      open,
      date: entry.scheduledDate,
      timeOfDay: entry.timeOfDay,
      timerEligible: true,
    };
  if (entry.occurrenceId === null)
    return { type: "forecast", title: entry.title, open };
  return {
    type: "run",
    occurrenceId: entry.occurrenceId,
    title: entry.title,
    open,
    date,
    moveUntil: entry.moveUntil,
    timerEligible: entry.timerEligible,
    monthChallenge: !!entry.monthChallenge,
  };
}

/** A quest of the Questlog or of a campaign; `place` for the campaign pages. */
export function questRow(
  todo: {
    id: number;
    title: string;
    timerEligible: boolean;
    completed?: boolean;
    scheduledDate?: string | null;
    timeOfDay?: string | null;
  },
  place: Pick<QuestRow, "board" | "tree"> = {},
): QuestRow {
  return {
    type: "quest",
    todoId: todo.id,
    title: todo.title,
    open: !todo.completed,
    date: todo.scheduledDate ?? null,
    timeOfDay: todo.timeOfDay ?? null,
    timerEligible: todo.timerEligible,
    ...place,
  };
}

/** A Daily on the Dailies page. */
export function dailyRow(habit: { title: string }): ActionRow {
  return { type: "daily", title: habit.title, open: true };
}

/* The stopwatch */

/** What the stopwatch of a row is started on; null where nothing is measured. */
export function timerTargetOf(row: QuestRow | RunRow): TimerTarget;
export function timerTargetOf(row: ActionRow): TimerTarget | null;
export function timerTargetOf(row: ActionRow): TimerTarget | null {
  if (row.type === "quest")
    return { kind: "todo", targetId: row.todoId, title: row.title };
  if (row.type === "run")
    return { kind: "occurrence", targetId: row.occurrenceId, title: row.title };
  return null;
}

/** ▶ of a row (ItemRow's `measure`): its target and whether it may start. */
export function measureOf(row: QuestRow | RunRow): {
  kind: TimerTarget["kind"];
  targetId: number;
  eligible: boolean;
} {
  const { kind, targetId } = timerTargetOf(row);
  return { kind, targetId, eligible: row.timerEligible };
}

/** "Stoppuhr starten" in a menu; pauses or resumes a stopwatch already on it. */
type TimerStep = { run: () => void; label: string; disabled: boolean };

/** The stopwatch step for a card without ▶: the same toggle as ▶ and Space. */
function timerStep(
  controller: TimerController | null,
  target: TimerTarget,
  eligible: boolean,
): TimerStep {
  const own = timerStateOf(controller, target);
  return {
    label:
      own === "running"
        ? "Stoppuhr pausieren"
        : own === "paused"
          ? "Stoppuhr fortsetzen"
          : "Stoppuhr starten",
    disabled: !controller || controller.busy.value || (!own && !eligible),
    run: () => void toggleTimer(controller, target, eligible),
  };
}

/* Moves */

/** A day an item can go to in one tap, with the key that does the same. */
export type QuickMove = {
  label: "Heute" | "Morgen" | "Nächste Woche";
  date: string;
  shortcut: ShortcutId;
};

/** The days of the quick moves and their keys T, D and W. */
const QUICK_DAYS: {
  label: QuickMove["label"];
  shortcut: ShortcutId;
  from: (today: string) => string;
}[] = [
  { label: "Heute", shortcut: "row.today", from: (today) => today },
  {
    label: "Morgen",
    shortcut: "row.tomorrow",
    from: (today) => addDays(today, 1),
  },
  {
    label: "Nächste Woche",
    shortcut: "row.nextWeek",
    from: (today) => addDays(weekStart(today), 7),
  },
];

/**
 * Where an item can move without a dialog: today (when it is not on today),
 * tomorrow and next week's Monday, never into the past, never beyond the
 * last day a daily run may go to, never onto its own day. Appointments move
 * only through "Verschieben", where the move is confirmed.
 */
export function quickMoves(
  today: string,
  item: {
    /** The day the item is on now; null for a quest in the Questlog. */
    date: string | null;
    /** An appointment's time; appointments take no quick moves. */
    timeOfDay?: string | null;
    /** Last day a daily run may move to; undefined for quests. */
    moveUntil?: string | null;
  },
): QuickMove[] {
  if (item.timeOfDay) return [];
  return QUICK_DAYS.map(({ label, shortcut, from }) => ({
    label,
    date: from(today),
    shortcut,
  })).filter(
    (move) =>
      move.date !== item.date &&
      move.date >= today &&
      (item.moveUntil === undefined ||
        (item.moveUntil !== null && move.date <= item.moveUntil)),
  );
}

const MOVE_ICONS: Record<QuickMove["label"], MenuIcon> = {
  Heute: "today",
  Morgen: "tomorrow",
  "Nächste Woche": "calendar",
};

/** Quick moves as menu entries; `plan` names them for a quest without a day. */
export function quickMoveEntries(
  title: string,
  moves: QuickMove[],
  run: (move: QuickMove) => void,
  options: { disabled?: boolean; plan?: boolean } = {},
): MenuEntry[] {
  return moves.map((move) => ({
    id: `move-${move.shortcut}`,
    label: move.label,
    icon: MOVE_ICONS[move.label],
    ariaLabel: `${title} ${options.plan ? "einplanen für" : "auf"} ${
      move.label === "Nächste Woche"
        ? "nächste Woche"
        : move.label.toLowerCase()
    }`,
    shortcut: move.shortcut,
    disabled: options.disabled,
    run: () => run(move),
  }));
}

/** The quick moves of a quest or run, by its day and its window. */
function movesOf(today: string, row: QuestRow | RunRow): QuickMove[] {
  return quickMoves(today, {
    date: row.date,
    timeOfDay: row.type === "quest" ? row.timeOfDay : null,
    moveUntil: row.type === "run" ? row.moveUntil : undefined,
  });
}

/** Where a moved row stands now, for its status line: "bei heute", "am Freitag, 4. Dez.". */
export function whereLabel(date: string, today: string): string {
  if (date === today) return "bei heute";
  if (date === addDays(today, 1)) return "bei morgen";
  return `am ${dayLabel(date)}`;
}

/* What a view can do */

/**
 * What a view can do with one row: the row, today, whether it is busy, and
 * the writes it has. A write left out means the view does not offer it;
 * when an offered write shows as an entry or answers a key is decided by
 * `rowMenu` and `rowShortcuts`.
 */
export type RowActions = {
  row: ActionRow;
  today: string;
  /** A write or a dialog runs: every entry waits, the keys pass. */
  busy: boolean;
  /** Onto `date` without a dialog: T, D, W and the menu's days. False: it did not. */
  move?: (date: string) => boolean | void;
  /** The board's days instead of Heute, Morgen, Nächste Woche (the Plan's Questlog column). */
  planDays?: { date: string; label: string }[];
  /** "Anderer Tag …": a dialog picks the day; an appointment's move is confirmed there. */
  pickDay?: () => void;
  /** "Zurück ins To-Do": the day goes, the quest waits without one. */
  unplan?: () => void;
  /** Done: X, and "Erledigen" on a board card, whose ring is not the only way. */
  complete?: () => void;
  /** "In Arbeit nehmen": into In Arbeit by hand, without a stopwatch. */
  startWork?: () => void;
  /** "Zurückstellen …": work stops for now; asks whether it is blocked. */
  setAside?: () => void;
  /** "Als geblockt markieren" or "Blocker aufheben". */
  toggleBlocked?: () => void;
  skip?: () => void;
  edit?: () => void;
  /** The focus card's way into the Fokus-Modus. */
  focusMode?: () => void;
  /** The card has no ▶: its menu carries the stopwatch. */
  menuTimer?: TimerController | null;
  addChild?: () => void;
  /** "In Kampagne verschieben …": below a campaign or one of its quests. */
  reparent?: () => void;
  /** "Zur Monats-Challenge": the Daily that carries this month's challenge. */
  openChallenge?: () => void;
  /** One place up or down in the view's order; undefined at its end. */
  step?: (direction: "up" | "down") => (() => void) | undefined;
  remove?: () => void;
};

/** A run can be done or skipped once its day has come. */
function isDue(row: RunRow, today: string): boolean {
  return row.date === null || row.date <= today;
}

/**
 * A row's "Aktionen für …", by what it is:
 * - a done row has none, except on the campaign pages, where done quests
 *   stay at work (the board moves them back, the tree edits them);
 * - an open quest or run gets the quick moves (`quickMoves`), or the
 *   board's days (`planDays`); "Anderer Tag …" for a quest, and for a run
 *   while its window reaches past its day; first for an appointment that
 *   is over but still open (`past`);
 * - a board card: "Zurück ins To-Do" while it has a day or is done,
 *   "Erledigen" while open, "In Arbeit nehmen" unless in work,
 *   "Zurückstellen …" in work, the blocker while open (in work only to
 *   lift it, "Zurückstellen …" asks it there);
 * - "Überspringen" for a run that is due, "Zur Monats-Challenge" on the
 *   challenge's run, "In Kampagne verschieben …" for a quest;
 * - "Löschen" of a run or a forecast deletes the whole Daily; a row of a
 *   campaign's tree takes its quests along;
 * - a forecast run offers only its Daily's Bearbeiten and Löschen, an
 *   event nothing.
 * Every entry waits while the row is busy.
 */
export function rowMenu(
  actions: RowActions,
  { past = false }: { past?: boolean } = {},
): MenuEntry[] {
  const { row, busy, today } = actions;
  const { title } = row;
  const remove = actions.remove;
  if (row.type === "event") return [];
  if (row.type === "daily")
    return menuInOrder(
      title,
      { edit: actions.edit, remove: remove && { run: remove } },
      busy,
    );
  if (row.type === "forecast")
    return row.open
      ? menuInOrder(
          title,
          {
            edit: actions.edit,
            remove: remove && {
              run: remove,
              ariaLabel: `Daily ${title} ganz löschen`,
            },
          },
          busy,
        )
      : [];
  const quest = row.type === "quest" ? row : null;
  const run = row.type === "run" ? row : null;
  const board = quest?.board;
  if (!row.open && !board && !quest?.tree) return [];
  const move = actions.move;
  const days = actions.planDays?.map((day): MenuEntry => ({
    id: `plan-${day.date}`,
    label: day.label,
    icon: "calendar",
    ariaLabel: `${title} einplanen am ${day.label}`,
    disabled: busy,
    run: () => void move?.(day.date),
  }));
  const pickable =
    !!actions.pickDay &&
    (!run || (run.moveUntil !== null && run.moveUntil > (run.date ?? "")));
  return menuInOrder(
    title,
    {
      quickMoves:
        days ??
        (row.open && move
          ? quickMoveEntries(
              title,
              movesOf(today, row),
              (quick) => void move(quick.date),
              { disabled: busy, plan: !!quest && row.date === null },
            )
          : []),
      otherDay: pickable
        ? {
            run: actions.pickDay!,
            appointment: !!quest?.timeOfDay,
            plan: !!quest && row.date === null,
            lead: past,
          }
        : undefined,
      unplan:
        quest && (row.date !== null || !row.open) ? actions.unplan : undefined,
      complete: board && row.open ? actions.complete : undefined,
      startWork:
        board && board.column !== "working" ? actions.startWork : undefined,
      setAside: board?.column === "working" ? actions.setAside : undefined,
      block:
        board &&
        row.open &&
        actions.toggleBlocked &&
        (board.blocked || board.column !== "working")
          ? { run: actions.toggleBlocked, blocked: board.blocked }
          : undefined,
      skip: run && row.open && isDue(run, today) ? actions.skip : undefined,
      edit: actions.edit,
      focusMode: actions.focusMode,
      timer:
        actions.menuTimer !== undefined
          ? timerStep(actions.menuTimer, timerTargetOf(row), row.timerEligible)
          : undefined,
      child: actions.addChild,
      reparent: quest ? actions.reparent : undefined,
      challenge: run?.monthChallenge ? actions.openChallenge : undefined,
      up: actions.step?.("up"),
      down: actions.step?.("down"),
      remove: remove && {
        run: remove,
        ariaLabel: run
          ? `Daily ${title} ganz löschen`
          : quest?.tree
            ? `${title} mit allen Unter-Quests löschen`
            : undefined,
      },
    },
    busy,
  );
}

/** The steps a menu can offer, as `rowMenu` (or the Kalender) fills them in. */
export type MenuSteps = {
  /** Heute, Morgen, Nächste Woche, from \`quickMoveEntries\`. */
  quickMoves?: MenuEntry[];
  /**
   * Picks a day; an appointment's move is confirmed ("Termin verschieben …").
   * `lead`: an appointment that is over but still open answers its question
   * here, so "Anderer Tag …" comes first, before the quick moves.
   */
  otherDay?: {
    run: () => void;
    appointment?: boolean;
    plan?: boolean;
    lead?: boolean;
  };
  unplan?: () => void;
  complete?: () => void;
  startWork?: () => void;
  setAside?: () => void;
  /** "Als geblockt markieren" (`blocked` false) or "Blocker aufheben". */
  block?: { run: () => void; blocked: boolean };
  skip?: () => void;
  edit?: () => void;
  focusMode?: () => void;
  timer?: TimerStep;
  child?: () => void;
  reparent?: () => void;
  challenge?: () => void;
  up?: () => void;
  down?: () => void;
  remove?: { run: () => void; ariaLabel?: string };
};

/**
 * Every card's menu in the one order: quick moves, "Anderer Tag …" (first
 * for a past, still open appointment), the board's steps, Überspringen,
 * Bearbeiten, Fokus-Modus, Stoppuhr, Unter-Quest, "In Kampagne verschieben
 * …", "Zur Monats-Challenge", Nach oben / Nach unten, and Löschen last,
 * set apart (every view offers it, with the editor's confirmation). The
 * Kalender fills it by hand: its runs take their quick moves from the day
 * they were scheduled for, not the day they stand on.
 */
export function menuInOrder(
  title: string,
  steps: MenuSteps,
  disabled = false,
): MenuEntry[] {
  const entries: MenuEntry[] = [];
  const add = (entry: Omit<MenuEntry, "disabled"> & { disabled?: boolean }) =>
    entries.push({ ...entry, disabled: disabled || entry.disabled });
  const { otherDay, timer, remove } = steps;
  if (otherDay?.lead)
    add({
      id: "move",
      label: "Anderer Tag …",
      icon: "move",
      ariaLabel: `${title} auf einen anderen Tag`,
      run: otherDay.run,
    });
  entries.push(...(steps.quickMoves ?? []));
  if (otherDay && !otherDay.lead)
    add({
      id: "move",
      label: otherDay.appointment ? "Termin verschieben …" : "Anderer Tag …",
      icon: "move",
      ariaLabel: otherDay.plan
        ? `Tag für ${title} wählen`
        : `${title} verschieben`,
      run: otherDay.run,
    });
  if (steps.unplan)
    add({
      id: "unplan",
      label: "Zurück ins To-Do",
      icon: "questlog",
      ariaLabel: `${title} zurück ins To-Do, ohne Tag`,
      run: steps.unplan,
    });
  if (steps.complete)
    add({
      id: "complete",
      label: "Erledigen",
      icon: "check",
      ariaLabel: `${title} erledigen`,
      shortcut: "row.done",
      run: steps.complete,
    });
  if (steps.startWork)
    add({
      id: "start-work",
      label: "In Arbeit nehmen",
      icon: "play",
      ariaLabel: `${title} in Arbeit nehmen`,
      run: steps.startWork,
    });
  if (steps.setAside)
    add({
      id: "set-aside",
      label: "Zurückstellen …",
      icon: "pause",
      ariaLabel: `${title} zurückstellen`,
      run: steps.setAside,
    });
  if (steps.block)
    add({
      id: "block",
      label: steps.block.blocked
        ? "Blocker aufheben"
        : "Als geblockt markieren",
      icon: "blocked",
      ariaLabel: steps.block.blocked
        ? `Blocker von ${title} aufheben`
        : `${title} als geblockt markieren`,
      run: steps.block.run,
    });
  if (steps.skip)
    add({
      id: "skip",
      label: "Überspringen",
      icon: "skip",
      ariaLabel: `${title} überspringen`,
      run: steps.skip,
    });
  if (steps.edit)
    add({ id: "edit", label: "Bearbeiten", icon: "edit", run: steps.edit });
  if (steps.focusMode)
    add({
      id: "focus",
      label: "Fokus-Modus",
      icon: "focus",
      run: steps.focusMode,
    });
  if (timer)
    add({
      id: "timer",
      label: timer.label,
      icon: "timer",
      ariaLabel: `${timer.label}: ${title}`,
      disabled: timer.disabled,
      run: timer.run,
    });
  if (steps.child)
    add({
      id: "child",
      label: "Unter-Quest hinzufügen",
      icon: "child",
      ariaLabel: `Unter-Quest zu ${title} hinzufügen`,
      run: steps.child,
    });
  if (steps.reparent)
    add({
      id: "reparent",
      label: "In Kampagne verschieben …",
      icon: "campaigns",
      ariaLabel: `${title} in eine Kampagne verschieben`,
      run: steps.reparent,
    });
  if (steps.challenge)
    add({
      id: "challenge",
      label: "Zur Monats-Challenge",
      icon: "challenge",
      run: steps.challenge,
    });
  if (steps.up)
    add({
      id: "up",
      label: "Nach oben",
      icon: "arrow-up",
      ariaLabel: `${title} nach oben`,
      run: steps.up,
    });
  if (steps.down)
    add({
      id: "down",
      label: "Nach unten",
      icon: "arrow-down",
      ariaLabel: `${title} nach unten`,
      run: steps.down,
    });
  if (remove)
    add({
      id: "delete",
      label: "Löschen",
      icon: "trash",
      ariaLabel: remove.ariaLabel ?? `${title} löschen`,
      last: true,
      run: remove.run,
    });
  return entries;
}

/* Keys */

/**
 * T, D or W on a row: it moves where the menu's quick move goes. An
 * appointment opens "Anderer Tag …" instead, where its move is confirmed.
 * The board, as found, leaves an appointment be, and moves a card that is
 * not in Geplant yet there even onto its own day.
 */
function moveByKey(actions: RowActions, date: string): boolean {
  const { row, move, today } = actions;
  if (!move || actions.busy || !row.open) return false;
  if (row.type !== "quest" && row.type !== "run") return false;
  if (row.type === "quest" && row.timeOfDay) {
    if (row.board || !actions.pickDay || row.date === date) return false;
    actions.pickDay();
    return true;
  }
  const offered =
    row.type === "quest" && row.board && row.board.column !== "planned"
      ? date >= today
      : movesOf(today, row).some((quick) => quick.date === date);
  return offered && move(date) !== false;
}

/**
 * The keys on a row, for the row the keyboard is on (`rowOf` its
 * `data-focus-key`; null where the view has no such row or holds it):
 * Space starts, pauses or resumes the stopwatch of an open quest or run,
 * as its ▶ does; X completes an open row that is not busy, a run once it
 * is due; T, D and W move it (`moveByKey`). A key that does not apply
 * returns false, so the key does what it did before.
 */
export function rowShortcuts(
  rowOf: (key: string | null) => RowActions | null,
  timer: TimerController | null,
): Partial<Record<ShortcutId, ShortcutHandler>> {
  const handlers: Partial<Record<ShortcutId, ShortcutHandler>> = {
    "row.timer": ({ key }) => {
      const row = rowOf(key)?.row;
      if (!row?.open || (row.type !== "quest" && row.type !== "run"))
        return false;
      return toggleTimer(timer, timerTargetOf(row), row.timerEligible);
    },
    "row.done": ({ key }) => {
      const actions = rowOf(key);
      if (!actions?.complete || actions.busy || !actions.row.open) return false;
      const { row } = actions;
      if (row.type !== "quest" && row.type !== "run") return false;
      if (row.type === "run" && !isDue(row, actions.today)) return false;
      actions.complete();
    },
  };
  for (const { shortcut, from } of QUICK_DAYS)
    handlers[shortcut] = ({ key }) => {
      const actions = rowOf(key);
      return !!actions && moveByKey(actions, from(actions.today));
    };
  return handlers;
}

/** A row's menu button (or its title, `card`): where the focus goes after a step. */
export function rowControl(
  root: ParentNode | null | undefined,
  key: string,
  on: "menu" | "card" = "menu",
): HTMLElement | null {
  return (
    root?.querySelector<HTMLElement>(
      `[data-focus-key="${key}"] ${
        on === "menu" ? '[aria-haspopup="menu"]' : "[data-edit-button]"
      }`,
    ) ?? null
  );
}
