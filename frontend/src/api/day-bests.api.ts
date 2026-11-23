import { request } from "./http";
import type {
  DayBest,
  DayBestMonths,
  DayBestRange,
  DayBestSettings,
} from "../types/day-best";

/** One day's line; a day without one reads as empty text. */
export function getDayBest(
  date: string,
  signal?: AbortSignal,
): Promise<DayBest> {
  return request<DayBest>(`/day-bests/${date}`, { signal });
}

/** The lines from `from` to `to`, both included, newest first. */
export function getDayBests(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<DayBestRange> {
  const params = new URLSearchParams({ from, to });
  return request<DayBestRange>(`/day-bests?${params}`, { signal });
}

/** How many lines each month holds, newest first. */
export function getDayBestMonths(signal?: AbortSignal): Promise<DayBestMonths> {
  return request<DayBestMonths>("/day-bests/months", { signal });
}

/** Saves the day's line; empty text removes it. */
export function saveDayBest(date: string, text: string): Promise<DayBest> {
  return request<DayBest>(`/day-bests/${date}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

export function getDayBestSettings(
  signal?: AbortSignal,
): Promise<DayBestSettings> {
  return request<DayBestSettings>("/day-best-settings", { signal });
}

export function saveDayBestSettings(
  change: Partial<DayBestSettings>,
): Promise<DayBestSettings> {
  return request<DayBestSettings>("/day-best-settings", {
    method: "PUT",
    body: JSON.stringify(change),
  });
}
