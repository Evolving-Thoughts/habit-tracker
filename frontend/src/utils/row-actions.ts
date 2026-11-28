import {
  timerStateOf,
  toggleTimer,
  type TimerController,
} from "../composables/useTimer";
import type { ShortcutHandler } from "../composables/useShortcuts";
import type { DayPlannerItem } from "../types/day-planner";
import type { HistoryPlannedItem } from "../types/history";
import type { ItemTarget } from "../types/item-target";
import type {
  WeekPlanEntry,
  WeekPlanHabitEntry,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import type { BoardColumn } from "./campaign-board";
import { addDays, weekStart } from "./date";
import { dayLabel } from "./history";
import type { ShortcutId } from "./shortcuts";

/**
 * The card contract (DESIGN.md › Karten): a ring where the item can be done,
 * the card opens the editor, ▶ where measuring makes sense, and everything
 * else in one menu "Aktionen für …". This file answers, for any row of any
 * view, what can be done with it: what its steps act on (`targetOf`), its
 * menu (`rowMenu`) and its keys (`rowShortcuts`). A view describes the row
 * (`plannerRow`, `planRow`, `questRow`, `historyRow`, `dailyRow`);
 * `useRowActions` performs the steps and hands them over (`RowActions`).
 * When an entry or a key applies is decided here, never in the view.
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
  /** Planning it from the Questlog keeps its planned minutes. */
  plannedDurationMinutes: number | null;
  /** The server's rule: an open quest can be measured. */
  timerEligible: boolean;
  /** Itself a campaign: completing it asks first, its dialogs say so. */
  campaign: boolean;
  /** A card of the campaign board, in its column. */
  board?: { column: BoardColumn; blocked: boolean };
  /** A row of a campaign's tree: Löschen takes the quests below along. */
  tree?: boolean;
};

/** A daily's stored run. */
export type RunRow = {
  type: "run";
  occurrenceId: number;
  /** Its daily: the editor and Löschen are the daily's. */
  habitId: number;
  title: string;
  open: boolean;
  /** The day it stands on; null for one left behind (the Plan). */
  date: string | null;
  /** The last day it may move to; null once it may not move. */
  moveUntil: string | null;
  /** The server's `runRefusal`: an open run due by today, of an active daily. */
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
  | { type: "forecast"; habitId: number; title: string; open: boolean }
  | { type: "event"; title: string; open: boolean }
  | { type: "daily"; title: string; open: boolean };

/** A row of Heute and of the Fokus-Modus; the server says what can be measured. */
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
      plannedDurationMinutes: item.plannedDurationMinutes,
      timerEligible: item.timerEligible,
      campaign: item.campaign?.id === item.todoId,
    };
  return {
    type: "run",
    occurrenceId: item.occurrenceId,
    habitId: item.habitId,
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
 * day and can be measured while open (the server's rule; the read carries
 * no flag for quests); a run carries the server's flag.
 */
export function planRow(
  entry: WeekPlanTodoEntry | (WeekPlanHabitEntry & { occurrenceId: number }),
  date: string | null,
): QuestRow | RunRow;
export function planRow(entry: WeekPlanEntry, date: string | null): ActionRow;
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
      plannedDurationMinutes: entry.plannedDurationMinutes,
      timerEligible: open,
      campaign: entry.campaign?.id === entry.todoId,
    };
  if (entry.occurrenceId === null)
    return {
      type: "forecast",
      habitId: entry.habitId,
      title: entry.title,
      open,
    };
  return {
    type: "run",
    occurrenceId: entry.occurrenceId,
    habitId: entry.habitId,
    title: entry.title,
    open,
    date,
    moveUntil: entry.moveUntil,
    timerEligible: entry.timerEligible,
    monthChallenge: !!entry.monthChallenge,
  };
}

/**
 * A quest of the Questlog or of a campaign, with the server's flag;
 * `place` for the campaign pages, whose tree knows its campaigns itself.
 */
export function questRow(
  todo: {
    id: number;
    title: string;
    timerEligible: boolean;
    completed?: boolean;
    scheduledDate?: string | null;
    timeOfDay?: string | null;
    plannedDurationMinutes?: number | null;
    campaign?: { id: number } | null;
  },
  place: Partial<Pick<QuestRow, "board" | "tree" | "campaign">> = {},
): QuestRow {
  return {
    type: "quest",
    todoId: todo.id,
    title: todo.title,
    open: !todo.completed,
    date: todo.scheduledDate ?? null,
    timeOfDay: todo.timeOfDay ?? null,
    plannedDurationMinutes: todo.plannedDurationMinutes ?? null,
    timerEligible: todo.timerEligible,
    campaign: todo.campaign?.id === todo.id,
    ...place,
  };
}

/**
 * A planned row of the Kalender: it stands on the day it was scheduled
 * for. Its read carries no stopwatch flag, so the server's rule for the
 * Plan applies: an open quest, a stored run due by today. A run the
 * schedule only forecasts is a forecast; a row without its quest or daily
 * has no steps (null).
 */
