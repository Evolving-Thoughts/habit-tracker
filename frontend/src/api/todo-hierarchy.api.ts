import { request } from "./http";
import type {
  BurnupPoint,
  DeletionPreview,
  HierarchyTodo,
} from "../types/todo-hierarchy";

export function getBurnup(todoId: number): Promise<BurnupPoint[]> {
  return request<BurnupPoint[]>(`/todos/${todoId}/burnup`);
}
export function getTodoHierarchy(): Promise<HierarchyTodo[]> {
  return request("/todos/hierarchy");
}
export function getDeletionPreview(id: number): Promise<DeletionPreview> {
  return request(`/todos/${id}/deletion-preview`);
}
