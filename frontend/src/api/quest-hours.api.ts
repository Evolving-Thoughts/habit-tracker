import { request } from "./http";
import type { QuestHoursResponse, QuestTarget } from "../types/quest-hours";

/** The quest hours of the week starting on Monday `week`. */
export function getQuestHours(
  week: string,
  signal?: AbortSignal,
): Promise<QuestHoursResponse> {
  const params = new URLSearchParams({ week });
  return request<QuestHoursResponse>(`/quest-hours?${params}`, { signal });
}

export function getQuestTarget(): Promise<QuestTarget> {
  return request<QuestTarget>("/quest-hours/target");
}

export function setQuestTarget(
  weeklyTargetMinutes: number | null,
): Promise<QuestTarget> {
  return request<QuestTarget>("/quest-hours/target", {
    method: "PUT",
    body: JSON.stringify({ weeklyTargetMinutes }),
  });
}
