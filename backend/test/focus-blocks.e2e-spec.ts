import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import anonymous from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import type { FocusBlockStateResponse } from '../src/focus-blocks/focus-block.dto';
import { FocusBlockEntity } from '../src/focus-blocks/focus-block.entities';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import type { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import type { StartTimerDto } from '../src/timers/timer.dto';
import type { TimerResponse } from '../src/timers/timers.service';
import { authenticatedRequest, seedAuth } from './auth-fixture';
import { resetDatabase } from './reset-database';

describe('Fokus-Sperre (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let server: Server;
  let now: Date;
  const clock = {
    now: () => new Date(now),
    today: () => dayOf(new Date(now)),
  };
  const MINUTE = 60_000;
  const later = (milliseconds: number): void => {
    now = new Date(now.getTime() + milliseconds);
  };
  const client = () => authenticatedRequest(server);
  const state = async () =>
    (await client().get('/focus-block').expect(200))
      .body as FocusBlockStateResponse;
  const settings = (change: object) =>
    client().put('/focus-block/settings').send(change).expect(200);
  const start = async (input: StartTimerDto) =>
    (await client().post('/timers').send(input).expect(201))
      .body as TimerResponse;
  const timerAction = async (id: string, kind: string, body: object = {}) =>
    (await client().post(`/timers/${id}/${kind}`).send(body).expect(201))
      .body as TimerResponse;
  async function todo(fields: object = {}) {
    const response = await client()
      .post('/todos')
      .send({
        title: 'Kapitel schreiben',
        plannedDurationMinutes: 30,
        ...fields,
      })
      .expect(201);
    return (response.body as { id: number }).id;
  }
  const blocks = () =>
    db.getRepository(FocusBlockEntity).find({ order: { startedAt: 'ASC' } });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    server = app.getHttpServer() as Server;
    if (db.options.database !== 'habit_tracker_test')
      throw new Error('Test DB required');
  });
  beforeEach(async () => {
    await resetDatabase(db);
    await seedAuth(app);
    now = new Date();
  });
  afterAll(async () => {
    if (db?.isInitialized) await resetDatabase(db);
    await app?.close();
  });

  it('needs a session', async () => {
    await anonymous(server).get('/focus-block').expect(401);
  });

  it('starts on with the stopwatch trigger, names the app itself as always allowed and answers 304 while unchanged', async () => {
    const first = await client().get('/focus-block').expect(200);
    const body = first.body as FocusBlockStateResponse;
    expect(body).toMatchObject({
      settings: {
        enabled: true,
        trigger: 'stopwatch',
        thresholdMinutes: 15,
        mode: 'soft',
        listMode: 'blocklist',
      },
      block: null,
      lists: { block: [], allow: [] },
      fixedDomains: [new URL(process.env.FRONTEND_URL!).hostname],
    });
    expect(first.headers.etag).toBe(`"${body.version}"`);
    later(5_000);
    await client()
      .get('/focus-block')
      .set('If-None-Match', first.headers.etag)
      .expect(304);
    await settings({ enabled: false });
    const changed = await client()
      .get('/focus-block')
      .set('If-None-Match', first.headers.etag)
      .expect(200);
    expect((changed.body as FocusBlockStateResponse).version).not.toBe(
      body.version,
    );
  });

  it('keeps the settings and both lists, with websites reduced to their host', async () => {
    const saved = (
      await settings({
        trigger: 'threshold',
        thresholdMinutes: 25,
        mode: 'hardcore',
      })
    ).body as FocusBlockStateResponse;
    expect(saved.settings).toEqual({
      enabled: true,
      trigger: 'threshold',
      thresholdMinutes: 25,
      mode: 'hardcore',
      listMode: 'blocklist',
    });
    await client()
      .post('/focus-block/entries')
      .send({
        list: 'block',
        kind: 'domain',
        value: 'https://www.YouTube.com/x',
      })
      .expect(201);
    // The same entry twice changes nothing.
    await client()
      .post('/focus-block/entries')
      .send({ list: 'block', kind: 'domain', value: 'youtube.com' })
      .expect(201);
    await client()
      .post('/focus-block/entries')
      .send({
        list: 'block',
        kind: 'app',
        value: 'com.google.android.youtube',
        label: 'YouTube',
      })
      .expect(201);
    const allowed = (
      await client()
        .post('/focus-block/entries')
        .send({ list: 'allow', kind: 'domain', value: 'wikipedia.org' })
        .expect(201)
    ).body as FocusBlockStateResponse;
    expect(allowed.lists.block).toEqual([
      expect.objectContaining({
        kind: 'app',
        value: 'com.google.android.youtube',
        label: 'YouTube',
      }),
      expect.objectContaining({
        kind: 'domain',
        value: 'youtube.com',
        label: null,
      }),
    ]);
    expect(allowed.lists.allow).toEqual([
      expect.objectContaining({ kind: 'domain', value: 'wikipedia.org' }),
    ]);
    await client()
      .post('/focus-block/entries')
      .send({ list: 'block', kind: 'domain', value: 'youtube' })
      .expect(400);
    await client()
      .post('/focus-block/entries')
      .send({ list: 'block', kind: 'app', value: 'nur ein name' })
      .expect(400);
    await client()
      .put('/focus-block/settings')
      .send({ thresholdMinutes: 0 })
      .expect(400);
    await client()
      .put('/focus-block/settings')
      .send({ trigger: 'focus' })
      .expect(400);
    const removed = (
      await client()
        .delete(`/focus-block/entries/${allowed.lists.allow[0].id}`)
        .expect(200)
    ).body as FocusBlockStateResponse;
    expect(removed.lists.allow).toEqual([]);
    await client().delete('/focus-block/entries/99999').expect(404);
  });

  it('blocks whenever a stopwatch runs, wherever it started: Soft ends on pause, starts again on resume and ends with the stopwatch', async () => {
    // No Soll, no focusBlock in the request: Heute's play button.
    const id = await todo({ plannedDurationMinutes: null });
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    const first = (await state()).block!;
    expect(first).toMatchObject({
      title: 'Kapitel schreiben',
      todoId: id,
      mode: 'soft',
      listMode: 'blocklist',
      endsAt: null,
    });
    later(MINUTE);
    await timerAction(timer.id, 'pause');
    expect((await state()).block).toBeNull();
    later(MINUTE);
    await timerAction(timer.id, 'resume');
    const second = (await state()).block!;
    expect(second.id).not.toBe(first.id);
    // Lifted by hand, it stays lifted while the stopwatch runs.
    await client().post('/focus-block/end').send({}).expect(200);
    expect((await state()).block).toBeNull();
    later(MINUTE);
    await timerAction(timer.id, 'pause');
    later(MINUTE);
    await timerAction(timer.id, 'resume');
    expect((await state()).block).not.toBeNull();

    // Switching to another target ends the block and starts one for it.
    later(MINUTE);
    const other = await todo({ title: 'Mails' });
    await start({ kind: 'todo', targetId: other, replaceTimerId: timer.id });
    expect((await state()).block).toMatchObject({ todoId: other });
    const current = (
      (await client().get('/timers/current').expect(200)).body as TimerResponse
    ).timer!;
    await timerAction(current.id, 'stop');
    expect((await state()).block).toBeNull();
    expect((await blocks()).map((row) => row.endReason)).toEqual([
      'paused',
      'lifted',
      'stopwatch_stopped',
      'stopwatch_stopped',
    ]);
  });

  it('holds Hardcore through pauses, refuses lifting with 409 and ends when the stopwatch ends', async () => {
    await settings({ mode: 'hardcore' });
    await client()
      .post('/focus-block/entries')
      .send({ list: 'block', kind: 'domain', value: 'reddit.com' })
      .expect(201);
    const id = await todo({ plannedDurationMinutes: null });
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    const block = (await state()).block!;
    expect(block).toMatchObject({ mode: 'hardcore', endsAt: null });

    const refused = await client()
      .post('/focus-block/end')
      .send({})
      .expect(409);
    expect((refused.body as { code: string }).code).toBe('HARDCORE_BLOCK');
    // The lists only get stricter meanwhile.
    const entries = (await state()).lists.block;
    await client().delete(`/focus-block/entries/${entries[0].id}`).expect(409);
    await client()
      .post('/focus-block/entries')
      .send({ list: 'allow', kind: 'domain', value: 'reddit.com' })
      .expect(409);
    await client()
      .post('/focus-block/entries')
      .send({ list: 'block', kind: 'domain', value: 'youtube.com' })
      .expect(201);

    later(10 * MINUTE);
    await timerAction(timer.id, 'pause');
    later(60 * MINUTE);
    expect((await state()).block).toMatchObject({ id: block.id });
    await timerAction(timer.id, 'resume');
    expect((await state()).block).toMatchObject({ id: block.id });
    await timerAction(timer.id, 'stop');
    expect((await state()).block).toBeNull();
    expect(await blocks()).toEqual([
      expect.objectContaining({ endReason: 'stopwatch_stopped' }),
    ]);
  });

  it('follows the per-task choice and stays off while switched off, except "Immer"', async () => {
    const never = await todo({ focusBlock: 'never' });
    const first = (await start({ kind: 'todo', targetId: never })).timer!;
    expect((await state()).block).toBeNull();
    await timerAction(first.id, 'stop');

    await settings({ enabled: false });
    const plain = await todo();
    const second = (await start({ kind: 'todo', targetId: plain })).timer!;
    expect((await state()).block).toBeNull();
    await timerAction(second.id, 'stop');

    const always = await todo({ plannedDurationMinutes: 5 });
    await client()
      .patch(`/todos/${always}`)
      .send({ focusBlock: 'always' })
      .expect(200);
    const todos = (await client().get('/todos').expect(200)).body as {
      id: number;
      focusBlock: string;
    }[];
    expect(todos.find((entry) => entry.id === always)?.focusBlock).toBe(
      'always',
    );
    await start({ kind: 'todo', targetId: always });
    expect((await state()).block).toMatchObject({ todoId: always });
  });

  it('blocks with the threshold trigger only from the Soll on, and holds its Hardcore through pause and stop until the Soll', async () => {
    await settings({ trigger: 'threshold', thresholdMinutes: 20 });
    const short = await todo({ plannedDurationMinutes: 10 });
    const first = (await start({ kind: 'todo', targetId: short })).timer!;
    expect((await state()).block).toBeNull();
    await timerAction(first.id, 'stop');

    const id = await todo({ plannedDurationMinutes: 30 });
    const timer = (
      await start({
        kind: 'todo',
        targetId: id,
        focusBlock: { mode: 'hardcore' },
      })
    ).timer!;
    const block = (await state()).block!;
    expect(block.mode).toBe('hardcore');
    expect(block.endsAt).toBe(
      new Date(now.getTime() + 30 * MINUTE).toISOString(),
    );
    await client().post('/focus-block/end').send({}).expect(409);

    later(10 * MINUTE);
    await timerAction(timer.id, 'pause');
    await timerAction(timer.id, 'stop');
    expect((await state()).block).toMatchObject({ id: block.id });

    later(20 * MINUTE);
    expect((await state()).block).toBeNull();
    expect(await blocks()).toEqual([
      expect.objectContaining({
        endReason: 'target_reached',
        endedAt: new Date(block.endsAt!),
      }),
    ]);
  });

  it('ends Hardcore when its quest or daily run is completed', async () => {
    const id = await todo();
    await start({
      kind: 'todo',
      targetId: id,
      focusBlock: { mode: 'hardcore' },
    });
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    expect((await state()).block).toBeNull();

    const habit = (
      await client()
        .post('/habits')
        .send({
          title: 'Üben',
          plannedDurationMinutes: 20,
          focusBlock: 'always',
          schedule: { type: 'interval', intervalDays: 1 },
        })
        .expect(201)
    ).body as HabitResponseDto;
    expect(habit.focusBlock).toBe('always');
    const occurrenceId = (
      (await client().get(`/habits/${habit.id}`).expect(200))
        .body as HabitResponseDto
    ).timerOccurrenceId!;
    const today = (await client().get('/day-planner/today').expect(200))
      .body as DayPlannerResponseDto;
    expect(
      today.items.find(
        (item) => item.type === 'habit' && item.occurrenceId === occurrenceId,
      ),
    ).toMatchObject({ focusBlock: 'always' });
    await start({
      kind: 'occurrence',
      targetId: occurrenceId,
      focusBlock: { mode: 'hardcore' },
    });
    expect((await state()).block).toMatchObject({
      occurrenceId,
      mode: 'hardcore',
    });
    await client()
      .patch(`/habit-occurrences/${occurrenceId}/status`)
      .send({ status: 'completed' })
      .expect(200);
    expect((await state()).block).toBeNull();
    // Completing stops the stopwatch in the same change, which already ends
    // a Hardcore block bound to it (with the threshold trigger: 'completed').
    expect((await blocks()).map((row) => row.endReason)).toEqual([
      'stopwatch_stopped',
      'stopwatch_stopped',
    ]);
  });

  it('starts Hardcore without a Soll ahead as Soft with the threshold trigger', async () => {
    await settings({ trigger: 'threshold' });
    const id = await todo({
      plannedDurationMinutes: null,
      focusBlock: 'always',
    });
    await start({
      kind: 'todo',
      targetId: id,
      focusBlock: { mode: 'hardcore' },
    });
    expect((await state()).block).toMatchObject({ mode: 'soft', endsAt: null });
    const lifted = (
      await client().post('/focus-block/end').send({}).expect(200)
    ).body as FocusBlockStateResponse;
    expect(lifted.block).toBeNull();
    expect(await blocks()).toEqual([
      expect.objectContaining({ endReason: 'lifted' }),
    ]);
    // Nothing open: lifting again changes nothing.
    await client().post('/focus-block/end').send({}).expect(200);
  });

  it('starts a block by hand only with a stopwatch, and takes the mode picked on resume', async () => {
    await settings({ enabled: false });
    const refused = await client().post('/focus-block').send({}).expect(409);
    expect((refused.body as { code: string }).code).toBe('NO_ACTIVE_TIMER');
    const id = await todo({ plannedDurationMinutes: 10 });
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    expect((await state()).block).toBeNull();
    // By hand, whatever the trigger says.
    const manual = (
      await client().post('/focus-block').send({ mode: 'soft' }).expect(201)
    ).body as FocusBlockStateResponse;
    expect(manual.block).toMatchObject({ todoId: id, mode: 'soft' });
    await client().post('/focus-block/end').send({}).expect(200);

    await settings({
      enabled: true,
      trigger: 'threshold',
      thresholdMinutes: 5,
    });
    await timerAction(timer.id, 'pause');
    later(2 * MINUTE);
    await timerAction(timer.id, 'resume', { focusBlock: { mode: 'hardcore' } });
    const resumed = (await state()).block!;
    expect(resumed).toMatchObject({ mode: 'hardcore' });
    expect(resumed.endsAt).not.toBeNull();
    await client()
      .post(`/timers/${timer.id}/resume`)
      .send({ focusBlock: { mode: 'strict' } })
      .expect(400);
  });
});
