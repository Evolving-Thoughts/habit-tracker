import { FindOperator, type DataSource, type EntityManager } from 'typeorm';
import { SessionEntity } from '../auth/auth.entities';
import type { Clock } from '../common/clock';
import type { UserUnitOfWork } from '../common/user-unit-of-work';
import type { PushKind } from './push-kind';
import type { PushKinds } from './push-kinds';
import { PushDeliveryEntity, PushSubscriptionEntity } from './push.entities';
import { PushService } from './push.service';
import type { PushTransport, SendResult } from './push.transport';

/**
 * The generic queue of `PushService` (fan-out, sending, retry, cancelling,
 * confirming) driven by a fake kind over an in-memory stand-in for the few
 * TypeORM calls it makes. The real kinds and SQL are covered by
 * test/push.e2e-spec.ts.
 */

const USER = 'user-1';
const LIVE = 'session-live';
const EXPIRED = 'session-expired';
const DAY = '2026-11-27';

type Row = Record<string, unknown>;
type Table = Row[];

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (!(expected instanceof FindOperator)) return actual === expected;
    const value = expected.value as Date;
    if (expected.type === 'moreThan') return (actual as Date) > value;
    if (expected.type === 'lessThanOrEqual') return (actual as Date) <= value;
    throw new Error(`Unsupported operator ${expected.type}`);
  });
}

/** Stores rows by value, so only an explicit save changes them. */
function fakeDatabase(now: () => Date) {
  const tables = new Map<unknown, Table>([
    [PushDeliveryEntity, []],
    [PushSubscriptionEntity, []],
    [SessionEntity, []],
  ]);
  const table = (entity: unknown) => tables.get(entity)!;
  const copy = <T>(entity: new () => T, row: Row) =>
    Object.assign(new entity() as object, row) as T;
  let ids = 0;
  const liveSubscriptions = (params: Row) =>
    table(PushSubscriptionEntity).filter(
      (s) =>
        s.userId === params.userId &&
        (params.id === undefined || s.id === params.id) &&
        table(SessionEntity).some(
          (session) =>
            session.hash === s.sessionHash &&
            session.userId === params.userId &&
            (session.expiresAt as Date) > (params.now as Date),
        ),
    );
  const manager = {
    create: (entity: new () => object, data: Row) => copy(entity, data),
    save(first: unknown, second?: unknown) {
      const row = (second ?? first) as Row;
      const entity = row instanceof PushDeliveryEntity ? row.constructor : null;
      if (!entity) throw new Error('Only deliveries are saved here');
      row.id ??= `delivery-${++ids}`;
      const rows = table(entity);
      const index = rows.findIndex((r) => r.id === row.id);
      if (index === -1) rows.push({ ...row });
      else rows[index] = { ...row };
      return Promise.resolve(row);
    },
    findOneBy(entity: new () => object, where: Row) {
      const row = table(entity).find((r) => matches(r, where));
      return Promise.resolve(row ? copy(entity, row) : null);
    },
    delete(entity: unknown, id: string) {
      if (entity !== PushSubscriptionEntity) throw new Error('Unexpected');
      tables.set(
        PushSubscriptionEntity,
        table(entity).filter((s) => s.id !== id),
      );
      // The foreign key cascades.
      tables.set(
        PushDeliveryEntity,
        table(PushDeliveryEntity).filter((d) => d.subscriptionId !== id),
      );
      return Promise.resolve();
    },
    getRepository(entity: unknown) {
      return {
        find: ({ where }: { where: Row }) =>
          Promise.resolve(
            table(entity)
              .filter((r) => matches(r, where))
              .sort((a, b) => +(a.retryAt as Date) - +(b.retryAt as Date))
              .map((r) => copy(PushDeliveryEntity, r)),
          ),
        createQueryBuilder() {
          const params: Row = {};
          const builder = {
            addSelect: () => builder,
            innerJoin: () => builder,
            where: (_sql: string, values: Row) => (
              Object.assign(params, values),
              builder
            ),
            andWhere: (_sql: string, values: Row) => (
              Object.assign(params, values),
              builder
            ),
            getMany: () =>
              Promise.resolve(
                liveSubscriptions(params).map((s) =>
                  copy(PushSubscriptionEntity, s),
                ),
              ),
            getOne: () => {
              const [s] = liveSubscriptions(params);
              return Promise.resolve(
                s ? copy(PushSubscriptionEntity, s) : null,
              );
            },
          };
          return builder;
        },
      };
    },
  };
  table(SessionEntity).push(
    { hash: LIVE, userId: USER, expiresAt: new Date(now().getTime() + 3600e3) },
    { hash: EXPIRED, userId: USER, expiresAt: new Date(now().getTime() - 1) },
  );
  for (const [id, sessionHash] of [
    ['phone', LIVE],
    ['laptop', LIVE],
    ['old', EXPIRED],
  ])
    table(PushSubscriptionEntity).push({
      id,
      userId: USER,
      sessionHash,
      endpoint: `https://push.example/${id}`,
      p256dh: `key-${id}`,
      auth: `auth-${id}`,
    });
  return {
    manager: manager as unknown as EntityManager,
    deliveries: () =>
      table(PushDeliveryEntity) as Partial<PushDeliveryEntity>[],
    subscriptions: () => table(PushSubscriptionEntity).map((s) => s.id),
  };
}

