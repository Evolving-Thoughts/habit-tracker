import { request } from "./http";
import type {
  AddFocusEntryInput,
  FocusBlockRequest,
  FocusBlockState,
  FocusSettings,
} from "../types/focus-block";

/** Settings, lists and the open block; every change answers with the same. */
export function getFocusBlock(signal?: AbortSignal): Promise<FocusBlockState> {
  return request<FocusBlockState>("/focus-block", { signal });
}

export function saveFocusSettings(
  change: Partial<FocusSettings>,
): Promise<FocusBlockState> {
  return request<FocusBlockState>("/focus-block/settings", {
    method: "PUT",
    body: JSON.stringify(change),
  });
}

export function addFocusEntry(
  entry: AddFocusEntryInput,
): Promise<FocusBlockState> {
  return request<FocusBlockState>("/focus-block/entries", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export function removeFocusEntry(id: number): Promise<FocusBlockState> {
  return request<FocusBlockState>(`/focus-block/entries/${id}`, {
    method: "DELETE",
  });
}

/** "Sperre starten" for the stopwatch that already runs. */
export function startFocusBlock(
  input: FocusBlockRequest,
): Promise<FocusBlockState> {
  return request<FocusBlockState>("/focus-block", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** "Sperre aufheben": Soft only; Hardcore answers 409 until its Soll. */
export function endFocusBlock(): Promise<FocusBlockState> {
  return request<FocusBlockState>("/focus-block/end", {
    method: "POST",
    body: "{}",
  });
}
