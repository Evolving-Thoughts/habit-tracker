import { DEFAULT_TIME_ZONE } from '../common/date/date-only.utils';
import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { ScheduleDto } from '../habits/dto/schedule.dto';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import {
  buildVersion,
  normalizeSchedule,
} from '../habits/scheduling/schedule-rules';
import {
  DescribedLog,
  eventEdit,
  IncomingStep,
  incomingStep,
  lastSyncedDay,
  logbookSince,
  logPushes,
  logSteps,
  plannedTimes,
  PushOperation,
  runPushes,
  SyncCandidateRun,
  SyncLink,
  SyncLog,
  SyncRun,
  SyncTodo,
  todoPushes,
} from './calendar-sync-rules';
import { GoogleEvent } from './google-calendar.client';

// Friday 2026-11-20, 11:00 in Berlin.
const TODAY = '2026-11-20';
const NOW = new Date('2026-11-20T10:00:00.000Z');
const T0 = new Date('2026-11-01T00:00:00.000Z');
const T1 = new Date('2026-11-10T00:00:00.000Z');
const T2 = new Date('2026-11-15T00:00:00.000Z');

type Link = SyncLink & { name: string };
const link = (name: string, change: Partial<SyncLink>): Link => ({
  name,
  todoId: null,
  occurrenceId: null,
  workLogId: null,
  remoteUpdatedAt: T1,
  syncedAt: T1,
  suppressed: false,
  ...change,
});

const event = (change: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: 'e1',
  summary: 'Zahnarzt',
  updated: T2.toISOString(),
  // 14:30 to 15:15 in Berlin.
  start: { dateTime: '2026-11-20T13:30:00.000Z' },
  end: { dateTime: '2026-11-20T14:15:00.000Z' },
  ...change,
});
const allDay = { start: { date: TODAY }, end: { date: '2026-11-21' } };
const marked = { extendedProperties: { private: { habitTracker: 'true' } } };

/** The body the app sends for an event in Berlin time. */
const body = (
  summary: string,
  start: string,
  end: string,
  description?: string,
) => ({
  summary,
  ...(description ? { description } : {}),
  start: { dateTime: start, timeZone: DEFAULT_TIME_ZONE },
  end: { dateTime: end, timeZone: DEFAULT_TIME_ZONE },
  extendedProperties: { private: { habitTracker: 'true' } },
});

/** Pushes as short words, to read a plan at a glance. */
const names = (push: PushOperation<Link>[]): string[] =>
  push.map((op) =>
    op.type === 'insert'
      ? `insert ${op.local.todoId ?? op.local.occurrenceId ?? op.local.workLogId}`
      : `${op.type} ${op.link.name}`,
  );

describe('calendar sync: windows', () => {
  it('reads and writes 60 days ahead', () => {
    expect(lastSyncedDay(TODAY)).toBe('2027-01-19');
  });

  it('exports new Logbuch stretches back 31 days, from midnight in Berlin', () => {
    expect(logbookSince(TODAY)).toEqual(new Date('2026-10-19T22:00:00.000Z'));
  });
});

describe('calendar sync: events planned in Google', () => {
  it.each<[string, Partial<GoogleEvent>, boolean]>([
    ['a timed event', {}, true],
    ['a cancelled event', { status: 'cancelled' }, false],
    ['an all-day event', allDay, false],
    ['an event the app wrote', marked, false],
  ])('%s counts: %s', (_, change, counts) => {
    const times = plannedTimes(event(change));
    expect(times !== null).toBe(counts);
  });

  it('gives start, end and whole minutes', () => {
    expect(plannedTimes(event())).toEqual({
      start: new Date('2026-11-20T13:30:00.000Z'),
      end: new Date('2026-11-20T14:15:00.000Z'),
      minutes: 45,
    });
  });
});

