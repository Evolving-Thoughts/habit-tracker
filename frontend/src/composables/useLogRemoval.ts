import { ref } from "vue";
import { ApiError } from "../api/http";
import { deleteWorkLog } from "../api/work-logs.api";
import type { HistoryWorkLog } from "../types/history";

type HeldLog = { kind: "log"; id: number };
type WriteOptions = { key?: string; fallbackError: string };

/**
 * Deleting a Logbuch stretch behind the view's undo toast. The stretch
 * leaves the view at once; the DELETE waits until the offer ends (five
 * seconds, the next offer, leaving the view or the page), so "Rückgängig"
 * only shows it again: nothing was deleted, and its event in Google, its
 * source and its id stay as they were. The view owns the toast and its
 * writes; this keeps the hidden stretches and the held delete.
 */
export function useLogRemoval(
  offer: (target: HeldLog, label: string, commit: () => void) => void,
  write: (
    action: () => Promise<unknown>,
    options: WriteOptions,
  ) => Promise<boolean>,
) {
  const hiddenLogs = ref<ReadonlySet<number>>(new Set());

  function show(id: number, shown: boolean): void {
    const next = new Set(hiddenLogs.value);
    if (shown) next.delete(id);
    else next.add(id);
    hiddenLogs.value = next;
  }

  async function commit(id: number): Promise<void> {
    await write(
      async () => {
        try {
          await deleteWorkLog(id);
        } catch (cause) {
          // Already gone, e.g. deleted on another device: what was asked for.
          if (!(cause instanceof ApiError && cause.status === 404)) throw cause;
        }
      },
      {
        key: `log-${id}`,
        fallbackError: "Der Abschnitt konnte nicht gelöscht werden.",
      },
    );
    // Gone after the reload, or back in view next to the error.
    show(id, true);
  }

  /** Takes the stretch out of view and holds its delete behind the toast. */
  function removeLog(log: HistoryWorkLog): void {
    show(log.id, false);
    offer(
      { kind: "log", id: log.id },
      `Abschnitt „${log.title}“ gelöscht`,
      () => void commit(log.id),
    );
  }

  /** "Rückgängig": the held delete never went out; the stretch comes back. */
  function restoreLog(id: number): void {
    show(id, true);
  }

  return { hiddenLogs, removeLog, restoreLog };
}
