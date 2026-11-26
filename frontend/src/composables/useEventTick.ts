import type { Ref } from "vue";
import { setEventDone } from "../api/day-planner.api";
import type { useWrites } from "./useWrites";

/**
 * A Google event ticked off in a day's list, or opened again: the same step
 * in Heute and on its other days. The tick shows at once (`mark` gives the
 * view's data with it), then it is written; a failure takes it back. Only
 * the app keeps the tick, the event in Google stays as it is.
 */
export function useEventTick<T>(
  data: Ref<T | null>,
  writes: ReturnType<typeof useWrites>,
  mark: (data: T, eventId: number, done: boolean) => T,
  said: (line: string) => void,
): (event: { id: number; title: string }, done: boolean) => Promise<boolean> {
  return async (event, done) => {
    const before = data.value;
    if (!before || writes.isWriting(`event-${event.id}`)) return false;
    return writes.writeShown(
      () => {
        data.value = mark(before, event.id, done);
        said(
          done
            ? `„${event.title}“ abgehakt.`
            : `„${event.title}“ ist wieder offen.`,
        );
        return () => {
          data.value = before;
          said("");
        };
      },
      () => setEventDone(event.id, done),
      {
        key: `event-${event.id}`,
        fallbackError: done
          ? "Der Termin konnte nicht abgehakt werden."
          : "Der Termin konnte nicht wieder geöffnet werden.",
      },
    );
  };
}
