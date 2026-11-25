import type { Ref } from "vue";
import { reorderDay } from "../api/day-planner.api";
import type { WeekPlanResponse } from "../types/week-plan";
import { dropEventOnDay, type EventDrop } from "../utils/week-plan";
import type { useWrites } from "./useWrites";

/**
 * A Google event dragged within its day, for every view that shows the
 * Plan's days (the Plan, Heute's other days): shown at once, then the day's
 * order is written; a failure takes it back. The rule is the Plan's
 * (\`dropEventOnDay\`); the view only says what it tells the screen reader.
 */
export function useEventDrop(
  plan: Ref<WeekPlanResponse | null>,
  writes: ReturnType<typeof useWrites>,
  options: { key: string; said: (line: string) => void },
): (drop: EventDrop) => Promise<boolean> {
  return async (drop) => {
    const before = plan.value;
    if (!before || writes.busy.value) return false;
    const result = dropEventOnDay(before, drop);
    if (!result) return false;
    return writes.writeShown(
      () => {
        plan.value = result.plan;
        options.said("Termin einsortiert, seine Uhrzeit bleibt.");
        return () => {
          plan.value = before;
          options.said("");
        };
      },
      () => reorderDay(result.order),
      {
        key: options.key,
        fallbackError: "Der Termin konnte nicht einsortiert werden.",
      },
    );
  };
}
