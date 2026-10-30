import { request } from "./http";

export type Reflection = { date: string; text: string };

export function getReflection(
  date: string,
  signal?: AbortSignal,
): Promise<Reflection> {
  return request<Reflection>(`/reflections/${date}`, { signal });
}

export function saveReflection(
  date: string,
  text: string,
): Promise<Reflection> {
  return request<Reflection>(`/reflections/${date}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}
