export type TimerTarget = {
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
  durationMinutes: number;
};
export type Timer = {
  id: string;
  kind: "todo" | "occurrence";
  targetId: number;
  title: string;
  state: "running" | "paused" | "finished";
  durationMinutes: number;
  remainingMilliseconds: number;
  endsAt: string | null;
  finishedAt: string | null;
};
export type TimerResponse = { serverNow: string; timer: Timer | null };
