import { request } from "./http";

import type { WorkLog, WorkDay, WorkLogTimes, WorkTarget } from "../types/work-log";

export type { WorkLog, WorkDay, WorkLogTimes, WorkTarget };


export function getWorkDay(date: string): Promise<WorkDay> {
  return request<WorkDay>(`/work-logs?${new URLSearchParams({ date })}`);
}

export function createWorkLog(
  target: Pick<WorkTarget, "kind" | "targetId">,
  times: WorkLogTimes,
): Promise<WorkLog> {
  return request<WorkLog>("/work-logs", {
    method: "POST",
    body: JSON.stringify({ ...target, ...times }),
  });
}

export function updateWorkLog(
  id: number,
  times: WorkLogTimes,
): Promise<WorkLog> {
  return request<WorkLog>(`/work-logs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(times),
  });
}

export function deleteWorkLog(id: number): Promise<void> {
  return request<void>(`/work-logs/${id}`, { method: "DELETE" });
}
