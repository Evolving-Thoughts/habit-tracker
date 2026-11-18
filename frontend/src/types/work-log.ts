export type WorkLog = {
  id: number;
  title: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  source: "timer" | "manual";
};
export type WorkLogTimes = { startedAt: string; endedAt: string };
export type WorkTarget = {
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
};
