import type { SearchResponse } from "../types/search";
import { request } from "./http";

/** Titles and texts that contain `query` (at least two characters). */
export function search(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  return request<SearchResponse>(
    `/search?${new URLSearchParams({ q: query })}`,
    { signal },
  );
}
