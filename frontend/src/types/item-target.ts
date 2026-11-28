/**
 * What a step acts on: a quest or one stored run of a daily. Ticks, moves,
 * skips, the stopwatch and work logs all take it; a row gives it through
 * row-actions' `targetOf`.
 */
export type ItemTarget = {
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
};
