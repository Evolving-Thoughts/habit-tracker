import { request } from "./http";
import type { HierarchyTodo, DeletionPreview } from "../types/todo-hierarchy";
export function getTodoHierarchy(): Promise<HierarchyTodo[]> {
  return request("/todos/hierarchy");
}
export function getDeletionPreview(id: number): Promise<DeletionPreview> {
  return request(`/todos/${id}/deletion-preview`);
}
