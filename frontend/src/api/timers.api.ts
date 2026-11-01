import { request } from "./http";
import type { TimerTarget, Timer, TimerResponse } from "../types/timer";

export type { TimerTarget, Timer, TimerResponse };

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
