import type { ShortcutId } from "./shortcuts";
import { addDays, weekStart } from "./date";

/**
 * The row contract (DESIGN.md › Zeilen): a ring where the item can be done,
 * the title opens the editor, ▶ where measuring makes sense, and everything
 * else in one menu "Aktionen für …". This file holds what the menus share.
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
  | "chart"
  | "timer"
  | "trash"
  | "check"
  | "stop";

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
