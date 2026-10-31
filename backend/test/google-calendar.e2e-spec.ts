import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  CalendarConnectionEntity,
  CalendarLinkEntity,
} from '../src/calendar/calendar.entities';
import {
  GoogleAccessRevokedError,
  GoogleCalendarClient,
  GoogleEvent,
  GoogleEventInput,
} from '../src/calendar/google-calendar.client';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OWN = 'own-calendar';
const now = new Date('2026-10-30T06:00:00.000Z');

/** In-memory Google; `updated` moves on with every write. */
class FakeGoogle {
  calendars = new Map<string, GoogleEvent[]>();
  writes: string[] = [];
  revoked = false;
  private tick = 0;
  private counter = 0;

  stamp(): string {
    this.tick += 1;
    return new Date(Date.now() + this.tick * 60_000).toISOString();
  }
  events(calendarId: string): GoogleEvent[] {
    return this.calendars.get(calendarId) ?? [];
  }
  add(calendarId: string, event: Partial<GoogleEvent>): GoogleEvent {
    this.counter += 1;
    const stored = {
      id: `event-${this.counter}`,
      updated: this.stamp(),
      ...event,
    };
    this.calendars.set(calendarId, [...this.events(calendarId), stored]);
    return stored;
  }
  configured = () => true;
  authUrl = (state: string) => `https://google.test/auth?state=${state}`;
  exchangeCode = () => Promise.resolve('refresh-secret');
  accessToken = () => {
    if (this.revoked) throw new GoogleAccessRevokedError();
    return Promise.resolve('access');
  };
  revoke = () => Promise.resolve();
  createCalendar = () => Promise.resolve(OWN);
  listEvents = (_token: string, calendarId: string) =>
    Promise.resolve(this.events(calendarId).map((event) => ({ ...event })));
  insertEvent = (
    _token: string,
    calendarId: string,
    input: GoogleEventInput,
  ) => {
    this.writes.push(calendarId);
    return Promise.resolve({ ...this.add(calendarId, input) });
  };
  patchEvent = (
    _token: string,
    calendarId: string,
    eventId: string,
    input: GoogleEventInput,
  ) => {
    this.writes.push(calendarId);
    const event = this.events(calendarId).find((item) => item.id === eventId)!;
    Object.assign(event, input, { updated: this.stamp() });
    return Promise.resolve({ ...event });
  };
  deleteEvent = (_token: string, calendarId: string, eventId: string) => {
    this.writes.push(calendarId);
    const event = this.events(calendarId).find((item) => item.id === eventId)!;
    event.status = 'cancelled';
    return Promise.resolve();
  };
}

