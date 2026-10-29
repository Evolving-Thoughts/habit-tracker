import { onMounted, ref, type Ref } from "vue";
import { onDataChanged } from "./data-sync";

/**
 * Loads view data with the rules every view needs: only the latest request
 * may write its result, a background refresh keeps the page visible, and
 * the view refreshes after data changes elsewhere unless it is busy.
 */
export function useLoader<T>(
  load: () => Promise<T>,
  options: {
    initial: T;
    fallbackError: string;
    /** Return false while editing/saving to skip a background refresh. */
    refreshOnChange?: () => boolean;
  },
) {
  const data = ref(options.initial) as Ref<T>;
  const isLoading = ref(true);
  const hasLoaded = ref(false);
  const errorMessage = ref<string | null>(null);
  let generation = 0;

  async function reload(showPageLoading = true): Promise<void> {
    const current = ++generation;
    if (showPageLoading) isLoading.value = true;
    errorMessage.value = null;
    try {
      const result = await load();
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
  const refreshOnChange = options.refreshOnChange;
  if (refreshOnChange)
    onDataChanged(() => {
      if (refreshOnChange()) void reload(false);
    });

  return { data, isLoading, hasLoaded, errorMessage, reload };
}
