import { request } from "./http";
import type { TimerTarget, Timer, TimerResponse } from "../types/timer";
import type { FocusBlockRequest } from "../types/focus-block";

export type { TimerTarget, Timer, TimerResponse };

export const getCurrentTimer = () => request<TimerResponse>("/timers/current");
export const startTimer = (target: TimerTarget, replaceTimerId?: string) =>
  request<TimerResponse>("/timers", {
    method: "POST",
    body: JSON.stringify({
      kind: target.kind,
      targetId: target.targetId,
      ...(replaceTimerId ? { replaceTimerId } : {}),
      ...(target.focusBlock ? { focusBlock: target.focusBlock } : {}),
    }),
  });
/** `focusBlock` only with "resume" from the Fokus-Modus. */
export const timerAction = (
  id: string,
  action: "pause" | "resume" | "stop",
  focusBlock?: FocusBlockRequest,
) =>
  request<TimerResponse>(`/timers/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify(focusBlock ? { focusBlock } : {}),
  });
/** Changes the planned minutes of the stopwatch's target. */
export const changeTimerTarget = (id: string, durationMinutes: number) =>
  request<TimerResponse>(`/timers/${id}/duration`, {
    method: "PATCH",
    body: JSON.stringify({ durationMinutes }),
  });
