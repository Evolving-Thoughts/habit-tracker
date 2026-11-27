import { computed, type Ref, type WatchSource } from "vue";
import { useLoader } from "./useLoader";
import { useWrites } from "./useWrites";

type ResourceOptions<T> = {
  initial: T;
  fallbackError: string;
  /** What the request depends on: a change loads again with the page state. */
  params?: WatchSource[];
  /** Drops the old result while a new page load runs. */
  resetOnLoad?: boolean;
};

/**
 * A view's reads and writes as one session. Each resource refreshes after a
 * data change elsewhere, but never while one of the session's writes runs
 * or while the view is `holding` (a dialog open, its save running): a
 * change heard meanwhile loads once the session is free (`useLoader`). A
 * write reloads every resource once, quietly and side by side, so its own
 * announcement fetches nothing more. Writes report into `writeError`, else
 * into the first resource's error.
 */
export function useViewSession({
  holding = () => false,
  writeError,
}: {
  holding?: () => boolean;
  writeError?: Ref<string | null>;
} = {}) {
  const reloads: ((showPageLoading?: boolean) => Promise<void>)[] = [];
  let firstError: Ref<string | null> | undefined;
  const reportTo =
    writeError ??
    computed<string | null>({
      get: () => firstError?.value ?? null,
      set: (message) => {
        if (firstError) firstError.value = message;
      },
    });

  const writes = useWrites(async () => {
    await Promise.all(reloads.map((reload) => reload(false)));
  }, reportTo);
  const free = (): boolean => !writes.busy.value && !holding();

  /** Loads one resource of the view under the session's refresh rule. */
  function resource<T>(
    load: (signal: AbortSignal) => Promise<T>,
    options: ResourceOptions<T>,
  ) {
    const loader = useLoader(load, { ...options, refreshOnChange: free });
    reloads.push(loader.reload);
    firstError ??= loader.errorMessage;
    return loader;
  }

  return { resource, ...writes };
}
