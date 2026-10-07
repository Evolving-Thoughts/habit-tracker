import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import anonymous from 'supertest';
import { DataSource } from 'typeorm';
import { createECDH, randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { authenticatedRequest, seedAuth, TEST_USER } from './auth-fixture';
import { tokenHash } from '../src/auth/auth.crypto';
import {
  SessionEntity,
  UserEntity,
  AuthTokenEntity,
} from '../src/auth/auth.entities';
import { AuthService } from '../src/auth/auth.service';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import { TimerClock } from '../src/timers/timer.clock';
import { PushTransport, type SendResult } from '../src/push/push.transport';
import { PushService } from '../src/push/push.service';
import {
  PushDeliveryEntity,
  PushSubscriptionEntity,
} from '../src/push/push.entities';
import type { TimerResponse } from '../src/timers/timers.service';

describe('Session-scoped timer Push (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let server: Server;
  let push: PushService;
  let now: Date;
  const clock = { now: () => new Date(now) };
  const transport = {
    publicKey: 'public-test-key',
    send: jest.fn<Promise<SendResult>, [object, object, number]>(),
  };
  const client = () => authenticatedRequest(server);
  const sessionHash = tokenHash('a'.repeat(43));
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
  async function timer() {
    const response = await client()
      .post('/todos')
      .send({ title: 'Private test title', plannedDurationMinutes: 1 })
      .expect(201);
    const targetId = (response.body as { id: number }).id;
    const started = (
      await client()
        .post('/timers')
        .send({ kind: 'todo', targetId })
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
      .overrideProvider(TimerClock)
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
    if (db.options.database !== 'habit_tracker_test')
      throw new Error('Test DB required');
  });
  beforeEach(async () => {
    await db.query(
      'TRUNCATE TABLE push_deliveries, push_subscriptions, timers, habit_occurrences, habit_schedule_versions, habits, todos, auth_tokens, auth_sessions, auth_rate_limits, users RESTART IDENTITY',
    );
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
      .set('Cookie', `habit_session=${'a'.repeat(43)}`)
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
      expect((call[1] as { type: string }).type).toBe('timer-finished');
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
      if (kind === 'replace') await timer();
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
    expect((await deliveries())[0].state).toBe('failed');
    now = new Date(now.getTime() + 5000);
    await push.sendPending();
    expect(transport.send).toHaveBeenCalledTimes(2);
  });
  it('suppresses late catch-up and expired queued work after a restart', async () => {
    await sub();
    await timer();
    now = new Date(now.getTime() + 95_000);
    await push.enqueueDue();
    expect(await deliveries()).toHaveLength(0);
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
});