describe('calendar sync: incoming step', () => {
  const todoLink = link('todo', { todoId: 1 });
  const runLink = link('run', { occurrenceId: 2 });
  const logLink = link('log', { workLogId: 3 });
  const older = { updated: T0.toISOString() };
  const same = { updated: T1.toISOString() };

  it.each<[string, Link | undefined, Partial<GoogleEvent>, IncomingStep]>([
    [
      'an unknown event becomes an appointment',
      undefined,
      {},
      {
        kind: 'adopt',
        appointment: {
          title: 'Zahnarzt',
          scheduledDate: TODAY,
          timeOfDay: '14:30',
          plannedDurationMinutes: 45,
        },
      },
    ],
    [
      'an unknown cancelled event is left',
      undefined,
      { status: 'cancelled' },
      { kind: 'none' },
    ],
    ['an unknown all-day event is left', undefined, allDay, { kind: 'none' }],
    [
      'an unknown event the app wrote is left',
      undefined,
      marked,
      { kind: 'none' },
    ],
    [
      'a cancelled quest event is a deletion',
      todoLink,
      { status: 'cancelled' },
      { kind: 'deleted' },
    ],
    [
      'a cancelled run event is a deletion',
      runLink,
      { status: 'cancelled' },
      { kind: 'deleted' },
    ],
    [
      'a cancelled Logbuch event is a deletion',
      logLink,
      { status: 'cancelled' },
      { kind: 'deleted' },
    ],
    ['an edited Logbuch event changes nothing', logLink, {}, { kind: 'none' }],
    ['an older quest event changes nothing', todoLink, older, { kind: 'none' }],
    [
      'a quest event seen already changes nothing',
      todoLink,
      same,
      { kind: 'none' },
    ],
    ['a newer quest event edits the quest', todoLink, {}, { kind: 'editTodo' }],
    [
      'a newer all-day quest event still goes to the quest',
      todoLink,
      allDay,
      { kind: 'editTodo' },
    ],
    [
      'a run event seen already changes nothing',
      runLink,
      same,
      { kind: 'none' },
    ],
    [
      'a newer run event moves the run to its day',
      runLink,
      {},
      { kind: 'moveRun', day: TODAY },
    ],
    [
      'a newer all-day run event moves nothing',
      runLink,
      allDay,
      { kind: 'moveRun', day: null },
    ],
  ])('%s', (_, known, change, step) => {
    expect(incomingStep(known, event(change))).toEqual(step);
  });

  it('takes the Berlin day of an event after midnight there', () => {
    const late = event({
      start: { dateTime: '2026-11-20T23:30:00.000Z' },
      end: { dateTime: '2026-11-21T00:00:00.000Z' },
    });
    expect(incomingStep(undefined, late)).toMatchObject({
      appointment: { scheduledDate: '2026-11-21', timeOfDay: '00:30' },
    });
    expect(incomingStep(runLink, late)).toEqual({
      kind: 'moveRun',
      day: '2026-11-21',
    });
  });

  it('names an untitled event "Termin" and cuts long titles', () => {
    const step = (summary?: string) =>
      incomingStep(undefined, event({ summary })) as {
        appointment: { title: string };
      };
    expect(step('  ').appointment.title).toBe('Termin');
    expect(step(undefined).appointment.title).toBe('Termin');
    expect(step(` ${'a'.repeat(250)} `).appointment.title).toBe(
      'a'.repeat(200),
    );
  });
});

describe('calendar sync: an edit from Google on a quest', () => {
  const quest = (change: Partial<SyncTodo> = {}) => ({
    title: 'Bericht',
    completedAt: null,
    updatedAt: T1,
    ...change,
  });
  const synced = { syncedAt: T1 };
  const edit = {
    title: 'Zahnarzt',
    scheduledDate: TODAY,
    timeOfDay: '14:30',
    plannedDurationMinutes: 45,
  };
  // The event was edited at T2.
  const afterEvent = new Date('2026-11-16T00:00:00.000Z');

  it.each<[string, Partial<SyncTodo>, Partial<GoogleEvent>, object | null]>([
    ['unchanged here: Google wins', {}, {}, edit],
    [
      'changed here before the event: Google wins',
      { updatedAt: new Date('2026-11-12T00:00:00.000Z') },
      {},
      edit,
    ],
    [
      'changed here after the event: the quest wins',
      { updatedAt: afterEvent },
      {},
      null,
    ],
    ['completed: left alone', { completedAt: T2 }, {}, null],
    ['all-day event: nothing to take', {}, allDay, null],
    [
      'untitled event: keeps its title',
      {},
      { summary: ' ' },
      { ...edit, title: 'Bericht' },
    ],
  ])('%s', (_, change, eventChange, expected) => {
    expect(eventEdit(quest(change), synced, event(eventChange))).toEqual(
      expected,
    );
  });

  it('lets a quest newer than the event lose when that state was synced', () => {
    // Newer than the event, but no newer than the last exchange.
    expect(
      eventEdit(
        quest({ updatedAt: afterEvent }),
        { syncedAt: afterEvent },
        event(),
      ),
    ).toEqual(edit);
  });
});

