import { request } from "./http";

import type { ReplanPiece, ReplanChange, ReplanPreview } from "../types/replan";

export type { ReplanPiece, ReplanChange, ReplanPreview };


export function getReplan(): Promise<ReplanPreview> {
  return request<ReplanPreview>("/todos/replan");
}

export function applyReplan(confirmationToken: string): Promise<void> {
  return request<void>("/todos/replan", {
    method: "POST",
    body: JSON.stringify({ confirmationToken }),
  });
}

export function setDayEnd(dayEnd: string): Promise<void> {
  return request<void>("/todos/replan/day-end", {
    method: "PUT",
    body: JSON.stringify({ dayEnd }),
  });
}
