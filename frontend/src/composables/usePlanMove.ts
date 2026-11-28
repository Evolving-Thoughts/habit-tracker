import type { Ref } from "vue";
import { reorderBacklog, reorderDay } from "../api/day-planner.api";
import { planQuest, unplanQuest } from "../api/questlog.api";
import type { WeekPlanEntry, WeekPlanResponse } from "../types/week-plan";
import {
  planMove,
  stepDrop,
  windowLine,
  type BoardDrop,
  type MoveWords,
  type MoveWrite,
} from "../utils/plan-move";
import { isMovableRun, type QuestlogQuest } from "../utils/week-plan";
import { writeMove } from "./useTicks";
import type { useWrites } from "./useWrites";

type Options = {
  /** The view's busy key for its moves. */
  key: string;
  words: MoveWords;
  /** The status line for the screen reader; "" once a move is taken back. */
  said: (line: string) => void;
  /** Said in sight when a move may not land, and why. */
  refused: (line: string) => void;
};

/** Sends a move's writes one after another, in the order the move gives. */
async function send(writes: readonly MoveWrite[]): Promise<void> {
  for (const write of writes) {
    if (write.type === "move")
      await writeMove(write.target, write.date, write.confirmFixed);
    else if (write.type === "plan") await planQuest(write.quest, write.date);
    else if (write.type === "unplan") await unplanQuest(write.todoId);
    else if (write.type === "order-day") await reorderDay(write.order);
    else await reorderBacklog(write.order);
  }
}

/**
 * "Move this entry there" for every view that shows the Plan's days (the
 * Plan, Heute's other days): `move` takes a drop from a drag, the menu or a
 * key, shows its result at once (`planMove`), sends its writes in order and
 * takes the result back on failure; a refused move only says why. `step`
 * is "Nach oben" / "Nach unten" and the arrow keys on the shown days.
 * `backlog` is the Questlog column, where the view has one.
 */
export function usePlanMove(
  board: {
    plan: Ref<WeekPlanResponse | null>;
    backlog?: Ref<QuestlogQuest[]>;
  },
  writes: Pick<ReturnType<typeof useWrites>, "busy" | "writeShown">,
  options: Options,
) {
  /** Resolves to whether the move landed and was written. */
  async function move(drop: BoardDrop): Promise<boolean> {
    const plan = board.plan.value;
    if (!plan || writes.busy.value) return false;
    const backlog = board.backlog?.value ?? [];
    const outcome = planMove({ plan, backlog }, drop, options.words);
    if (!outcome) return false;
    if ("refused" in outcome) {
      options.refused(outcome.refused);
      return false;
    }
    return writes.writeShown(
      () => {
        board.plan.value = outcome.plan;
        if (board.backlog && outcome.backlog)
          board.backlog.value = outcome.backlog;
        options.said(outcome.line);
        return () => {
          board.plan.value = plan;
          if (board.backlog && outcome.backlog) board.backlog.value = backlog;
          options.said("");
        };
      },
      () => send(outcome.writes),
      { key: options.key, fallbackError: outcome.fallbackError },
    );
  }

  /**
   * A step of an open quest or run within `shown` (the days in view).
   * Resolves to whether a move was tried; a run stepped sideways out of its
   * window stays and says how far it may go.
   */
  async function step(
    entry: WeekPlanEntry,
    direction: "up" | "down" | "left" | "right",
    shown: WeekPlanResponse,
  ): Promise<boolean> {
    const drop = stepDrop(shown, entry, direction);
    if (drop) {
      await move(drop);
      return true;
    }
    if (isMovableRun(entry) && (direction === "left" || direction === "right"))
      options.refused(windowLine(entry, shown.today, options.words));
    return false;
  }

  return { move, step };
}
