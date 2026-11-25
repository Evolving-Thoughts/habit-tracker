import {
  timerStateOf,
  type TimerController,
} from "../composables/useTimer";
import type { ShortcutId } from "./shortcuts";
import { addDays, weekStart } from "./date";

/**
 * The card contract (DESIGN.md › Karten): a ring where the item can be done,
 * the card opens the editor, ▶ where measuring makes sense, and everything
 * else in one menu "Aktionen für …". This file holds what the menus share,
 * and `rowMenu` puts every view's entries in the one order.
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
  | "challenge";

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

/** A day an item can go to in one tap, with the key that does the same. */
export type QuickMove = {
  label: "Heute" | "Morgen" | "Nächste Woche";
  date: string;
  shortcut: ShortcutId;
};

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
  const moves: QuickMove[] = [
    { label: "Heute", date: today, shortcut: "row.today" },
    { label: "Morgen", date: addDays(today, 1), shortcut: "row.tomorrow" },
    {
      label: "Nächste Woche",
      date: addDays(weekStart(today), 7),
      shortcut: "row.nextWeek",
    },
  ];
  return moves.filter(
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

/** "Stoppuhr starten" in a menu; pauses or resumes a stopwatch already on it. */
export type TimerStep = { run: () => void; label: string; disabled: boolean };

/**
 * The stopwatch step for a card without ▶ (the Plan's compact rows, an open
 * campaign's card): the same toggle as ▶ and Space.
 */
export function timerStep(
  controller: TimerController | null,
  target: { kind: "todo" | "occurrence"; targetId: number; title: string },
  eligible: boolean,
): TimerStep {
  const own = timerStateOf(controller, target.kind, target.targetId);
  return {
    label:
      own === "running"
        ? "Stoppuhr pausieren"
        : own === "paused"
          ? "Stoppuhr fortsetzen"
          : "Stoppuhr starten",
    disabled: !controller || controller.busy.value || (!own && !eligible),
    run: () => {
      if (!controller) return;
      if (own) void controller.action(own === "running" ? "pause" : "resume");
      else void controller.start(target);
    },
  };
}

/** The steps a card's menu can offer; each view fills in what applies. */
export type RowMenuSteps = {
  /** Heute, Morgen, Nächste Woche, from \`quickMoveEntries\`. */
  quickMoves?: MenuEntry[];
  /** Picks a day; an appointment's move is confirmed ("Termin verschieben …"). */
  otherDay?: { run: () => void; appointment?: boolean; plan?: boolean };
  /** A daily's run: skip it for this day. */
  skip?: () => void;
  edit?: () => void;
  focusMode?: () => void;
  timer?: TimerStep;
  child?: () => void;
  /** "In Kampagne verschieben …": below a campaign or one of its quests. */
  reparent?: () => void;
  /** "Zur Monats-Challenge": the Daily that carries this month's challenge. */
  challenge?: () => void;
  up?: () => void;
  down?: () => void;
  remove?: { run: () => void; ariaLabel?: string };
};

/**
 * Every card's menu in the one order: quick moves, "Anderer Tag …",
 * Überspringen, Bearbeiten, Fokus-Modus, Stoppuhr, Unter-Quest,
 * "In Kampagne verschieben …", "Zur Monats-Challenge", Nach oben / Nach
 * unten, and Löschen last,
 * set apart (every view offers it, with the editor's confirmation).
 */
export function rowMenu(
  title: string,
  steps: RowMenuSteps,
  disabled = false,
): MenuEntry[] {
  const entries: MenuEntry[] = [...(steps.quickMoves ?? [])];
  const add = (entry: Omit<MenuEntry, "disabled"> & { disabled?: boolean }) =>
    entries.push({ ...entry, disabled: disabled || entry.disabled });
  const { otherDay, timer, remove } = steps;
  if (otherDay)
    add({
      id: "move",
      label: otherDay.appointment ? "Termin verschieben …" : "Anderer Tag …",
      icon: "move",
      ariaLabel: otherDay.plan
        ? `Tag für ${title} wählen`
        : `${title} verschieben`,
      run: otherDay.run,
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
