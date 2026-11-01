import type { CategoryResponse } from "../types/category";
import { request } from "./http";

export function getCategories(): Promise<CategoryResponse[]> {
  return request<CategoryResponse[]>("/categories");
}

export function createCategory(name: string): Promise<CategoryResponse> {
  return request<CategoryResponse>("/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameCategory(
  id: number,
  name: string,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function setCategoryTarget(
  id: number,
  weeklyTarget: number | null,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ weeklyTarget }),
  });
}

export function deleteCategory(id: number): Promise<void> {
  return request<void>(`/categories/${id}`, { method: "DELETE" });
}