/** A kind that is due once, for one person, while the test says it is wanted. */
function fakeKind(options?: PushKind['options']) {
  const state = { handled: false, wanted: true as boolean };
  const kind = {
    name: 'day-best' as const,
    maxTtlSeconds: 20,
    options,
    candidates: jest.fn(() => Promise.resolve([{ userId: USER }])),
    due: jest.fn((_manager: EntityManager, _c: unknown, at: Date) => {
      if (state.handled) return Promise.resolve(null);
      state.handled = true;
      return Promise.resolve({
        timerId: null,
        day: DAY,
        expiresAt: new Date(at.getTime() + 60_000),
      });
    }),
    stillWanted: jest.fn(() =>
      Promise.resolve(state.wanted ? { title: 'Only for confirm' } : null),
    ),
    payload: () => ({ type: 'fake-reminder' }),
  };
  return { kind, state };
}

describe('PushService queue with a fake kind', () => {
  let now: Date;
  let db: ReturnType<typeof fakeDatabase>;
  let send: jest.Mock<Promise<SendResult>, unknown[]>;
  let fake: ReturnType<typeof fakeKind>;
  let push: PushService;
  function service(kind: ReturnType<typeof fakeKind>['kind']) {
    const dataSource = {
      manager: db.manager,
      getRepository: (entity: unknown) =>
        db.manager.getRepository(entity as never),
    } as unknown as DataSource;
    const unitOfWork = {
      run: (_userId: string, work: (m: EntityManager) => Promise<unknown>) =>
        work(db.manager),
    } as unknown as UserUnitOfWork;
    const clock = { now: () => new Date(now) } as Clock;
    const transport = { publicKey: 'k', send } as unknown as PushTransport;
    const kinds = {
      timer: kind,
      'day-best': kind,
      challenge: kind,
    } as unknown as PushKinds;
    return new PushService(dataSource, clock, transport, unitOfWork, kinds);
  }
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  beforeEach(() => {
    now = new Date('2026-11-27T19:00:00Z');
    db = fakeDatabase(() => now);
    send = jest.fn<Promise<SendResult>, unknown[]>().mockResolvedValue('sent');
    fake = fakeKind({ urgency: 'normal' });
    push = service(fake.kind);
  });

  it('queues one pending delivery per live device, once', async () => {
    await push.enqueueDayBestReminders();
    await push.enqueueDayBestReminders();
    expect(fake.kind.due).toHaveBeenCalledTimes(2);
    expect(fake.kind.due).toHaveBeenCalledWith(
      db.manager,
      { userId: USER },
      now,
    );
    expect(db.deliveries()).toEqual([
      expect.objectContaining({
        userId: USER,
        kind: 'day-best',
        timerId: null,
        day: DAY,
        subscriptionId: 'phone',
        state: 'pending',
        attempts: 0,
        retryAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      }),
      expect.objectContaining({ subscriptionId: 'laptop', state: 'pending' }),
    ]);
  });

  it('sends each delivery once with the kind payload, ttl and options', async () => {
    await push.enqueueDayBestReminders();
    advance(1000);
    await push.sendPending();
    await push.sendPending();
    expect(send).toHaveBeenCalledTimes(2);
    const [phone] = db.deliveries();
    expect(send).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/phone',
        keys: { p256dh: 'key-phone', auth: 'auth-phone' },
      },
      {
        type: 'fake-reminder',
        deliveryId: phone.id,
        subscriptionId: 'phone',
        expiresAt: phone.expiresAt!.toISOString(),
      },
      20,
      { urgency: 'normal' },
    );
    expect(db.deliveries()).toEqual([
      expect.objectContaining({ state: 'sent', attempts: 1 }),
      expect.objectContaining({ state: 'sent', attempts: 1 }),
    ]);
  });

  it('keeps the three-argument call for a kind without options', async () => {
    fake = fakeKind();
    push = service(fake.kind);
    await push.enqueueDue();
    await push.sendPending();
    expect(send.mock.calls[0]).toHaveLength(3);
    expect(send.mock.calls[0][2]).toBe(20);
  });

  it('retries after 2 and 4 seconds and fails after three attempts', async () => {
    send.mockResolvedValue('retry');
    await push.enqueueDayBestReminders();
    await push.sendPending();
    expect(db.deliveries()[0]).toMatchObject({
      state: 'pending',
      attempts: 1,
      retryAt: new Date(now.getTime() + 2000),
    });
    advance(1999);
    await push.sendPending();
    expect(send).toHaveBeenCalledTimes(2);
    advance(1);
    await push.sendPending();
    expect(db.deliveries()[0]).toMatchObject({
      state: 'pending',
      attempts: 2,
      retryAt: new Date(now.getTime() + 4000),
    });
    advance(4000);
    await push.sendPending();
    expect(db.deliveries()[0]).toMatchObject({ state: 'failed', attempts: 3 });
    expect(send).toHaveBeenCalledTimes(6);
  });

  it('fails at once on a permanent error', async () => {
    send.mockResolvedValue('failed');
    await push.enqueueDayBestReminders();
    await push.sendPending();
    expect(db.deliveries().map((d) => [d.state, d.attempts])).toEqual([
      ['failed', 1],
      ['failed', 1],
    ]);
  });

  it('removes a gone device together with its delivery', async () => {
    send.mockResolvedValueOnce('gone');
    await push.enqueueDayBestReminders();
    await push.sendPending();
    expect(db.subscriptions()).toEqual(['laptop', 'old']);
    expect(db.deliveries()).toEqual([
      expect.objectContaining({ subscriptionId: 'laptop', state: 'sent' }),
    ]);
  });

  it('cancels instead of sending once the kind no longer wants it', async () => {
    await push.enqueueDayBestReminders();
    fake.state.wanted = false;
    await push.sendPending();
    expect(send).not.toHaveBeenCalled();
    expect(db.deliveries().map((d) => [d.state, d.attempts])).toEqual([
      ['cancelled', 0],
      ['cancelled', 0],
    ]);
  });

  it('cancels a delivery past its window without asking the kind', async () => {
    await push.enqueueDayBestReminders();
    advance(60_000);
    await push.sendPending();
    expect(fake.kind.stillWanted).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(db.deliveries().map((d) => d.state)).toEqual([
      'cancelled',
      'cancelled',
    ]);
  });

  it('confirms with what the kind adds while it is still wanted', async () => {
    await push.enqueueDayBestReminders();
    const [phone] = db.deliveries();
    expect(await push.confirm(USER, LIVE, phone.id!)).toEqual({
      allowed: true,
      title: 'Only for confirm',
    });
    fake.state.wanted = false;
    expect(await push.confirm(USER, LIVE, phone.id!)).toEqual({
      allowed: false,
    });
  });
});
