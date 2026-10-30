import { request } from "./http";

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
