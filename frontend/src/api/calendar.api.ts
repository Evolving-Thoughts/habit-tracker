import { request } from "./http";

export type ReadCalendar = {
  id: string;
  title: string;
  primary: boolean;
  blocksPlanning: boolean;
};

export type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  revoked: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  needsConsent?: boolean;
  calendars?: ReadCalendar[];
};

export function getCalendarStatus(): Promise<CalendarStatus> {
  return request<CalendarStatus>("/calendar/google");
}

export function startCalendarConnection(): Promise<{ url: string }> {
  return request<{ url: string }>("/calendar/google/connect", {
    method: "POST",
  });
}

export function syncCalendar(): Promise<void> {
  return request<void>("/calendar/google/sync", { method: "POST" });
}

export function setCalendarBlocksPlanning(
  calendarId: string,
  blocksPlanning: boolean,
): Promise<void> {
  return request<void>("/calendar/google/calendars", {
    method: "PATCH",
    body: JSON.stringify({ calendarId, blocksPlanning }),
  });
}

export function disconnectCalendar(): Promise<void> {
  return request<void>("/calendar/google", { method: "DELETE" });
}
