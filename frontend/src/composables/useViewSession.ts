import {
  computed,
  inject,
  onScopeDispose,
  provide,
  shallowReactive,
  type InjectionKey,
  type Ref,
  type WatchSource,
} from "vue";
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

export type ViewSession = ReturnType<typeof createSession>;

/** How a view's components reach its session (`useParentSession`). */
export const VIEW_SESSION: InjectionKey<ViewSession> = Symbol("view session");

/**
 * A view's reads and writes as one session. Each resource refreshes after a
 * data change elsewhere, but never while one of the session's writes runs
 * or while the view is `holding` (a dialog open, its save running): a
 * change heard meanwhile loads once the session is free (`useLoader`). A
 * write reloads every resource once, quietly and side by side, so its own
 * announcement fetches nothing more. Writes report into `writeError`, else
 * into the first resource's error. The view's components share the session
 * (`useParentSession`).
 */
export function useViewSession(
  options: {
    holding?: () => boolean;
    writeError?: Ref<string | null>;
  } = {},
): ViewSession {
  const session = createSession(options);
  provide(VIEW_SESSION, session);
  return session;
}

/**
 * The session of the view a component is drawn in. A component that reads
 * or writes for its view takes it from here; outside a view it throws, as
 * its writes would otherwise reload nothing the view shows.
 */
export function useParentSession(): ViewSession {
  const session = inject(VIEW_SESSION, null);
  if (!session)
    throw new Error(
      "useParentSession: no view session; mount this inside a view that calls useViewSession.",
    );
  return session;
}

function createSession({
  holding = () => false,
  writeError,
}: {
  holding?: () => boolean;
  writeError?: Ref<string | null>;
}) {
  const reloads = new Set<(showPageLoading?: boolean) => Promise<void>>();
  // Reactive, so a hold that ends lets a missed change load (`useLoader`).
  const holds = shallowReactive(new Set<() => boolean>());
  let firstError: Ref<string | null> | undefined;
  const reportTo =
    writeError ??
    computed<string | null>({
      get: () => firstError?.value ?? null,
      set: (message) => {
        if (firstError) firstError.value = message;
      },
    });

  async function reloadAll(): Promise<void> {
    await Promise.all([...reloads].map((reload) => reload(false)));
  }
  const writes = useWrites(reloadAll, reportTo);
  const free = (): boolean =>
    !writes.busy.value && !holding() && ![...holds].some((held) => held());

  /**
   * Holds the refresh while `condition` is true, for as long as the calling
   * component lives: a component's dialog, a save of its own.
   */
  function holdWhile(condition: () => boolean): void {
    holds.add(condition);
    onScopeDispose(() => holds.delete(condition));
  }

  /** Loads one resource of the view under the session's refresh rule. */
  function resource<T>(
    load: (signal: AbortSignal) => Promise<T>,
    options: ResourceOptions<T>,
  ) {
    const loader = useLoader(load, { ...options, refreshOnChange: free });
    reloads.add(loader.reload);
    onScopeDispose(() => reloads.delete(loader.reload));
    firstError ??= loader.errorMessage;
    return loader;
  }

  /**
   * Writes of one of the view's components, reported into its own
   * `errorMessage` and with its own `busy`: they reload every resource of
   * the view once and hold its refresh while they run, so their
   * announcement fetches nothing more.
   */
  function childWrites(errorMessage: Ref<string | null>) {
    const child = useWrites(reloadAll, errorMessage);
    holdWhile(() => child.busy.value);
    return child;
  }

  return { resource, holdWhile, childWrites, ...writes };
}