export function historyRow(
  item: HistoryPlannedItem,
  today: string,
): ActionRow | null {
  const shared = { title: item.title, open: true };
  if (item.type === "todo")
    return item.id === null
      ? null
      : {
          ...shared,
          type: "quest",
          todoId: item.id,
          date: item.scheduledDate,
          timeOfDay: item.timeOfDay,
          plannedDurationMinutes: item.plannedDurationMinutes,
          timerEligible: true,
          campaign: item.campaign?.id === item.id,
        };
  if (item.habitId === null) return null;
  if (item.id === null)
    return { ...shared, type: "forecast", habitId: item.habitId };
  return {
    ...shared,
    type: "run",
    occurrenceId: item.id,
    habitId: item.habitId,
    date: item.scheduledDate,
    moveUntil: item.moveUntil,
    timerEligible: item.date <= today,
    monthChallenge: false,
  };
}

/** A Daily on the Dailies page. */
export function dailyRow(habit: { title: string }): ActionRow {
  return { type: "daily", title: habit.title, open: true };
}

/* What a step acts on */

/**
 * What a row's steps act on (tick, move, skip, stopwatch): its quest or
 * its stored run; null for a row without one.
 */
export function targetOf(row: QuestRow | RunRow): ItemTarget;
export function targetOf(row: ActionRow): ItemTarget | null;
export function targetOf(row: ActionRow): ItemTarget | null {
  if (row.type === "quest")
    return { kind: "todo", targetId: row.todoId, title: row.title };
  if (row.type === "run")
    return { kind: "occurrence", targetId: row.occurrenceId, title: row.title };
  return null;
}

/** ▶ of a row (ItemRow's `measure`): its target and whether it may start. */
export function measureOf(row: QuestRow | RunRow): {
  kind: ItemTarget["kind"];
  targetId: number;
  eligible: boolean;
} {
  const { kind, targetId } = targetOf(row);
  return { kind, targetId, eligible: row.timerEligible };
}

/** "Stoppuhr starten" in a menu; pauses or resumes a stopwatch already on it. */
type TimerStep = { run: () => void; label: string; disabled: boolean };

/** The stopwatch step for a card without ▶: the same toggle as ▶ and Space. */
function timerStep(
  controller: TimerController | null,
  target: ItemTarget,
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
type QuickMove = {
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
 * Where a quest or run can move without a dialog: today (when it is not on
 * today), tomorrow and next week's Monday, never into the past, never
 * beyond the last day a daily run may go to, never onto its own day.
 * Appointments move only through "Verschieben", where the move is confirmed.
 */
function movesOf(today: string, row: QuestRow | RunRow): QuickMove[] {
  if (row.type === "quest" && row.timeOfDay) return [];
  return QUICK_DAYS.map(({ label, shortcut, from }) => ({
    label,
    date: from(today),
    shortcut,
  })).filter(
    (move) =>
      move.date !== row.date &&
      move.date >= today &&
      (row.type === "quest" ||
        (row.moveUntil !== null && move.date <= row.moveUntil)),
  );
}

const MOVE_ICONS: Record<QuickMove["label"], MenuIcon> = {
  Heute: "today",
  Morgen: "tomorrow",
  "Nächste Woche": "calendar",
};

/** Quick moves as menu entries; `plan` names them for a quest without a day. */
function quickMoveEntries(
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

/** Where a moved row stands now, for its status line: "bei heute", "am Freitag, 4. Dez.". */
export function whereLabel(date: string, today: string): string {
  if (date === today) return "bei heute";
  if (date === addDays(today, 1)) return "bei morgen";
  return `am ${dayLabel(date)}`;
}

/* What a view can do */

/**
 * What can be done with one row: the row, today, whether it is busy, and
 * the steps on offer, as `useRowActions` performs them (the Dailies page
 * hands over its two). A step left out is not offered; when an offered
 * step shows as an entry or answers a key is decided by `rowMenu` and
 * `rowShortcuts`.
 */
export type RowActions = {
  row: ActionRow;
  today: string;
  /** A write or a dialog runs: every entry waits, every key passes. */
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
 * - an open quest or run gets the quick moves (`movesOf`), or the
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
          ? timerStep(actions.menuTimer, targetOf(row), row.timerEligible)
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

/** The steps a menu can offer, as `rowMenu` fills them in. */
type MenuSteps = {
  /** Heute, Morgen, Nächste Woche, from `quickMoveEntries`. */
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
 * set apart (every view offers it, with the editor's confirmation).
 */
function menuInOrder(
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
 * T, D or W on a row: it moves where the menu's quick move goes, never
 * onto the day it already has. An appointment opens "Anderer Tag …"
 * instead, where its move is confirmed; the board leaves an appointment be.
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
  const offered = movesOf(today, row).some((quick) => quick.date === date);
  return offered && move(date) !== false;
}

/**
 * The keys on a row, for the row the keyboard is on (`rowOf` its
 * `data-focus-key`; null where the view has no such row or holds it).
 * A busy row takes no key. Space starts, pauses or resumes the stopwatch of
 * an open quest or run, as its ▶ does; X completes an open row, a run once
 * it is due; T, D and W move it (`moveByKey`). A key that does not apply
 * returns false, so the key does what it did before.
 */
export function rowShortcuts(
  rowOf: (key: string | null) => RowActions | null,
  timer: TimerController | null,
): Partial<Record<ShortcutId, ShortcutHandler>> {
  const handlers: Partial<Record<ShortcutId, ShortcutHandler>> = {
    "row.timer": ({ key }) => {
      const actions = rowOf(key);
      if (!actions || actions.busy) return false;
      const { row } = actions;
      if (!row.open || (row.type !== "quest" && row.type !== "run"))
        return false;
      return toggleTimer(timer, targetOf(row), row.timerEligible);
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
