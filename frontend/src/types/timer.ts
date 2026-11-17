/** What a stopwatch is started on. */
export type TimerTarget = {
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
};
/** The one running or paused stopwatch of the signed-in user. */
export type Timer = {
  id: string;
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
  state: "running" | "paused";
  /** Time worked up to the response's `serverNow`. */
  elapsedMilliseconds: number;
  /** Planned minutes of the target, if it has any; the stopwatch runs on. */
  targetMinutes: number | null;
  targetReachedAt: string | null;
};
export type TimerResponse = { serverNow: string; timer: Timer | null };
