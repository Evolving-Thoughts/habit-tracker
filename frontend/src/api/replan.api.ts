import { request } from "./http";

export type ReplanPiece = { start: string; minutes: number };
export type ReplanChange = {
  todoId: number;
  title: string;
  from: string;
  pieces: ReplanPiece[];
  tomorrow: ReplanPiece | null;
};
export type ReplanPreview = {
  confirmationToken: string;
  dayEnd: string;
  changes: ReplanChange[];
};

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
