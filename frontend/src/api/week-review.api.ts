import { request } from "./http";
import type {
  WeekReviewAnswers,
  WeekReviewInput,
  WeekReviewResponse,
} from "../types/week-review";

/** The review of the week starting on Monday `week`. */
export function getWeekReview(
  week: string,
  signal?: AbortSignal,
): Promise<WeekReviewResponse> {
  const params = new URLSearchParams({ week });
  return request<WeekReviewResponse>(`/week-review?${params}`, { signal });
}

/** Replaces the three answers of the week; empty ones are stored as none. */
export function saveWeekReview(
  week: string,
  answers: WeekReviewInput,
): Promise<WeekReviewAnswers> {
  return request<WeekReviewAnswers>(`/week-review/${week}`, {
    method: "PUT",
    body: JSON.stringify(answers),
  });
}
