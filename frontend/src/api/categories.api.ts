import type { CategoryResponse } from "../types/category";
import { request } from "./http";

export function getCategories(): Promise<CategoryResponse[]> {
  return request<CategoryResponse[]>("/categories");
}

/** `color` null lets the name pick the colour. */
export function createCategory(
  name: string,
  color: string | null = null,
): Promise<CategoryResponse> {
  return request<CategoryResponse>("/categories", {
    method: "POST",
    body: JSON.stringify({ name, color }),
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

/** Null goes back to the colour the name picks. */
export function setCategoryColor(
  id: number,
  color: string | null,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ color }),
  });
}

export function deleteCategory(id: number): Promise<void> {
  return request<void>(`/categories/${id}`, { method: "DELETE" });
}