describe('Google calendar sync (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource, google: FakeGoogle;

  const timed = (start: string, end: string) => ({
    start: { dateTime: start },
    end: { dateTime: end },
  });
  const sync = () => request(server).post('/calendar/google/sync').expect(204);
  const todos = () =>
    db.getRepository(TodoEntity).find({ order: { id: 'ASC' } });
  const connect = async (): Promise<void> => {
    const { url } = (
      await request(server).post('/calendar/google/connect').expect(200)
    ).body as { url: string };
    const state = new URL(url).searchParams.get('state')!;
    const callback = await request(server)
      .get(`/calendar/google/callback?code=abc&state=${state}`)
      .expect(302);
    expect(callback.headers.location).toContain('calendar=connected');
  };
  const scheduledTodo = async (): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({
            title: 'Bericht',
            scheduledAt: '2026-10-30T10:00:00.000Z',
            plannedDurationMinutes: 60,
          })
          .expect(201)
      ).body as { id: number }
    ).id;

  beforeAll(async () => {
    process.env.GOOGLE_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64');
    google = new FakeGoogle();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => now, today: () => dayOf(now) })
      .overrideProvider(GoogleCalendarClient)
      .useValue(google)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
  });
  beforeEach(async () => {
    await db.query(
      'TRUNCATE calendar_links, calendar_connections, calendar_oauth_states, external_events, timers, todos, habits CASCADE',
    );
    google.calendars.clear();
    google.writes = [];
    google.revoked = false;
  });
  afterAll(() => app.close());

  it('stores the token only encrypted and refuses a replayed state', async () => {
    const { url } = (
      await request(server).post('/calendar/google/connect').expect(200)
    ).body as { url: string };
    const state = new URL(url).searchParams.get('state')!;
    const path = `/calendar/google/callback?code=abc&state=${state}`;
    await request(server).get(path).expect(302);
    const replay = await request(server).get(path).expect(302);
    expect(replay.headers.location).toContain('calendar=failed');

    const [stored] = await db.getRepository(CalendarConnectionEntity).find();
    expect(stored.calendarId).toBe(OWN);
    expect(stored.refreshToken).not.toContain('refresh-secret');
  });

  it('writes a scheduled todo to the own calendar only and once', async () => {
    await connect();
    await scheduledTodo();
    await sync();
    await sync();

    expect(google.events(OWN)).toHaveLength(1);
    expect(google.events(OWN)[0].summary).toBe('Bericht');
    expect(new Set(google.writes)).toEqual(new Set([OWN]));
  });

  it('writes habit runs with a time and leaves others out', async () => {
    const habit = (title: string, timeOfDay?: string) =>
      request(server)
        .post('/habits')
        .send({
          title,
          timeOfDay,
          plannedDurationMinutes: 20,
          schedule: {
            type: 'interval',
            intervalDays: 1,
            missedOccurrencePolicy: 'carry_over',
          },
        })
        .expect(201);
    await connect();
    await habit('Laufen', '09:00');
    await habit('Lesen');
    await request(server).get('/day-planner/today').expect(200);
    await sync();

    expect(google.events(OWN).map((event) => event.summary)).toEqual([
      'Laufen',
    ]);
    expect(google.events(OWN)[0].start?.dateTime).toBe(
      '2026-10-30T08:00:00.000Z',
    );
  });

  it('turns a new event into a fixed todo and ignores all-day ones', async () => {
    await connect();
    google.add(OWN, {
      summary: 'Zahnarzt',
      ...timed('2026-10-30T12:00:00.000Z', '2026-10-30T12:45:00.000Z'),
    });
    google.add(OWN, {
      summary: 'Feiertag',
      start: { date: '2026-10-31' },
      end: { date: '2026-11-01' },
    });
    await sync();
    await sync();

    const all = await todos();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      title: 'Zahnarzt',
      isFixed: true,
      plannedDurationMinutes: 45,
    });
  });

  it('applies the newer change on both sides', async () => {
    await connect();
    const id = await scheduledTodo();
    await sync();

    const [event] = google.events(OWN);
    Object.assign(event, {
      ...timed('2026-10-30T14:00:00.000Z', '2026-10-30T14:30:00.000Z'),
      updated: google.stamp(),
    });
    await sync();
    const moved = await db.getRepository(TodoEntity).findOneByOrFail({ id });
    expect(moved.scheduledAt?.toISOString()).toBe('2026-10-30T14:00:00.000Z');
    expect(moved.plannedDurationMinutes).toBe(30);

    await request(server)
      .patch(`/todos/${id}`)
      .send({ title: 'Bericht neu' })
      .expect(200);
    await sync();
    expect(google.events(OWN)[0].summary).toBe('Bericht neu');
  });

  it('lets a later local change win a conflict', async () => {
    await connect();
    const id = await scheduledTodo();
    await sync();

    const [event] = google.events(OWN);
    event.summary = 'Aus Google';
    event.updated = new Date(Date.now() - 3_600_000).toISOString();
    const link = await db.getRepository(CalendarLinkEntity).findOneByOrFail({
      todoId: id,
    });
    await db
      .getRepository(CalendarLinkEntity)
      .update(link.id, { remoteUpdatedAt: new Date(0) });
    await request(server)
      .patch(`/todos/${id}`)
      .send({ title: 'Aus der App' })
      .expect(200);
    await sync();

    expect(google.events(OWN)[0].summary).toBe('Aus der App');
    const stored = await db.getRepository(TodoEntity).findOneByOrFail({ id });
    expect(stored.title).toBe('Aus der App');
  });

  it('keeps the todo unplanned when its event is deleted in Google', async () => {
    await connect();
    const id = await scheduledTodo();
    await sync();
    google.events(OWN)[0].status = 'cancelled';
    await sync();

    const stored = await db.getRepository(TodoEntity).findOneByOrFail({ id });
    expect(stored.scheduledAt).toBeNull();
    expect(await db.getRepository(CalendarLinkEntity).count()).toBe(0);
  });

  it('deletes the event when the todo is deleted in the app', async () => {
    await connect();
    const id = await scheduledTodo();
    await sync();
    const preview = await request(server)
      .get(`/todos/${id}/deletion-preview`)
      .expect(200);
    await request(server)
      .delete(`/todos/${id}`)
      .send({
        confirmationToken: (preview.body as { confirmationToken: string })
          .confirmationToken,
      })
      .expect(204);
    await sync();

    expect(google.events(OWN)[0].status).toBe('cancelled');
  });

  it('shows main calendar events and plans around busy ones', async () => {
    await connect();
    google.add('primary', {
      summary: 'Besprechung',
      ...timed('2026-10-30T08:00:00.000Z', '2026-10-30T09:00:00.000Z'),
    });
    google.add('primary', {
      summary: 'Nur Info',
      transparency: 'transparent',
      ...timed('2026-10-30T10:00:00.000Z', '2026-10-30T11:00:00.000Z'),
    });
    await request(server)
      .post('/todos')
      .send({
        title: 'Flexibel',
        scheduledAt: '2026-10-30T07:30:00.000Z',
        plannedDurationMinutes: 60,
      })
      .expect(201);
    await sync();

    const planner = await request(server).get('/day-planner/today').expect(200);
    expect(
      (planner.body as { externalEvents: { title: string }[] }).externalEvents,
    ).toHaveLength(2);
    const replan = await request(server).get('/todos/replan').expect(200);
    expect(
      (replan.body as { changes: { pieces: unknown[] }[] }).changes[0].pieces,
    ).toEqual([
      { start: '2026-10-30T07:30:00.000Z', minutes: 30 },
      { start: '2026-10-30T09:00:00.000Z', minutes: 30 },
    ]);
    expect(google.writes).not.toContain('primary');
  });

  it('reports withdrawn access and offers reconnecting', async () => {
    await connect();
    google.revoked = true;
    await sync();

    const status = await request(server).get('/calendar/google').expect(200);
    expect(status.body).toMatchObject({ connected: false, revoked: true });
  });

  it('disconnecting removes links and copies but keeps todos', async () => {
    await connect();
    await scheduledTodo();
    await sync();
    await request(server).delete('/calendar/google').expect(204);

    expect(await db.getRepository(CalendarLinkEntity).count()).toBe(0);
    expect(await todos()).toHaveLength(1);
  });
});
