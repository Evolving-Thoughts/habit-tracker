import { request } from "./http";

export type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  revoked: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
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

export function disconnectCalendar(): Promise<void> {
  return request<void>("/calendar/google", { method: "DELETE" });
}
