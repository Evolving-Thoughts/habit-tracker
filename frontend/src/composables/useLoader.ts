import {
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Ref,
  type WatchSource,
} from "vue";
import { onDataChanged } from "./data-sync";

/**
 * Loads view data with the rules every view needs: only the latest request
 * may write its result, a background refresh keeps the page visible, and
 * the view refreshes after data changes elsewhere unless it is busy. A newer
 * request or leaving the view aborts the running one.
 */
export function useLoader<T>(
  load: (signal: AbortSignal) => Promise<T>,
  options: {
    initial: T;
    fallbackError: string;
    /** Return false while editing/saving to skip a background refresh. */
    refreshOnChange?: () => boolean;
    /** What the request depends on: a change loads again with the page state. */
    params?: WatchSource[];
    /** Drops the old result while a new page load runs. */
    resetOnLoad?: boolean;
  },
) {
  const data = ref(options.initial) as Ref<T>;
  const isLoading = ref(true);
  const hasLoaded = ref(false);
  const errorMessage = ref<string | null>(null);
  let generation = 0;
  let abort: AbortController | undefined;

  async function reload(showPageLoading = true): Promise<void> {
    const current = ++generation;
    abort?.abort();
    abort = new AbortController();
    if (showPageLoading) {
      isLoading.value = true;
      if (options.resetOnLoad) data.value = options.initial;
    }
    errorMessage.value = null;
    try {
      const result = await load(abort.signal);
      if (current !== generation) return;
      data.value = result;
      hasLoaded.value = true;
    } catch (error: unknown) {
      if (current !== generation) return;
      errorMessage.value =
        error instanceof Error ? error.message : options.fallbackError;
    } finally {
      if (current === generation) isLoading.value = false;
    }
  }

  onMounted(() => reload());
  onUnmounted(() => {
    generation += 1;
    abort?.abort();
  });
  if (options.params) watch(options.params, () => void reload());
  const refreshOnChange = options.refreshOnChange;
  if (refreshOnChange)
    onDataChanged(() => {
      if (refreshOnChange()) void reload(false);
    });

  return { data, isLoading, hasLoaded, errorMessage, reload };
}
