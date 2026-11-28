import type { Ref } from "vue";
import { planQuest } from "../api/questlog.api";
import type { DeleteTarget } from "../components/DeleteItemDialog.vue";
import type { MoveTarget } from "../components/MoveItemDialog.vue";
import { fullStop } from "../utils/history";
import {
  rowMenu,
  rowShortcuts,
  targetOf,
  whereLabel,
  type ActionRow,
  type MenuEntry,
  type QuestRow,
  type RowActions,
  type RunRow,
} from "../utils/row-actions";
import type { EditTarget, RowDialogs } from "./useRowDialogs";
import type { useTicks } from "./useTicks";
import type { TimerController } from "./useTimer";

type Ticks = Pick<
  ReturnType<typeof useTicks>,
  "complete" | "reopen" | "skip" | "move"
>;

/** The campaign board's column steps: they replace the plain ones. */
type BoardSteps = Pick<
  RowActions,
  | "move"
  | "pickDay"
  | "unplan"
  | "complete"
  | "startWork"
  | "setAside"
  | "toggleBlocked"
>;

/** A row as a view hands it over: its `data-focus-key`, what it is, and what only the view can do. */
export type RowCall = {
  key: string;
  row: ActionRow;
  /** One place up or down in the view's order; undefined at its end. */
  step?: RowActions["step"];
  /** The focus card's way into the Fokus-Modus. */
  focusMode?: () => void;
  /** "Zur Monats-Challenge" on the challenge's run. */
  openChallenge?: () => void;
  /** "Unter-Quest hinzufügen" in a campaign's tree. */
  addChild?: () => void;
  /** The card has no ▶: its menu carries the stopwatch. */
  menuTimer?: boolean;
  /** The board's days instead of Heute, Morgen, Nächste Woche (the Plan's Questlog column). */
  planDays?: RowActions["planDays"];
  /** The view's own bookkeeping once a tick of this row went through (true) or was taken back. */
  ticked?: (done: boolean) => void;
  boardSteps?: BoardSteps;
};

/** Where "Anderer Tag …" puts the focus for a quest without a day: its editor's day field. */
const DAY_FIELD = 'input[name="scheduledDate"]';

/**
 * The steps every row of every view takes, performed once: complete,
 * reopen, skip, a quick move, "Anderer Tag …", the editor, "In Kampagne
 * verschieben …", Löschen and the stopwatch. A view hands over what it
 * has; a step whose means is missing is not offered (no `ticks`: no tick,
 * skip or move, by key or dialog; no `dialogs`: no dialog). The rules:
 * - a step runs only while its row is not busy: the view's own reasons
 *   (`busy`), a dialog saving, or a write under the row's write key (the
 *   row's key, or the view's one `writeKey`);
 * - completing a quest that is itself a campaign asks first (`useTicks`);
 * - X, "Erledigen", a move and Überspringen run inside the focus wrap
 *   (`useListFocus().around`): the row usually leaves, the focus follows;
 * - a move goes the view's own way where it has one for that day
 *   (`moveWithin`, the Plan's board), else a quest without a day is
 *   planned with the Questlog's save and anything else is rescheduled;
 *   then the status line says "„X“ steht jetzt bei heute/bei morgen/am
 *   <Tag>." (`said`);
 * - Überspringen says "„X“ übersprungen.";
 * - "Anderer Tag …" opens the move dialog, offering today to a row not on
 *   today; a quest without a day picks its day in its editor instead;
 * - error texts are `useTicks`' own, by kind.
 */
