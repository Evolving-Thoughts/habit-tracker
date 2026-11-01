export type WorkLog = {
  id: number;
  title: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  source: "timer" | "manual";
};
export type WorkDay = {
  date: string;
  totalMinutes: number;
  logs: WorkLog[];
};
export type WorkLogTimes = { startedAt: string; endedAt: string };
export type WorkTarget = {
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
};
