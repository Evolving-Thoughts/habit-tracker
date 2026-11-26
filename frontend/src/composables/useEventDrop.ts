import type { Ref } from "vue";
import { reorderDay } from "../api/day-planner.api";
import type { WeekPlanResponse } from "../types/week-plan";
import {
  dropEventOnDay,
  dropForecastOnDay,
  type EventDrop,
  type ForecastDrop,
  type OrderRef,
} from "../utils/week-plan";
import type { useWrites } from "./useWrites";

type Options = { key: string; said: (line: string) => void };

/**
 * An entry that sorts only within its own day, for every view that shows
 * the Plan's days (the Plan, Heute's other days): shown at once, then the
 * day's order is written; a failure takes it back. `arrange` is the Plan's
 * rule for that kind of entry; the view only says what it tells the screen
 * reader.
 */
function useSameDayDrop<D>(
  plan: Ref<WeekPlanResponse | null>,
  writes: ReturnType<typeof useWrites>,
  options: Options,
  arrange: (
    plan: WeekPlanResponse,
    drop: D,
  ) => { plan: WeekPlanResponse; order: OrderRef[] } | null,
  words: { done: string; failed: string },
): (drop: D) => Promise<boolean> {
  return async (drop) => {
    const before = plan.value;
    if (!before || writes.busy.value) return false;
    const result = arrange(before, drop);
    if (!result) return false;
    return writes.writeShown(
      () => {
        plan.value = result.plan;
        options.said(words.done);
        return () => {
          plan.value = before;
          options.said("");
        };
      },
      () => reorderDay(result.order),
      { key: options.key, fallbackError: words.failed },
    );
  };
}

/** A Google event sorted within its day; its time stays (`dropEventOnDay`). */
export function useEventDrop(
  plan: Ref<WeekPlanResponse | null>,
  writes: ReturnType<typeof useWrites>,
  options: Options,
): (drop: EventDrop) => Promise<boolean> {
  return useSameDayDrop(plan, writes, options, dropEventOnDay, {
    done: "Termin einsortiert, seine Uhrzeit bleibt.",
    failed: "Der Termin konnte nicht einsortiert werden.",
  });
}

/**
 * A daily's forecast run sorted within its later day (`dropForecastOnDay`):
 * its place waits for the day that stores the run.
 */
export function useForecastDrop(
  plan: Ref<WeekPlanResponse | null>,
  writes: ReturnType<typeof useWrites>,
  options: Options,
): (drop: ForecastDrop) => Promise<boolean> {
  return useSameDayDrop(plan, writes, options, dropForecastOnDay, {
    done: "Daily einsortiert.",
    failed: "Die Reihenfolge konnte nicht gespeichert werden.",
  });
}
