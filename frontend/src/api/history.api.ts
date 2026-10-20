import { request } from "./http";
import type {
  HistoryResponse,
  HistoryFilter,
  HistoryViewMode,
} from "../types/history";
export function getHistory(
  date: string,
  view: HistoryViewMode,
  filter: HistoryFilter,
  signal?: AbortSignal,
): Promise<HistoryResponse> {
  const params = new URLSearchParams({ date, view, filter });
  return request<HistoryResponse>(`/history?${params}`, { signal });
}