export function useRowActions(means: {
  today: () => string;
  /** The view's session: its write keys and the Questlog's save. */
  session?: {
    write: (
      action: () => Promise<unknown>,
      options: { key?: string; fallbackError: string },
    ) => Promise<boolean>;
    isWriting: (key: string) => boolean;
  };
  ticks?: Ticks;
  /** The view's list focus; without it the focus stays where it was. */
  focus?: {
    around: (key: string, action: () => Promise<unknown>) => Promise<void>;
  };
  dialogs?: Pick<RowDialogs, "edit" | "reparent" | "remove"> &
    Partial<Pick<RowDialogs, "pickDay">> & { busy?: Readonly<Ref<boolean>> };
  timer?: TimerController | null;
  /** The view's status line. */
  said?: (line: string) => void;
  /** The view's own reasons to hold every row, such as a first load. */
  busy?: () => boolean;
  /** One write key for every row (the Plan serialises its moves). */
  writeKey?: string;
  /** The view's own way onto `date`, where it has one (the Plan's board). */
  moveWithin?: (
    row: QuestRow | RunRow,
    date: string,
  ) => (() => Promise<unknown>) | null;
}) {
  const { ticks, dialogs, session } = means;
  const keyOf = (key: string): string => means.writeKey ?? key;

  /** Whether a row's steps wait. */
  function busy(key: string): boolean {
    return (
      !!means.busy?.() ||
      !!dialogs?.busy?.value ||
      !!session?.isWriting(keyOf(key))
    );
  }

  function around(key: string, action: () => Promise<unknown>): void {
    void (means.focus ? means.focus.around(key, action) : action());
  }

  /** Done; a quest that is itself a campaign asks first. */
  async function complete(call: RowCall): Promise<boolean> {
    const { key, row } = call;
    if (!ticks || !isItem(row) || busy(key)) return false;
    const done = await ticks.complete(targetOf(row), {
      key: keyOf(key),
      campaign: row.type === "quest" && row.campaign ? "lookup" : undefined,
      onUndone: call.ticked && (() => call.ticked!(false)),
    });
    if (done) call.ticked?.(true);
    return done;
  }

  /** The ring: done, or open again (straight away, without a toast). */
  async function tick(call: RowCall): Promise<boolean> {
    const { key, row } = call;
    if (!ticks || !isItem(row) || busy(key)) return false;
    if (row.open) return complete(call);
    const reopened = await ticks.reopen(targetOf(row), { key: keyOf(key) });
    if (reopened) call.ticked?.(false);
    return reopened;
  }

  /** Onto `date` without a dialog; false where the row waits. */
  function move(call: RowCall, date: string): boolean {
    const { key, row } = call;
    if (!ticks || !isItem(row) || busy(key)) return false;
    const own = means.moveWithin?.(row, date);
    around(key, async () => {
      if (own) return own();
      const moved =
        row.type === "quest" && row.date === null && session
          ? await session.write(
              () =>
                planQuest(
                  {
                    id: row.todoId,
                    title: row.title,
                    plannedDurationMinutes: row.plannedDurationMinutes,
                  },
                  date,
                ),
              {
                key: keyOf(key),
                fallbackError: "Die Quest konnte nicht eingeplant werden.",
              },
            )
          : await ticks.move(targetOf(row), date, { key: keyOf(key) });
      if (moved)
        means.said?.(
          fullStop(`„${row.title}“ steht jetzt ${whereLabel(date, means.today())}`),
        );
    });
    return true;
  }

  /** "Überspringen": this run is left out, the daily goes on. */
  function skip(call: RowCall): void {
    const { key, row } = call;
    if (!ticks || row.type !== "run" || busy(key)) return;
    around(key, async () => {
      if (await ticks.skip(targetOf(row), keyOf(key)))
        means.said?.(`„${row.title}“ übersprungen.`);
    });
  }

  /** "Anderer Tag …"; a quest without a day gets its day in the editor. */
  function pickDay(call: RowCall): void {
    const { key, row } = call;
    if (!dialogs || !isItem(row)) return;
    if (row.type === "quest" && row.date === null)
      dialogs.edit(key, { ...editTargetOf(row), focus: DAY_FIELD });
    else
      dialogs.pickDay?.(key, moveTargetOf(row), {
        offerToday: row.date !== means.today(),
      });
  }

  /** The row's editor: a quest's, or its daily's with this run's notes. */
  function edit(call: RowCall): void {
    const target = editTargetOf(call.row);
    if (dialogs && target) dialogs.edit(call.key, target);
  }

  /** What can be done with a row, for `rowMenu` and `rowShortcuts`. */
  function of(call: RowCall): RowActions {
    const { key, row } = call;
    const item = isItem(row);
    const removal = deleteTargetOf(row);
    return {
      row,
      today: means.today(),
      busy: busy(key),
      move: ticks && item ? (date) => move(call, date) : undefined,
      pickDay:
        ticks && dialogs?.pickDay && item ? () => pickDay(call) : undefined,
      complete:
        ticks && item ? () => around(key, () => complete(call)) : undefined,
      skip: ticks && row.type === "run" ? () => skip(call) : undefined,
      edit: dialogs && editTargetOf(row) ? () => edit(call) : undefined,
      reparent:
        dialogs && row.type === "quest"
          ? () =>
              dialogs.reparent(key, { todoId: row.todoId, title: row.title })
          : undefined,
      remove:
        dialogs && removal ? () => dialogs.remove(key, removal) : undefined,
      menuTimer: call.menuTimer ? (means.timer ?? null) : undefined,
      planDays: call.planDays,
      focusMode: call.focusMode,
      openChallenge: call.openChallenge,
      addChild: call.addChild,
      step: call.step,
      ...call.boardSteps,
    };
  }

  return {
    of,
    /** A row's "Aktionen für …"; `past` for an appointment that is over but open. */
    menu: (call: RowCall, options?: { past?: boolean }): MenuEntry[] =>
      rowMenu(of(call), options),
    /** The row keys, for the row `rowOf` finds under a `data-focus-key`. */
    shortcuts: (rowOf: (key: string | null) => RowCall | null) =>
      rowShortcuts((key) => {
        const call = rowOf(key);
        return call ? of(call) : null;
      }, means.timer ?? null),
    tick,
    edit,
    busy,
  };
}