describe('calendar sync: quests going out', () => {
  const todo = (id: number, change: Partial<SyncTodo> = {}): SyncTodo => ({
    id,
    title: `Quest ${id}`,
    scheduledDate: TODAY,
    timeOfDay: '09:00',
    plannedDurationMinutes: 60,
    completedAt: null,
    deletedAt: null,
    updatedAt: T1,
    ...change,
  });

  it.each<[string, SyncTodo | undefined, string[], string[]]>([
    ['a missing quest loses its event', undefined, ['delete a'], []],
    [
      'a deleted quest loses its event',
      todo(1, { deletedAt: T2 }),
      ['delete a'],
      [],
    ],
    [
      'a quest without a day loses its event',
      todo(1, { scheduledDate: null, timeOfDay: null }),
      ['delete a'],
      [],
    ],
    [
      'a quest without a time loses its event',
      todo(1, { timeOfDay: null }),
      ['delete a'],
      [],
    ],
    [
      'a completed quest keeps its event, without the link',
      todo(1, { completedAt: T2 }),
      [],
      ['a'],
    ],
    [
      'a changed quest patches its event',
      todo(1, { updatedAt: T2 }),
      ['patch a'],
      [],
    ],
    ['an unchanged quest sends nothing', todo(1), [], []],
  ])('%s', (_, known, push, unlink) => {
    const plan = todoPushes(
      [link('a', { todoId: 1 })],
      known ? [known] : [],
      [],
    );
    expect(names(plan.push)).toEqual(push);
    expect(plan.unlink.map(({ name }) => name)).toEqual(unlink);
  });

  it('writes each open appointment without a link, after the linked ones', () => {
    const plan = todoPushes(
      [
        link('a', { todoId: 1 }),
        link('run', { occurrenceId: 1 }),
        link('log', { workLogId: 2 }),
      ],
      [todo(1, { updatedAt: T2 })],
      [todo(2), todo(1), todo(3)],
    );
    expect(names(plan.push)).toEqual(['patch a', 'insert 2', 'insert 3']);
    expect(plan.unlink).toEqual([]);
  });

  it('sends the appointment at its Berlin time, 30 minutes without a length', () => {
    const [patch, insert] = todoPushes(
      [link('a', { todoId: 1 })],
      [todo(1, { updatedAt: T2 })],
      [todo(2, { plannedDurationMinutes: null, timeOfDay: '23:45' })],
    ).push;
    expect(patch).toMatchObject({
      input: body(
        'Quest 1',
        '2026-11-20T08:00:00.000Z',
        '2026-11-20T09:00:00.000Z',
      ),
      localUpdatedAt: T2,
    });
    expect(insert).toEqual({
      type: 'insert',
      local: { todoId: 2, occurrenceId: null, workLogId: null },
      input: body(
        'Quest 2',
        '2026-11-20T22:45:00.000Z',
        '2026-11-20T23:15:00.000Z',
      ),
      localUpdatedAt: T1,
    });
  });
});

