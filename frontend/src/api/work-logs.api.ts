import { request } from "./http";

import type { WorkLog, WorkLogTimes, WorkTarget } from "../types/work-log";

export type { WorkLog, WorkLogTimes, WorkTarget };

/* A day's logs come with the calendar's day (see history.api.ts). */

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

/**
 * `keepalive`, because the calendar sends a delete held behind its undo
 * toast when the page closes; the request must outlive the page.
 */
export function deleteWorkLog(id: number): Promise<void> {
  return request<void>(`/work-logs/${id}`, {
    method: "DELETE",
    keepalive: true,
  });
}
