import { atWallClockMinutes, dayOf } from '../src/common/date/local-day';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import anonymous from 'supertest';
import { DataSource } from 'typeorm';
import { createECDH, randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  authenticatedRequest,
  seedAuth,
  TEST_SESSION_TOKEN,
  TEST_USER,
} from './auth-fixture';
import { tokenHash } from '../src/auth/auth.crypto';
import {
  SessionEntity,
  UserEntity,
  AuthTokenEntity,
} from '../src/auth/auth.entities';
import { AuthService } from '../src/auth/auth.service';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import type { MonthChallengeResponse } from '../src/month-challenges/month-challenge.dto';
import { Clock } from '../src/common/clock';
import {
  PushTransport,
  type SendOptions,
  type SendResult,
} from '../src/push/push.transport';
import { PushService } from '../src/push/push.service';
import {
  PushDeliveryEntity,
  PushSubscriptionEntity,
} from '../src/push/push.entities';
import type { TimerResponse } from '../src/timers/timers.service';
import { resetDatabase } from './reset-database';

describe('Session-scoped timer Push (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let server: Server;
  let push: PushService;
  let now: Date;
  const clock = {
    now: () => new Date(now),
    today: () => dayOf(new Date(now)),
  };
  const transport = {
    publicKey: 'public-test-key',
    send: jest.fn<
      Promise<SendResult>,
      [object, object, number, SendOptions?]
    >(),
  };
  const client = () => authenticatedRequest(server);
  const sessionHash = tokenHash(TEST_SESSION_TOKEN);
  const secondHash = tokenHash('b'.repeat(43));
  function dto(name = 'device-one') {
    const curve = createECDH('prime256v1');
    curve.generateKeys();
    return {
      endpoint: `https://fcm.googleapis.com/wp/test-${name}`,
      keys: {
        p256dh: curve.getPublicKey().toString('base64url'),
        auth: randomBytes(16).toString('base64url'),
      },
    };
  }
  const sub = async (name = 'device-one', hash = sessionHash) =>
    push.subscribe(TEST_USER, hash, dto(name));
  /** A todo with a one-minute target and a stopwatch running on it. */
  async function timer(replaceTimerId?: string) {
    const response = await client()
      .post('/todos')
      .send({ title: 'Private test title', plannedDurationMinutes: 1 })
      .expect(201);
    const targetId = (response.body as { id: number }).id;
    const started = (
      await client()
        .post('/timers')
        .send({ kind: 'todo', targetId, replaceTimerId })
        .expect(201)
    ).body as TimerResponse;
    return { id: started.timer!.id, targetId };
  }
  const action = (id: string, kind: string) =>
    client().post(`/timers/${id}/${kind}`).send({}).expect(201);
  async function due() {
    now = new Date(now.getTime() + 60_001);
    await push.enqueueDue();
  }
  const deliveries = () => db.getRepository(PushDeliveryEntity).find();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(clock)
      .overrideProvider(PushTransport)
      .useValue(transport)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    server = app.getHttpServer() as Server;
    push = app.get(PushService);
  });
  beforeEach(async () => {
    await resetDatabase(db);
    await seedAuth(app);
    now = new Date();
    transport.send.mockReset().mockResolvedValue('sent');
    await db.getRepository(SessionEntity).save({
      hash: secondHash,
      userId: TEST_USER,
      expiresAt: new Date(Date.now() + 3600_000),
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  it('requires auth, exact write Origin, provider allowlist and valid keys', async () => {
    await anonymous(server).get('/push/config').expect(401);
    const configured = await client().get('/push/config').expect(200);
    expect(configured.body as object).toEqual({
      configured: true,
      publicKey: 'public-test-key',
    });
    await anonymous(server)
      .post('/push/subscription')
      .set('Cookie', `habit_session=${TEST_SESSION_TOKEN}`)
      .set('Origin', 'https://evil.example')
      .send(dto())
      .expect(403);
    await client()
      .post('/push/subscription')
      .send({ ...dto(), endpoint: 'https://127.0.0.1/secret' })
      .expect(400);
    await client()
      .post('/push/subscription')
      .send({ ...dto(), keys: { p256dh: 'bad', auth: 'bad' } })
      .expect(400);
    await client()
      .post('/push/subscription')
      .send({ ...dto(), userId: 'spoof' })
      .expect(400);
    await client().post('/push/subscription').send(dto()).expect(201);
  });
  it('deduplicates concurrent registration and stores secrets only in selected fields', async () => {
    const payload = dto();
    const results = await Promise.all([
      push.subscribe(TEST_USER, sessionHash, payload),
      push.subscribe(TEST_USER, sessionHash, payload),
    ]);
    expect(results[0].id).toBe(results[1].id);
    const rows = await db.getRepository(PushSubscriptionEntity).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].endpoint).toBeUndefined();
    expect(rows[0].auth).toBeUndefined();
    expect(rows[0].p256dh).toBeUndefined();
  });
  it('fans out once to every opted-in live session without any current-timer polling', async () => {
    await sub();
    await sub('device-two', secondHash);
    await timer();
    await due();
    await Promise.all([push.enqueueDue(), push.enqueueDue()]);
    expect(await deliveries()).toHaveLength(2);
    await Promise.all([push.sendPending(), push.sendPending()]);
    expect(transport.send).toHaveBeenCalledTimes(2);
    for (const call of transport.send.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain('Private test title');
      expect(call[2]).toBeLessThanOrEqual(30);
      expect((call[1] as { type: string }).type).toBe('timer-target-reached');
      // No options: the provider sends with high urgency.
      expect(call).toHaveLength(3);
    }
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(2);
  });
  it('also enqueues when another device has already lazily reconciled the finished timer', async () => {
    await sub();
    await timer();
    now = new Date(now.getTime() + 60_001);
    await client().get('/timers/current').expect(200);
    await push.enqueueDue();
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('paused timers do not notify, and resuming uses the new deadline', async () => {
    await sub();
    const started = await timer();
    await action(started.id, 'pause');
    now = new Date(now.getTime() + 60_001);
    await push.enqueueDue();
    expect(await deliveries()).toHaveLength(0);
    await action(started.id, 'resume');
    await push.enqueueDue();
    expect(await deliveries()).toHaveLength(0);
    await due();
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it.each(['stop', 'complete', 'replace'])(
    'cancels a queued notification after %s',
    async (kind) => {
      await sub();
      const started = await timer();
      await due();
      expect(await deliveries()).toHaveLength(1);
      if (kind === 'stop') await action(started.id, 'stop');
      if (kind === 'complete')
        await client()
          .patch(`/todos/${started.targetId}`)
          .send({ completed: true })
          .expect(200);
      // Past its target the stopwatch still runs, so another one replaces it.
      if (kind === 'replace') await timer(started.id);
      await push.sendPending();
      expect(transport.send).not.toHaveBeenCalled();
      expect((await deliveries())[0].state).toBe('cancelled');
    },
  );
  it('recomputes a paused duration change instead of sending at the original deadline', async () => {
    await sub();
    const started = await timer();
    await action(started.id, 'pause');
    await client()
      .patch(`/timers/${started.id}/duration`)
      .send({ durationMinutes: 2 })
      .expect(200);
    await action(started.id, 'resume');
    await due();
    expect(await deliveries()).toHaveLength(0);
    await due();
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('logout atomically deletes only this session binding and queued deliveries', async () => {
    await sub();
    await sub('device-two', secondHash);
    await timer();
    await due();
    await client().post('/auth/logout').send({}).expect(204);
    const subscriptions = await db.getRepository(PushSubscriptionEntity).find();
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].sessionHash).toBe(secondHash);
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(1);
    await expect(push.subscribe(TEST_USER, sessionHash, dto())).rejects.toThrow(
      'Bitte erneut anmelden',
    );
  });
  it('expired sessions are excluded even if their records still exist', async () => {
    await sub();
    await db
      .getRepository(SessionEntity)
      .update(sessionHash, { expiresAt: new Date(now.getTime() - 1) });
    await due();
    expect(await deliveries()).toHaveLength(0);
    await client().get('/auth/me').expect(401);
    expect(await db.getRepository(PushSubscriptionEntity).count()).toBe(1);
    await expect(
      push.subscribe(TEST_USER, sessionHash, dto('new')),
    ).rejects.toThrow();
  });
  it('device opt-out deletes pending work but leaves the other device enabled', async () => {
    const device = await sub();
    await sub('device-two', secondHash);
    await timer();
    await due();
    await client()
      .delete('/push/subscription')
      .send({ id: device.id })
      .expect(204);
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('relogin rebinding cannot transfer an old queued notification', async () => {
    await sub();
    await timer();
    await due();
    const payload = dto();
    await push.subscribe(TEST_USER, secondHash, payload);
    expect(await deliveries()).toHaveLength(0);
    await push.sendPending();
    expect(transport.send).not.toHaveBeenCalled();
  });
  it('retries transient failures within the deadline window without resending successes', async () => {
    await sub();
    await sub('device-two', secondHash);
    await timer();
    await due();
    transport.send.mockResolvedValueOnce('retry').mockResolvedValue('sent');
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(2);
    now = new Date(now.getTime() + 2001);
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(3);
    expect((await deliveries()).every((row) => row.state === 'sent')).toBe(
      true,
    );
  });
  it('cleans up expired provider endpoints and does not retry permanent failures', async () => {
    await sub();
    await sub('device-two', secondHash);
    await timer();
    await due();
    transport.send.mockResolvedValueOnce('gone').mockResolvedValue('failed');
    await push.sendPending();
    expect(await db.getRepository(PushSubscriptionEntity).count()).toBe(1);
    // The gone device takes its delivery along.
    expect(await deliveries()).toHaveLength(1);
    expect((await deliveries())[0].state).toBe('failed');
    now = new Date(now.getTime() + 5000);
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(2);
  });
  it('suppresses late catch-up and expired queued work after a restart', async () => {
    await sub();
    const late = await timer();
    now = new Date(now.getTime() + 95_000);
    await push.enqueueDue();
    expect(await deliveries()).toHaveLength(0);
    await action(late.id, 'stop');
    await timer();
    await due();
    now = new Date(now.getTime() + 31_000);
    await push.sendPending();
    expect(transport.send).not.toHaveBeenCalled();
  });
  it('password reset removes all device bindings and queued work', async () => {
    await sub();
    await sub('device-two', secondHash);
    await timer();
    await due();
    const raw = 'r'.repeat(43);
    await db.getRepository(AuthTokenEntity).save({
      hash: tokenHash(raw),
      userId: TEST_USER,
      kind: 'reset',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await app.get(AuthService).reset(raw, 'replacement-test-password');
    expect(await db.getRepository(PushSubscriptionEntity).count()).toBe(0);
    expect(await deliveries()).toHaveLength(0);
    await push.sendPending();
    expect(transport.send).not.toHaveBeenCalled();
  });
  it('another user cannot take over an endpoint, remove a device or confirm a receipt', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    const user = await db
      .getRepository(UserEntity)
      .findOne({ where: { id: TEST_USER }, select: { passwordHash: true } });
    await db.getRepository(UserEntity).save({
      id: other,
      email: 'other@example.test',
      passwordHash: user!.passwordHash,
      verifiedAt: new Date(),
    });
    const hash = tokenHash('c'.repeat(43));
    await db.getRepository(SessionEntity).save({
      hash,
      userId: other,
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const device = await sub();
    await timer();
    await due();
    await expect(push.subscribe(other, hash, dto())).rejects.toThrow(
      'anderen Konto',
    );
    await push.unsubscribe(other, device.id);
    expect(await db.getRepository(PushSubscriptionEntity).count()).toBe(1);
    expect(await push.confirm(other, hash, (await deliveries())[0].id)).toEqual(
      { allowed: false },
    );
  });
  it.each(['finished', 'paused', 'skipped'])(
    'handles a Habit timer with target state %s',
    async (kind) => {
      await sub();
      const created = (
        await client()
          .post('/habits')
          .send({
            title: 'Private habit test',
            plannedDurationMinutes: 1,
            schedule: { type: 'interval', intervalDays: 1 },
          })
          .expect(201)
      ).body as HabitResponseDto;
      const available = (
        await client().get(`/habits/${created.id}`).expect(200)
      ).body as HabitResponseDto;
      const started = (
        await client()
          .post('/timers')
          .send({ kind: 'occurrence', targetId: available.timerOccurrenceId })
          .expect(201)
      ).body as TimerResponse;
      expect(started.timer).not.toBeNull();
      await due();
      if (kind === 'paused')
        await client()
          .patch(`/habits/${created.id}`)
          .send({ isActive: false })
          .expect(200);
      if (kind === 'skipped')
        await client()
          .patch(`/habit-occurrences/${available.timerOccurrenceId!}/status`)
          .send({ status: 'skipped' })
          .expect(200);
      await push.sendPending();
      expect(transport.send).toHaveBeenCalledTimes(kind === 'finished' ? 1 : 0);
    },
  );
  it('concurrent workers honor retry backoff and stop after three failures', async () => {
    await sub();
    await timer();
    await due();
    transport.send.mockResolvedValue('retry');
    await Promise.all([
      push.sendPending(),
      push.sendPending(),
      push.sendPending(),
    ]);
    expect(transport.send).toHaveBeenCalledTimes(1);
    now = new Date(now.getTime() + 2001);
    await Promise.all([push.sendPending(), push.sendPending()]);
    expect(transport.send).toHaveBeenCalledTimes(2);
    now = new Date(now.getTime() + 4001);
    await push.sendPending();
    expect((await deliveries())[0]).toMatchObject({
      state: 'failed',
      attempts: 3,
    });
    now = new Date(now.getTime() + 4001);
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(3);
  });
  it('bounds device registrations, permits rebinding and clears expired bindings', async () => {
    for (let i = 0; i < 20; i++) await sub(`device-${i}`);
    await expect(sub('extra')).rejects.toThrow('Maximal 20');
    await sub('device-0');
    expect(await db.getRepository(PushSubscriptionEntity).count()).toBe(20);
    await db
      .getRepository(SessionEntity)
      .update(sessionHash, { expiresAt: new Date(now.getTime() - 1) });
    await sub('new-login', secondHash);
    expect(await db.getRepository(PushSubscriptionEntity).count()).toBe(1);
  });
  it('receipt checks the exact session, opt-in and still-valid timer', async () => {
    await sub();
    const started = await timer();
    await due();
    await push.sendPending();
    const receipt = (await deliveries())[0];
    expect(await push.confirm(TEST_USER, sessionHash, receipt.id)).toEqual({
      allowed: true,
    });
    expect(await push.confirm(TEST_USER, secondHash, receipt.id)).toEqual({
      allowed: false,
    });
    await action(started.id, 'stop');
    expect(await push.confirm(TEST_USER, sessionHash, receipt.id)).toEqual({
      allowed: false,
    });
  });
  describe('evening reminder of Das Beste des Tages', () => {
    const today = () => dayOf(now);
    /** Berlin wall clock of the current test day. */
    const at = (minutes: number) => {
      now = atWallClockMinutes(today(), minutes);
    };
    const reminders = async () =>
      (await deliveries()).filter((row) => row.kind === 'day-best');
    // The tests move the clock to the evening: the sessions must outlast it.
    beforeEach(() =>
      db.query('UPDATE auth_sessions SET "expiresAt" = $1', [
        new Date(Date.now() + 2 * 86_400_000),
      ]),
    );

    it('comes once, an hour after the card time, while the day has no line', async () => {
      await sub();
      await sub('device-two', secondHash);
      at(20 * 60 + 59);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(0);
      at(21 * 60);
      await Promise.all([
        push.enqueueDayBestReminders(),
        push.enqueueDayBestReminders(),
      ]);
      const queued = await reminders();
      expect(queued).toHaveLength(2);
      expect(queued[0]).toMatchObject({
        day: today(),
        timerId: null,
        state: 'pending',
      });
      // At most once a day, also on later passes.
      now = new Date(now.getTime() + 60_000);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(2);

      await push.sendPending();
      expect(transport.send).toHaveBeenCalledTimes(2);
      for (const call of transport.send.mock.calls) {
        const payload = call[1] as { type: string; expiresAt: string };
        expect(payload.type).toBe('day-best-reminder');
        expect(Object.keys(payload).sort()).toEqual([
          'deliveryId',
          'expiresAt',
          'subscriptionId',
          'type',
        ]);
        expect(call[2]).toBeGreaterThan(30);
        expect(call[2]).toBeLessThanOrEqual(3600);
        expect(call[3]).toEqual({ urgency: 'normal' });
      }
      const receipt = (await reminders())[0];
      const hash =
        receipt.subscriptionId ===
        (
          await db
            .getRepository(PushSubscriptionEntity)
            .findOneByOrFail({ sessionHash })
        ).id
          ? sessionHash
          : secondHash;
      expect(await push.confirm(TEST_USER, hash, receipt.id)).toEqual({
        allowed: true,
      });
      // The line arrives: a notification still on its way stays hidden.
      await client()
        .put(`/day-bests/${today()}`)
        .send({ text: 'Abendlicht am Fluss' })
        .expect(200);
      expect(await push.confirm(TEST_USER, hash, receipt.id)).toEqual({
        allowed: false,
      });
    });

    it('stays away when the day has its line, it is off, or the card time is late', async () => {
      await sub();
      at(21 * 60 + 10);
      await client()
        .put(`/day-bests/${today()}`)
        .send({ text: 'Schon geschrieben' })
        .expect(200);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(0);

      await client().delete(`/day-bests/${today()}`).expect(204);
      await client()
        .put('/day-best-settings')
        .send({ reminderEnabled: false })
        .expect(200);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(0);

      // A later card time moves the reminder with it.
      await client()
        .put('/day-best-settings')
        .send({ reminderEnabled: true, cardTime: '21:00' })
        .expect(200);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(0);
      at(22 * 60);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(1);
    });

    it('is cancelled before sending when the line came first, and never caught up late', async () => {
      await sub();
      at(21 * 60 + 5);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(1);
      await client()
        .put(`/day-bests/${today()}`)
        .send({ text: 'Rechtzeitig' })
        .expect(200);
      await push.sendPending();
      expect(transport.send).not.toHaveBeenCalled();
      expect((await reminders())[0].state).toBe('cancelled');

      // A server that was down through the whole window sends nothing.
      await db.query('TRUNCATE day_bests, day_best_settings');
      await db.query(`DELETE FROM push_deliveries WHERE kind = 'day-best'`);
      at(22 * 60 + 1);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(0);
      at(22 * 60 + 30);
      await push.enqueueDayBestReminders();
      expect(await reminders()).toHaveLength(0);
    });
  });
  describe('daily reminder of the Monats-Challenge', () => {
    const today = () => dayOf(now);
    /** Berlin wall clock of the current test day. */
    const at = (minutes: number) => {
      now = atWallClockMinutes(today(), minutes);
    };
    const reminders = async () =>
      (await deliveries()).filter((row) => row.kind === 'challenge');
    /** A daily Daily and this month's challenge on it, from 10:00. */
    async function challenge(title = 'Sport', reminderTime?: string | null) {
      at(10 * 60);
      const habit = (
        await client()
          .post('/habits')
          .send({
            title,
            schedule: {
              type: 'interval',
              intervalDays: 1,
              missedOccurrencePolicy: 'skip',
            },
          })
          .expect(201)
      ).body as HabitResponseDto;
      return (
        await client()
          .post('/month-challenges')
          .send({
            habitId: habit.id,
            month: today().slice(0, 7),
            ...(reminderTime === undefined ? {} : { reminderTime }),
          })
          .expect(201)
      ).body as MonthChallengeResponse;
    }
    const complete = (occurrenceId: number) =>
      client()
        .patch(`/habit-occurrences/${occurrenceId}/status`)
        .send({ status: 'completed' })
        .expect(200);
    beforeEach(() =>
      db.query('UPDATE auth_sessions SET "expiresAt" = $1', [
        new Date(Date.now() + 2 * 86_400_000),
      ]),
    );

    it("comes once at its time while today's run is open; the title only behind the session", async () => {
      await sub();
      const created = await challenge();
      at(19 * 60 - 1);
      await push.enqueueChallengeReminders();
      expect(await reminders()).toHaveLength(0);
      at(19 * 60);
      await Promise.all([
        push.enqueueChallengeReminders(),
        push.enqueueChallengeReminders(),
      ]);
      const queued = await reminders();
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        day: today(),
        timerId: null,
        state: 'pending',
      });
      now = new Date(now.getTime() + 60_000);
      await push.enqueueChallengeReminders();
      expect(await reminders()).toHaveLength(1);

      await push.sendPending();
      expect(transport.send).toHaveBeenCalledTimes(1);
      const payload = transport.send.mock.calls[0][1] as { type: string };
      expect(payload.type).toBe('challenge-reminder');
      expect(Object.keys(payload).sort()).toEqual([
        'deliveryId',
        'expiresAt',
        'subscriptionId',
        'type',
      ]);
      expect(transport.send.mock.calls[0][2]).toBeGreaterThan(30);
      expect(transport.send.mock.calls[0][2]).toBeLessThanOrEqual(3600);
      expect(transport.send.mock.calls[0][3]).toEqual({ urgency: 'normal' });
      expect(await push.confirm(TEST_USER, sessionHash, queued[0].id)).toEqual({
        allowed: true,
        title: 'Sport',
      });
      // Done meanwhile: a notification still on its way stays hidden.
      await complete(created.todayOccurrenceId!);
      expect(await push.confirm(TEST_USER, sessionHash, queued[0].id)).toEqual({
        allowed: false,
      });
    });

    it('stays away when the run is done or the reminder is off, and is never caught up', async () => {
      await sub();
      const done = await challenge();
      await complete(done.todayOccurrenceId!);
      at(19 * 60 + 5);
      await push.enqueueChallengeReminders();
      expect(await reminders()).toHaveLength(0);
      // Settled for today: not looked at again.
      expect(
        (
          await db.query<{ remindedOn: string }[]>(
            'SELECT "remindedOn"::text AS "remindedOn" FROM month_challenges',
          )
        )[0].remindedOn,
      ).toBe(today());

      await client().delete(`/month-challenges/${done.id}`).expect(204);
      const off = await challenge('Lesen', null);
      at(19 * 60 + 10);
      await push.enqueueChallengeReminders();
      expect(await reminders()).toHaveLength(0);

      // A later time; a server down through its whole hour sends nothing.
      await client()
        .patch(`/month-challenges/${off.id}`)
        .send({ reminderTime: '21:00' })
        .expect(200);
      at(22 * 60 + 1);
      await push.enqueueChallengeReminders();
      expect(await reminders()).toHaveLength(0);
      at(22 * 60 + 30);
      await push.enqueueChallengeReminders();
      expect(await reminders()).toHaveLength(0);
    });

    it('stays away while the Daily is paused', async () => {
      await sub();
      const created = await challenge();
      await client()
        .patch(`/habits/${created.habitId}`)
        .send({ isActive: false })
        .expect(200);
      at(19 * 60 + 5);
      await push.enqueueChallengeReminders();
      expect(await reminders()).toHaveLength(0);
    });

    it('keeps its own delivery beside the reminder of Das Beste des Tages', async () => {
      await sub();
      await challenge('Sport', '21:00');
      at(21 * 60 + 5);
      await push.enqueueDayBestReminders();
      await push.enqueueChallengeReminders();
      expect((await deliveries()).map(({ kind }) => kind).sort()).toEqual([
        'challenge',
        'day-best',
      ]);
    });
  });
});