describe('calendar sync: daily runs going out', () => {
  const version = (
    change: Partial<HabitScheduleVersionEntity> = {},
  ): HabitScheduleVersionEntity =>
    Object.assign(
      buildVersion(
        1,
        normalizeSchedule({
          type: 'interval',
          intervalDays: 1,
          missedOccurrencePolicy: 'skip',
        } as ScheduleDto),
        // 2026-11-01, midnight in Berlin.
        new Date('2026-10-31T23:00:00.000Z'),
      ),
      { id: 1, endsAt: null, cancelledAt: null, ...change },
    );
  const habit = (change: Partial<SyncRun['habit']> = {}) => ({
    title: 'Laufen',
    isActive: true,
    timeOfDay: '07:00',
    plannedDurationMinutes: 20,
    updatedAt: T0,
    ...change,
  });
  const run = (
    id: number,
    change: Partial<SyncCandidateRun> = {},
  ): SyncCandidateRun => ({
    id,
    status: Status.PENDING,
    scheduledDate: TODAY,
    movedToDate: null,
    plannedDurationMinutes: null,
    updatedAt: T0,
    habit: habit(),
    scheduleVersion: version(),
    ...change,
  });

  it.each<[string, Partial<SyncLink>, SyncRun | undefined, string[], string[]]>(
    [
      [
        'a completed run keeps its event, without the link',
        {},
        run(1, { status: Status.COMPLETED }),
        [],
        ['a'],
      ],
      [
        'a completed run drops even a suppressed link',
        { suppressed: true },
        run(1, { status: Status.COMPLETED }),
        [],
        ['a'],
      ],
      [
        'a suppressed open run stays without event',
        { suppressed: true },
        run(1, { updatedAt: T2 }),
        [],
        [],
      ],
      [
        'a suppressed skipped run drops the link',
        { suppressed: true },
        run(1, { status: Status.SKIPPED }),
        [],
        ['a'],
      ],
      [
        'a suppressed missing run drops the link',
        { suppressed: true },
        undefined,
        [],
        ['a'],
      ],
      ['a missing run loses its event', {}, undefined, ['delete a'], []],
      [
        'a skipped run loses its event',
        {},
        run(1, { status: Status.SKIPPED }),
        ['delete a'],
        [],
      ],
      [
        'a run of a paused habit loses its event',
        {},
        run(1, { habit: habit({ isActive: false }) }),
        ['delete a'],
        [],
      ],
      [
        'a run whose habit lost its time loses its event',
        {},
        run(1, { habit: habit({ timeOfDay: null }) }),
        ['delete a'],
        [],
      ],
      [
        'a changed run patches its event',
        {},
        run(1, { updatedAt: T2 }),
        ['patch a'],
        [],
      ],
      [
        'a changed habit patches its event',
        {},
        run(1, { habit: habit({ updatedAt: T2 }) }),
        ['patch a'],
        [],
      ],
      ['an unchanged run sends nothing', {}, run(1), [], []],
    ],
  )('%s', (_, change, known, push, unlink) => {
    const plan = runPushes(
      [link('a', { occurrenceId: 1, ...change })],
      known ? [known] : [],
      [],
      TODAY,
      NOW,
    );
    expect(names(plan.push)).toEqual(push);
    expect(plan.unlink.map(({ name }) => name)).toEqual(unlink);
  });

  it.each<[string, SyncCandidateRun, boolean]>([
    ['an open run due today', run(5), true],
    [
      'a run moved ahead within its window',
      run(5, { movedToDate: '2026-11-21' }),
      true,
    ],
    [
      'a run due on the last synced day',
      run(5, { scheduledDate: '2027-01-19' }),
      true,
    ],
    [
      'a run due after the last synced day',
      run(5, { scheduledDate: '2027-01-20' }),
      false,
    ],
    ['a run due before today', run(5, { scheduledDate: '2026-11-19' }), false],
    [
      'a run of a habit without a time',
      run(5, { habit: habit({ timeOfDay: null }) }),
      false,
    ],
    [
      'a run of a paused habit',
      run(5, { habit: habit({ isActive: false }) }),
      false,
    ],
    [
      'a run of a cancelled version',
      run(5, { scheduleVersion: version({ cancelledAt: T1 }) }),
      false,
    ],
    [
      'a run whose window closed',
      run(5, { scheduledDate: '2026-11-19', movedToDate: '2026-11-21' }),
      false,
    ],
    ['a run linked already', run(1), false],
  ])('writes %s: %s', (_, candidate, written) => {
    const plan = runPushes(
      [link('a', { occurrenceId: 1, suppressed: true })],
      [run(1)],
      [candidate],
      TODAY,
      NOW,
    );
    expect(names(plan.push)).toEqual(written ? [`insert ${candidate.id}`] : []);
  });

  it('sends the run on its due day at the habit time, with its own length first', () => {
    const [patch, insert, fallback] = runPushes(
      [link('a', { occurrenceId: 1 })],
      [run(1, { updatedAt: T2, movedToDate: '2026-11-21' })],
      [
        run(2, { plannedDurationMinutes: 45 }),
        run(3, { habit: habit({ plannedDurationMinutes: null }) }),
      ],
      TODAY,
      NOW,
    ).push;
    expect(patch).toMatchObject({
      input: body(
        'Laufen',
        '2026-11-21T06:00:00.000Z',
        '2026-11-21T06:20:00.000Z',
      ),
      localUpdatedAt: T2,
    });
    expect(insert).toEqual({
      type: 'insert',
      local: { todoId: null, occurrenceId: 2, workLogId: null },
      input: body(
        'Laufen',
        '2026-11-20T06:00:00.000Z',
        '2026-11-20T06:45:00.000Z',
      ),
      localUpdatedAt: T0,
    });
    expect(fallback).toMatchObject({
      input: body(
        'Laufen',
        '2026-11-20T06:00:00.000Z',
        '2026-11-20T06:30:00.000Z',
      ),
    });
  });

  it('dates a change by the newer of run and habit', () => {
    const [patch] = runPushes(
      [link('a', { occurrenceId: 1 })],
      [run(1, { updatedAt: T2, habit: habit({ updatedAt: NOW }) })],
      [],
      TODAY,
      NOW,
    ).push;
    expect(patch).toMatchObject({ localUpdatedAt: NOW });
  });
});

