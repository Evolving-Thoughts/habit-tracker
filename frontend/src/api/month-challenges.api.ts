import { request } from "./http";
import type {
  CreateMonthChallengeInput,
  MonthChallenge,
  MonthChallenges,
} from "../types/month-challenge";

/** This month's challenge, next month's and the earlier ones. */
export function getMonthChallenges(
  signal?: AbortSignal,
): Promise<MonthChallenges> {
  return request<MonthChallenges>("/month-challenges", { signal });
}

export function createMonthChallenge(
  input: CreateMonthChallengeInput,
): Promise<MonthChallenge> {
  return request<MonthChallenge>("/month-challenges", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Changes the daily reminder; null switches it off. */
export function updateMonthChallenge(
  id: number,
  reminderTime: string | null,
): Promise<MonthChallenge> {
  return request<MonthChallenge>(`/month-challenges/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ reminderTime }),
  });
}

/** Ends the running challenge today; it stays in the history. */
export function endMonthChallenge(id: number): Promise<MonthChallenge> {
  return request<MonthChallenge>(`/month-challenges/${id}/end`, {
    method: "POST",
  });
}

export function deleteMonthChallenge(id: number): Promise<void> {
  return request<void>(`/month-challenges/${id}`, { method: "DELETE" });
}
