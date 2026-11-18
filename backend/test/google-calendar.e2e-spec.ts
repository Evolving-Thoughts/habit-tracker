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
  GoogleEventMissingError,
  GoogleForbiddenError,
} from '../src/calendar/google-calendar.client';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { WorkLogEntity } from '../src/work-logs/work-log.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OWN = 'own-calendar';
const now = new Date('2026-10-30T06:00:00.000Z');

/** In-memory Google; `updated` moves on with every write. */
class FakeGoogle {
  calendars = new Map<string, GoogleEvent[]>();
  writes: string[] = [];
  /** Every write call with the calendar it went to. */
  calls: { method: 'insert' | 'patch' | 'delete'; calendarId: string }[] = [];
  revoked = false;
  withoutList = false;
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
  listCalendars = () =>
    this.withoutList
      ? Promise.reject(new GoogleForbiddenError())
      : Promise.resolve([
          { id: OWN, summary: 'Habit Tracker', selected: true },
          { id: 'primary', summary: 'Ich', primary: true, selected: true },
          { id: 'shared', summary: 'Gemeinsam', selected: true },
          { id: 'hidden', summary: 'Ausgeblendet' },
        ]);
  listEvents = (_token: string, calendarId: string) =>
    Promise.resolve(this.events(calendarId).map((event) => ({ ...event })));
  insertEvent = (
    _token: string,
    calendarId: string,
    input: GoogleEventInput,
  ) => {
    this.writes.push(calendarId);
    this.calls.push({ method: 'insert', calendarId });
    return Promise.resolve({ ...this.add(calendarId, input) });
  };
  patchEvent = (
    _token: string,
    calendarId: string,
    eventId: string,
    input: GoogleEventInput,
  ) => {
    this.writes.push(calendarId);
    this.calls.push({ method: 'patch', calendarId });
    const event = this.events(calendarId).find((item) => item.id === eventId);
    if (!event) return Promise.reject(new GoogleEventMissingError());
    Object.assign(event, input, { updated: this.stamp() });
    return Promise.resolve({ ...event });
  };
  deleteEvent = (_token: string, calendarId: string, eventId: string) => {
    this.writes.push(calendarId);
    this.calls.push({ method: 'delete', calendarId });
    const event = this.events(calendarId).find((item) => item.id === eventId);
    if (!event) return Promise.reject(new GoogleEventMissingError());
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
  /** An appointment: only those have an event in Google. */
  const scheduledTodo = async (): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({
            title: 'Bericht',
            scheduledDate: '2026-10-30',
            timeOfDay: '11:00',
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
      'TRUNCATE external_calendars, calendar_links, calendar_connections, calendar_oauth_states, external_events, work_logs, timers, todos, habits CASCADE',
    );
    google.calendars.clear();
    google.writes = [];
    google.calls = [];
    google.revoked = false;
    google.withoutList = false;
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

  it('turns a new event into an appointment and ignores all-day ones', async () => {
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
      scheduledDate: '2026-10-30',
      timeOfDay: '13:00',
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
    expect(moved).toMatchObject({
      scheduledDate: '2026-10-30',
      timeOfDay: '15:00',
    });
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

  it('writes only appointments, and removes the event when the time goes', async () => {
    await connect();
    await request(server)
      .post('/todos')
      .send({ title: 'Irgendwann heute', scheduledDate: '2026-10-30' })
      .expect(201);
    const id = await scheduledTodo();
    await sync();
    expect(google.events(OWN).map((event) => event.summary)).toEqual([
      'Bericht',
    ]);

    await request(server)
      .patch(`/todos/${id}`)
      .send({ timeOfDay: null })
      .expect(200);
    await sync();
    expect(google.events(OWN)[0].status).toBe('cancelled');
    expect(await db.getRepository(CalendarLinkEntity).count()).toBe(0);
  });

  it('keeps the todo unplanned when its event is deleted in Google', async () => {
    await connect();
    const id = await scheduledTodo();
    await sync();
    google.events(OWN)[0].status = 'cancelled';
    await sync();

    const stored = await db.getRepository(TodoEntity).findOneByOrFail({ id });
    expect(stored).toMatchObject({ scheduledDate: null, timeOfDay: null });
    expect(await db.getRepository(CalendarLinkEntity).count()).toBe(0);
  });

  it('leaves a deleted fixed event as a todo that can still be completed', async () => {
    await connect();
    google.add(OWN, {
      summary: 'Zahnarzt',
      ...timed('2026-10-30T12:00:00.000Z', '2026-10-30T12:45:00.000Z'),
    });
    await sync();
    const [{ id }] = await todos();
    google.events(OWN)[0].status = 'cancelled';
    await sync();

    await request(server)
      .patch(`/todos/${id}`)
      .send({ completed: true })
      .expect(200);
  });

  it('keeps a run in place while its timer is open', async () => {
    await connect();
    await request(server)
      .post('/habits')
      .send({
        title: 'Laufen',
        timeOfDay: '09:00',
        plannedDurationMinutes: 20,
        schedule: {
          type: 'interval',
          intervalDays: 7,
          missedOccurrencePolicy: 'carry_over',
        },
      })
      .expect(201);
    await request(server).get('/day-planner/today').expect(200);
    await sync();
    const [occurrence] = await db.getRepository(HabitOccurrenceEntity).find();
    await request(server)
      .post('/timers')
      .send({ kind: 'occurrence', targetId: occurrence.id })
      .expect(201);

    Object.assign(google.events(OWN)[0], {
      ...timed('2026-10-31T08:00:00.000Z', '2026-10-31T08:20:00.000Z'),
      updated: google.stamp(),
    });
    await sync();

    const stored = await db
      .getRepository(HabitOccurrenceEntity)
      .findOneByOrFail({ id: occurrence.id });
    expect(stored.movedToDate).toBeNull();
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

  it('shows main calendar events without writing to that calendar', async () => {
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
    await sync();

    const planner = await request(server).get('/day-planner/today').expect(200);
    expect(
      (planner.body as { externalEvents: { title: string }[] }).externalEvents,
    ).toHaveLength(2);
    expect(google.writes).not.toContain('primary');

    const month = await request(server)
      .get('/history?date=2026-10-30&view=month')
      .expect(200);
    const { days } = month.body as {
      days: { date: string; external?: { title: string }[] }[];
    };
    expect(
      days.find((day) => day.date === '2026-10-30')?.external,
    ).toHaveLength(2);
  });

  it('counts events by the time they occupy, not by their start', async () => {
    await connect();
    google.add('primary', {
      summary: 'Nacht',
      ...timed('2026-10-29T22:00:00.000Z', '2026-10-30T00:30:00.000Z'),
    });
    google.add('primary', {
      summary: 'Morgen',
      ...timed('2026-10-30T23:00:00.000Z', '2026-10-30T23:30:00.000Z'),
    });
    await sync();

    const planner = await request(server).get('/day-planner/today').expect(200);
    expect(
      (
        planner.body as { externalEvents: { title: string }[] }
      ).externalEvents.map(({ title }) => title),
    ).toEqual(['Nacht']);
  });

  it('reads all shown calendars and lists them', async () => {
    await connect();
    google.add('shared', {
      summary: 'Familie',
      ...timed('2026-10-30T08:00:00.000Z', '2026-10-30T09:00:00.000Z'),
    });
    google.add('hidden', {
      summary: 'Unsichtbar',
      ...timed('2026-10-30T12:00:00.000Z', '2026-10-30T13:00:00.000Z'),
    });
    await sync();

    const planner = await request(server).get('/day-planner/today').expect(200);
    expect(
      (planner.body as { externalEvents: { title: string }[] }).externalEvents,
    ).toEqual([expect.objectContaining({ title: 'Familie' })]);
    const status = await request(server).get('/calendar/google').expect(200);
    expect((status.body as { calendars: unknown[] }).calendars).toEqual([
      { id: 'primary', title: 'Ich', primary: true },
      { id: 'shared', title: 'Gemeinsam', primary: false },
    ]);
  });

  it('keeps reading the main calendar with an older token', async () => {
    await connect();
    google.withoutList = true;
    google.add('primary', {
      summary: 'Besprechung',
      ...timed('2026-10-30T08:00:00.000Z', '2026-10-30T09:00:00.000Z'),
    });
    await sync();

    const status = await request(server).get('/calendar/google').expect(200);
    expect(status.body).toMatchObject({ connected: true, needsConsent: true });
    const planner = await request(server).get('/day-planner/today').expect(200);
    expect(
      (planner.body as { externalEvents: unknown[] }).externalEvents,
    ).toHaveLength(1);
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

  describe('Logbuch', () => {
    /** A quest without a day: it has no event of its own. */
    const quest = async (
      title = 'Schreiben',
      parentId?: number,
    ): Promise<number> =>
      (
        (
          await request(server)
            .post('/todos')
            .send({ title, parentId })
            .expect(201)
        ).body as { id: number }
      ).id;
    const addLog = async (
      todoId: number,
      startedAt: string,
      endedAt: string,
    ): Promise<number> =>
      (
        (
          await request(server)
            .post('/work-logs')
            .send({ kind: 'todo', targetId: todoId, startedAt, endedAt })
            .expect(201)
        ).body as { id: number }
      ).id;
    const correct = (log: number, startedAt: string, endedAt: string) =>
      request(server)
        .patch(`/work-logs/${log}`)
        .send({ startedAt, endedAt })
        .expect(200);
    const live = () =>
      google.events(OWN).filter((event) => event.status !== 'cancelled');
    const description = (event: GoogleEvent) =>
      (event as GoogleEvent & { description?: string }).description;

    it('writes a finished stretch of five minutes or more, not a shorter one', async () => {
      await connect();
      const id = await quest();
      await addLog(id, '2026-10-30T05:00:00.000Z', '2026-10-30T05:30:00.000Z');
      await addLog(id, '2026-10-30T05:40:00.000Z', '2026-10-30T05:44:59.000Z');
      await sync();
      await sync();

      // The quest itself has no time, so only the long stretch goes out.
      expect(google.events(OWN)).toHaveLength(1);
      const [event] = google.events(OWN);
      expect(event).toMatchObject({
        summary: 'Schreiben',
        start: { dateTime: '2026-10-30T05:00:00.000Z' },
        end: { dateTime: '2026-10-30T05:30:00.000Z' },
      });
      expect(description(event)).toBe('Logbuch · gemessene Arbeitszeit');
    });

    it('names the campaign of the stretch in the event', async () => {
      await connect();
      const chapter = await quest('Kapitel 1', await quest('Buch'));
      await addLog(
        chapter,
        '2026-10-30T05:00:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      await sync();

      expect(description(google.events(OWN)[0])).toBe(
        'Logbuch · gemessene Arbeitszeit\nKampagne: Buch',
      );
    });

    it('moves the event with a correction and removes it with the log', async () => {
      await connect();
      const id = await quest();
      const log = await addLog(
        id,
        '2026-10-30T05:00:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      const short = await addLog(
        id,
        '2026-10-30T04:00:00.000Z',
        '2026-10-30T04:20:00.000Z',
      );
      await sync();
      expect(live()).toHaveLength(2);

      await correct(
        log,
        '2026-10-30T05:10:00.000Z',
        '2026-10-30T05:50:00.000Z',
      );
      // Under five minutes it no longer belongs in the calendar.
      await correct(
        short,
        '2026-10-30T04:00:00.000Z',
        '2026-10-30T04:03:00.000Z',
      );
      await sync();
      expect(live()).toHaveLength(1);
      expect(live()[0]).toMatchObject({
        start: { dateTime: '2026-10-30T05:10:00.000Z' },
        end: { dateTime: '2026-10-30T05:50:00.000Z' },
      });

      await request(server).delete(`/work-logs/${log}`).expect(204);
      await sync();
      expect(live()).toEqual([]);
      expect(await db.getRepository(CalendarLinkEntity).count()).toBe(0);
    });

    it('never takes a change from Google and does not bring a deleted event back', async () => {
      await connect();
      const id = await quest();
      const log = await addLog(
        id,
        '2026-10-30T05:00:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      await sync();
      const before = await db
        .getRepository(WorkLogEntity)
        .findOneByOrFail({ id: log });
      const calls = google.calls.length;

      Object.assign(google.events(OWN)[0], {
        summary: 'Umbenannt in Google',
        ...timed('2026-10-30T09:00:00.000Z', '2026-10-30T10:00:00.000Z'),
        updated: google.stamp(),
      });
      await sync();
      expect(
        await db.getRepository(WorkLogEntity).findOneByOrFail({ id: log }),
      ).toEqual(before);
      expect((await todos()).map((todo) => todo.title)).toEqual(['Schreiben']);
      expect(google.calls).toHaveLength(calls);

      google.events(OWN)[0].status = 'cancelled';
      await sync();
      await sync();
      expect(live()).toEqual([]);
      expect(google.calls).toHaveLength(calls);

      // A later correction does not write it again either.
      await correct(
        log,
        '2026-10-30T05:05:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      await sync();
      expect(google.calls).toHaveLength(calls);

      // Once the log is gone, so is its link, without a call.
      await request(server).delete(`/work-logs/${log}`).expect(204);
      await sync();
      expect(await db.getRepository(CalendarLinkEntity).count()).toBe(0);
      expect(google.calls).toHaveLength(calls);
    });

    it('keeps an event deleted in Google outside the read window deleted', async () => {
      await connect();
      const id = await quest();
      const log = await addLog(
        id,
        '2026-10-30T05:00:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      await sync();
      // Gone without a trace, like a past event the sync no longer reads.
      google.calendars.set(OWN, []);
      await correct(
        log,
        '2026-10-30T05:05:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      await sync();
      await sync();

      expect(google.events(OWN)).toEqual([]);
      expect(
        await db.getRepository(CalendarLinkEntity).findOneByOrFail({
          workLogId: log,
        }),
      ).toMatchObject({ suppressed: true });
    });

    it('does not adopt a Logbuch event that lost its link as a quest', async () => {
      await connect();
      const id = await quest();
      await addLog(id, '2026-10-30T05:00:00.000Z', '2026-10-30T05:30:00.000Z');
      await sync();
      await db.getRepository(CalendarLinkEntity).clear();
      await sync();

      expect((await todos()).map((todo) => todo.title)).toEqual(['Schreiben']);
    });

    it('writes only into its own calendar, also with shared ones connected', async () => {
      await connect();
      google.add('shared', {
        summary: 'Familie',
        ...timed('2026-10-30T08:00:00.000Z', '2026-10-30T09:00:00.000Z'),
      });
      google.add('primary', {
        summary: 'Besprechung',
        ...timed('2026-10-30T10:00:00.000Z', '2026-10-30T11:00:00.000Z'),
      });
      const appointment = await scheduledTodo();
      const log = await addLog(
        await quest(),
        '2026-10-30T05:00:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      await sync();
      await request(server)
        .patch(`/todos/${appointment}`)
        .send({ title: 'Bericht neu' })
        .expect(200);
      await correct(
        log,
        '2026-10-30T05:10:00.000Z',
        '2026-10-30T05:30:00.000Z',
      );
      await sync();
      await request(server)
        .patch(`/todos/${appointment}`)
        .send({ timeOfDay: null })
        .expect(200);
      await request(server).delete(`/work-logs/${log}`).expect(204);
      await sync();

      expect(google.calls.map(({ method }) => method).sort()).toEqual([
        'delete',
        'delete',
        'insert',
        'insert',
        'patch',
        'patch',
      ]);
      expect(google.calls.every(({ calendarId }) => calendarId === OWN)).toBe(
        true,
      );
      expect(google.events('shared')).toHaveLength(1);
      expect(google.events('primary')).toHaveLength(1);
    });
  });
});