export type RowActionsOf = ReturnType<typeof useRowActions>;

function isItem(row: ActionRow): row is QuestRow | RunRow {
  return row.type === "quest" || row.type === "run";
}

/** A row's editor: a quest's, or its daily's with this run's notes; null for an event or a Daily. */
function editTargetOf(row: QuestRow): EditTarget;
function editTargetOf(row: ActionRow): EditTarget | null;
function editTargetOf(row: ActionRow): EditTarget | null {
  if (row.type === "quest")
    return row.campaign
      ? { kind: "todo", id: row.todoId, campaign: true }
      : { kind: "todo", id: row.todoId };
  if (row.type === "run")
    return { kind: "habit", id: row.habitId, occurrenceId: row.occurrenceId };
  if (row.type === "forecast")
    return { kind: "habit", id: row.habitId, occurrenceId: null };
  return null;
}

/** What a row's Löschen deletes: the quest, or its whole daily. */
function deleteTargetOf(row: ActionRow): DeleteTarget | null {
  if (row.type === "quest")
    return row.campaign
      ? { kind: "todo", id: row.todoId, title: row.title, campaign: true }
      : { kind: "todo", id: row.todoId, title: row.title };
  if (row.type === "run" || row.type === "forecast")
    return { kind: "habit", id: row.habitId, title: row.title };
  return null;
}

/** What "Anderer Tag …" moves: a quest (an appointment confirms) or a stored run. */
function moveTargetOf(row: QuestRow | RunRow): MoveTarget {
  return row.type === "quest"
    ? {
        type: "todo",
        todoId: row.todoId,
        title: row.title,
        timeOfDay: row.timeOfDay,
      }
    : {
        type: "habit",
        occurrenceId: row.occurrenceId,
        title: row.title,
        moveUntil: row.moveUntil,
      };
}
