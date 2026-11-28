import type { ItemTarget } from "./item-target";

export type WorkLog = {
  id: number;
  title: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  source: "timer" | "manual";
};
export type WorkLogTimes = { startedAt: string; endedAt: string };
/** What a work log is written for. */
export type WorkTarget = ItemTarget;
