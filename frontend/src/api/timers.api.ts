import { request } from "./http";
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
export const getCurrentTimer = () => request<TimerResponse>("/timers/current");
export const startTimer = (target: TimerTarget, replaceTimerId?: string) =>
  request<TimerResponse>("/timers", {
    method: "POST",
    body: JSON.stringify({
      kind: target.kind,
      targetId: target.targetId,
      durationMinutes: target.durationMinutes,
      ...(replaceTimerId ? { replaceTimerId } : {}),
    }),
  });
export const timerAction = (id: string, action: "pause" | "resume" | "stop") =>
  request<TimerResponse>(`/timers/${id}/${action}`, {
    method: "POST",
    body: "{}",
  });
export const changeTimerDuration = (id: string, durationMinutes: number) =>
  request<TimerResponse>(`/timers/${id}/duration`, {
    method: "PATCH",
    body: JSON.stringify({ durationMinutes }),
  });
