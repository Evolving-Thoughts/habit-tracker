import { Injectable } from '@nestjs/common';
import { hasTokenKey } from './calendar.crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API_URL = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

export type GoogleEventTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  updated: string;
  transparency?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  extendedProperties?: { private?: Record<string, string> };
};

export type GoogleCalendar = {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
};

export type GoogleEventInput = {
  summary: string;
  start: GoogleEventTime;
  end: GoogleEventTime;
  extendedProperties: { private: Record<string, string> };
};

/** Google refuses the stored token: access was withdrawn or it expired. */
export class GoogleAccessRevokedError extends Error {}
/** The stored token does not include the needed permission. */
export class GoogleForbiddenError extends Error {}
/** The event is gone in Google. */
export class GoogleEventMissingError extends Error {}

type TokenResponse = { access_token?: string; refresh_token?: string };

@Injectable()
export class GoogleCalendarClient {
  configured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      hasTokenKey(),
    );
  }

  authUrl(state: string): string {
    const query = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${AUTH_URL}?${query.toString()}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const { refresh_token: token } = await this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    });
    if (!token) throw new Error('Google returned no refresh token');
    return token;
  }

  async accessToken(refreshToken: string): Promise<string> {
    const { access_token: token } = await this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (!token) throw new Error('Google returned no access token');
    return token;
  }

  async revoke(refreshToken: string): Promise<void> {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
  }

  async createCalendar(accessToken: string, summary: string): Promise<string> {
    const { id } = await this.api<{ id: string }>(accessToken, '/calendars', {
      method: 'POST',
      body: JSON.stringify({ summary }),
    });
    return id;
  }

  async listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
    const calendars: GoogleCalendar[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        maxResults: '250',
        ...(pageToken ? { pageToken } : {}),
      });
      const page = await this.api<{
        items?: GoogleCalendar[];
        nextPageToken?: string;
      }>(accessToken, `/users/me/calendarList?${query.toString()}`);
      calendars.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return calendars;
  }

  /** Single instances, so a series arrives as separate events. */
  async listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<GoogleEvent[]> {
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '250',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        ...(pageToken ? { pageToken } : {}),
      });
      const page = await this.api<{
        items?: GoogleEvent[];
        nextPageToken?: string;
      }>(accessToken, `${this.events(calendarId)}?${query.toString()}`);
      events.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return events;
  }

  insertEvent(
    accessToken: string,
    calendarId: string,
    input: GoogleEventInput,
  ): Promise<GoogleEvent> {
    return this.api(accessToken, this.events(calendarId), {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  patchEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    input: GoogleEventInput,
  ): Promise<GoogleEvent> {
    return this.api(
      accessToken,
      `${this.events(calendarId)}/${encodeURIComponent(eventId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    await this.api(
      accessToken,
      `${this.events(calendarId)}/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    );
  }

  private events(calendarId: string): string {
    return `/calendars/${encodeURIComponent(calendarId)}/events`;
  }

  private async tokenRequest(
    fields: Record<string, string>,
  ): Promise<TokenResponse> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        ...fields,
      }),
    });
    if (response.status === 400 || response.status === 401)
      throw new GoogleAccessRevokedError();
    if (!response.ok) throw new Error(`Google token ${response.status}`);
    return (await response.json()) as TokenResponse;
  }

  private async api<T>(
    accessToken: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 401) throw new GoogleAccessRevokedError();
    if (response.status === 403) throw new GoogleForbiddenError();
    if (response.status === 404 || response.status === 410)
      throw new GoogleEventMissingError();
    if (!response.ok) throw new Error(`Google API ${response.status}`);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}
