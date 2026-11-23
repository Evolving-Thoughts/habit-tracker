/** What a stopwatch is started on. */
export type TimerTarget = {
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
  /** From the Fokus-Modus: a Fokus-Sperre may start with the stopwatch. */
  focusBlock?: { mode?: "soft" | "hardcore" };
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