describe('calendar sync: the Logbuch going out', () => {
  const log = (id: number, minutes: number, updatedAt = T1): SyncLog => ({
    id,
    startedAt: new Date('2026-11-20T08:00:00.000Z'),
    endedAt: new Date(
      Date.parse('2026-11-20T08:00:00.000Z') + minutes * 60_000,
    ),
    updatedAt,
  });

  it.each<
    [
      string,
      Partial<SyncLink>,
      SyncLog | undefined,
      string[],
      string[],
      number[],
    ]
  >([
    ['a deleted log loses its event', {}, undefined, ['delete a'], [], []],
    ['a corrected log patches its event', {}, log(1, 30, T2), [], [], [1]],
    ['an unchanged log sends nothing', {}, log(1, 30), [], [], []],
    [
      'a corrected log shortened below five minutes still patches',
      {},
      log(1, 2, T2),
      [],
      [],
      [1],
    ],
    [
      'an event deleted in Google stays deleted',
      { suppressed: true },
      log(1, 30, T2),
      [],
      [],
      [],
    ],
    [
      'a suppressed link goes with its log',
      { suppressed: true },
      undefined,
      [],
      ['a'],
      [],
    ],
  ])('%s', (_, change, known, push, unlink, patched) => {
    const steps = logSteps(
      [link('a', { workLogId: 1, ...change })],
      known ? [known] : [],
      [],
    );
    expect(names(steps.push)).toEqual(push);
    expect(steps.unlink.map(({ name }) => name)).toEqual(unlink);
    expect(steps.patched.map(({ log }) => log.id)).toEqual(patched);
    expect(steps.fresh).toEqual([]);
  });

  it('writes each unlinked stretch of five minutes or more', () => {
    const steps = logSteps(
      [
        link('a', { workLogId: 1 }),
        link('b', { workLogId: 2, suppressed: true }),
        link('todo', { todoId: 7 }),
      ],
      [log(1, 30), log(2, 30)],
      [log(1, 30), log(2, 30), log(3, 5), log(4, 4), log(5, 90), log(7, 30)],
    );
    expect(steps.fresh.map(({ id }) => id)).toEqual([3, 5, 7]);
  });

  it('sends deletions, then patches, then new events, named as Logbuch', () => {
    const steps = logSteps(
      [link('gone', { workLogId: 9 }), link('a', { workLogId: 1 })],
      [log(1, 30, T2)],
      [log(1, 30, T2), log(3, 10)],
    );
    const described: DescribedLog[] = [
      { ...log(1, 30, T2), title: 'Bericht', campaign: { title: 'Umzug' } },
      { ...log(3, 10), title: 'Lesen', campaign: null },
    ];
    const push = logPushes(steps, described);
    expect(names(push)).toEqual(['delete gone', 'patch a', 'insert 3']);
    expect(push[1]).toMatchObject({
      input: body(
        'Bericht',
        '2026-11-20T08:00:00.000Z',
        '2026-11-20T08:30:00.000Z',
        'Logbuch · gemessene Arbeitszeit\nKampagne: Umzug',
      ),
      localUpdatedAt: T2,
    });
    expect(push[2]).toEqual({
      type: 'insert',
      local: { todoId: null, occurrenceId: null, workLogId: 3 },
      input: body(
        'Lesen',
        '2026-11-20T08:00:00.000Z',
        '2026-11-20T08:10:00.000Z',
        'Logbuch · gemessene Arbeitszeit',
      ),
      localUpdatedAt: T1,
    });
  });

  it('sends only the deletions when nothing needs describing', () => {
    const steps = logSteps([link('gone', { workLogId: 9 })], [], []);
    expect(names(logPushes(steps, []))).toEqual(['delete gone']);
  });
});
