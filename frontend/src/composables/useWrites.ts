import { computed, ref, type Ref } from "vue";
import { notifyDataChanged } from "./data-sync";

type WriteOptions = {
  fallbackError: string;
  /** Separate writes run side by side; the same key runs once at a time. */
  key?: string;
  /** Who hears about the change; null if the action announces it itself. */
  notify?: (() => void) | null;
};

/**
 * The one order every view writes in: guard against a double start, clear the
 * error, write, tell the others, reload quietly, then report the outcome.
 * `reload` belongs to the view; the view's own refresh guard should check
 * `busy`, so the announcement does not fetch a second time.
 */
export function useWrites(
  reload: (showPageLoading?: boolean) => Promise<void>,
  errorMessage: Ref<string | null>,
) {
  const writing = ref<string[]>([]);
  const busy = computed(() => writing.value.length > 0);

  const isWriting = (key: string): boolean => writing.value.includes(key);

  /** After a child dialog wrote on its own. */
  async function applied(notify: () => void = notifyDataChanged): Promise<void> {
    notify();
    await reload(false);
  }

  /** Resolves to whether the write went through. */
  async function write(
    action: () => Promise<unknown>,
    { fallbackError, key = "", notify = notifyDataChanged }: WriteOptions,
  ): Promise<boolean> {
    if (isWriting(key)) return false;
    writing.value.push(key);
    errorMessage.value = null;
    try {
      await action();
      await applied(notify ?? (() => undefined));
      return true;
    } catch (error: unknown) {
      errorMessage.value =
        error instanceof Error ? error.message : fallbackError;
      return false;
    } finally {
      writing.value = writing.value.filter((item) => item !== key);
    }
  }

  return { write, applied, busy, isWriting };
}
