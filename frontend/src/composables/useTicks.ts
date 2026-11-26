import {
  rescheduleOccurrence,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { withActionSound } from "./action-sounds";
import { useCampaignCompletion } from "./useCampaignCompletion";
import { useUndo } from "./useUndo";

/**
 * What a ring, a quick move or "Überspringen" acts on: a quest or one run
 * of a daily. Views map their own rows onto it; it has the shape of a
 * stopwatch target (`TimerTarget`).
 */
export type TickTarget = {
  kind: "todo" | "occurrence";
  id: number;
  title: string;
};

type Write = (
  action: () => Promise<unknown>,
  options: { key?: string; fallbackError: string },
) => Promise<boolean>;

/**
 * Ticks a target done or open again, through its own endpoint. Every
 * completion in the app runs through here (rings, X, the stopwatch bar,
 * the Fokus-Modus, the calendar), so this is where it sounds: "Erledigt",
 * or the milestone sound when it completed the Perfect Week or the
 * Monats-Challenge, or its stopwatch ended at the weekly quest-hours goal
 * (`action-sounds.ts`). Opening again, undo included, stays silent.
 */
export function writeDone(target: TickTarget, done: boolean): Promise<void> {
  if (!done)
    return target.kind === "todo"
      ? updateTodoCompletion(target.id, false)
      : updateOccurrenceStatus(target.id, "pending");
  return withActionSound(
    () =>
      target.kind === "todo"
        ? updateTodoCompletion(target.id, true)
        : updateOccurrenceStatus(target.id, "completed"),
    {
      sound: "chime-done",
      kinds:
        target.kind === "todo"
          ? ["perfect-week", "quest-hours"]
          : ["perfect-week", "month-challenge", "quest-hours"],
    },
  );
}

/** Moves a target onto `date` without a dialog. */
/**
 * Moves a quest or run to `date`. `confirmFixed` moves an appointment too,
 * keeping its time (a drop on a day says so plainly; the menu asks first).
 */
export function writeMove(
  target: TickTarget,
  date: string,
  confirmFixed = false,
): Promise<unknown> {
  return target.kind === "todo"
    ? rescheduleTodo(target.id, date, confirmFixed)
    : rescheduleOccurrence(target.id, date);
}

/** The toast's line: a campaign with open quests is "abgeschlossen". */
export function tickLabel(title: string, openQuests = 0): string {
  return openQuests > 0 ? `„${title}“ abgeschlossen` : `„${title}“ erledigt`;
}

const UNDO_FAILED = "Das Rückgängigmachen hat nicht geklappt.";

function failedText(target: TickTarget, verb: string): string {
  return target.kind === "todo"
    ? `Die Quest konnte nicht ${verb} werden.`
    : `Das Daily konnte nicht ${verb} werden.`;
}

type HeldTick = {
  kind: "tick";
  target: TickTarget;
  key?: string;
  onUndone?: () => void;
};
/** Something else behind the same toast, e.g. a held Logbuch delete. */
type HeldOther = { kind: "log"; id: number };
export type Held = HeldTick | HeldOther;

export type CompleteOptions = {
  /** The view's busy key for this row. */
  key?: string;
  fallbackError?: string;
  /**
   * The target is a campaign: the number of its open quests when the view
   * knows it, "lookup" to read the tree first. A campaign with open quests
   * asks before it is completed.
   */
  campaign?: number | "lookup";
  /** Runs once it is decided to go ahead, right before the write. */
  onConfirmed?: () => void;
  /** Runs after the toast took the completion back. */
  onUndone?: () => void;
};

/**
 * Completing, reopening, skipping and moving a quest or a daily run, the
 * way every view with a ring does it: one write per row key, the campaign
 * question, the undo toast with its five seconds and the texts on failure.
 *
 * `write` is the view's write (`useWrites().write`, or a view's own wrapper
 * with the same contract). The view renders `undo` in its `UndoToast` and
 * `campaignQuestion` in its `CampaignCompletionDialog`, wired to `undoLast`
 * and `answerCampaign`. Other undoable steps share the toast through
 * `offerUndo` (a held Logbuch delete); `undoLast` hands those to
 * `onOtherUndo`.
 */
export function useTicks(
  write: Write,
  { onOtherUndo }: { onOtherUndo?: (held: HeldOther) => void } = {},
) {
  const campaigns = useCampaignCompletion();
  const { undo, offer: offerUndo, take, flush } = useUndo<Held>();

  /** Resolves to whether it went through (false if a campaign said no). */
  async function complete(
    target: TickTarget,
    options: CompleteOptions = {},
  ): Promise<boolean> {
    const { key, campaign, onUndone } = options;
    const open =
      target.kind !== "todo" || campaign === undefined
        ? 0
        : campaign === "lookup"
          ? await campaigns.openQuestsBelow(target.id)
          : campaign;
    if (!(await campaigns.confirm(target.title, open))) return false;
    options.onConfirmed?.();
    const done = await write(() => writeDone(target, true), {
      key,
      fallbackError: options.fallbackError ?? failedText(target, "erledigt"),
    });
    if (done)
      offerUndo(
        { kind: "tick", target, key, onUndone },
        tickLabel(target.title, open),
      );
    return done;
  }

  /** A completed target open again, straight away and without a toast. */
  function reopen(
    target: TickTarget,
    { key, fallbackError }: { key?: string; fallbackError?: string } = {},
  ): Promise<boolean> {
    return write(() => writeDone(target, false), {
      key,
      fallbackError: fallbackError ?? failedText(target, "aktualisiert"),
    });
  }

  /** "Überspringen": this run is left out, the daily goes on. */
  function skip(target: TickTarget, key?: string): Promise<boolean> {
    return write(() => updateOccurrenceStatus(target.id, "skipped"), {
      key,
      fallbackError: "Das Daily konnte nicht übersprungen werden.",
    });
  }

  function move(
    target: TickTarget,
    date: string,
    {
      key,
      fallbackError,
      confirmFixed = false,
    }: { key?: string; fallbackError?: string; confirmFixed?: boolean } = {},
  ): Promise<boolean> {
    return write(() => writeMove(target, date, confirmFixed), {
      key,
      fallbackError: fallbackError ?? failedText(target, "verschoben"),
    });
  }

  /** The toast's "Rückgängig". */
  async function undoLast(): Promise<void> {
    const held = take();
    if (!held) return;
    if (held.kind !== "tick") return onOtherUndo?.(held);
    const { target } = held;
    const done = await write(() => writeDone(target, false), {
      key: held.key ?? `undo-${target.kind}-${target.id}`,
      fallbackError: UNDO_FAILED,
    });
    if (done) held.onUndone?.();
  }

  return {
    complete,
    reopen,
    skip,
    move,
    undo,
    undoLast,
    offerUndo,
    flushUndo: flush,
    campaignQuestion: campaigns.question,
    answerCampaign: campaigns.reply,
  };
}
