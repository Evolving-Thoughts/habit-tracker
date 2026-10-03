import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { AuthMailer } from '../src/auth/auth.mailer';
import {
  AuthTokenEntity,
  SessionEntity,
  UserEntity,
} from '../src/auth/auth.entities';
import { tokenHash } from '../src/auth/auth.crypto';

const PASSWORD = 'test-password-at-least-12';
type Mail = { email: string; kind: 'verify' | 'reset'; token: string };
describe('Authentication and ownership (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let server: Server;
  const messages: Mail[] = [];
  const mailer = {
    send: jest.fn(
      async (email: string, kind: 'verify' | 'reset', token: string) => {
        await Promise.resolve();
        messages.push({ email, kind, token });
      },
    ),
  };
  const post = (path: string, body: object) =>
    request(server)
      .post(path)
      .set('Origin', process.env.FRONTEND_URL!)
      .send(body);
  const authed = (cookie: string) => ({
    get: (p: string) => request(server).get(p).set('Cookie', cookie),
    post: (p: string, body: object) => post(p, body).set('Cookie', cookie),
    patch: (p: string, body: object) =>
      request(server)
        .patch(p)
        .set('Origin', process.env.FRONTEND_URL!)
        .set('Cookie', cookie)
        .send(body),
    delete: (p: string) =>
      request(server)
        .delete(p)
        .set('Origin', process.env.FRONTEND_URL!)
        .set('Content-Type', 'application/json')
        .set('Cookie', cookie),
  });
  function latest(email: string, kind: Mail['kind']): string {
    return messages.filter((m) => m.email === email && m.kind === kind).at(-1)!
      .token;
  }
  async function register(email = 'a@example.test'): Promise<void> {
    await post('/auth/register', { email, password: PASSWORD }).expect(202);
  }
  async function login(
    email = 'a@example.test',
    password = PASSWORD,
  ): Promise<string> {
    const result = await post('/auth/login', { email, password }).expect(200);
    return (result.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
  }
  async function verified(email = 'a@example.test'): Promise<string> {
    await register(email);
    await post('/auth/verify-email', { token: latest(email, 'verify') }).expect(
      204,
    );
    return login(email);
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthMailer)
      .useValue(mailer)
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
    await db.query(
      'TRUNCATE TABLE habit_occurrences, habit_schedule_versions, habits, todos, auth_tokens, auth_sessions, auth_rate_limits, users RESTART IDENTITY',
    );
    messages.length = 0;
    mailer.send.mockClear();
  });
  afterAll(async () => {
    if (db?.isInitialized)
      await db.query(
        'TRUNCATE TABLE habit_occurrences, habit_schedule_versions, habits, todos, auth_tokens, auth_sessions, auth_rate_limits, users RESTART IDENTITY',
      );
    await app?.close();
  });
  it('rejects anonymous access and never accepts a supplied owner', async () => {
    for (const path of [
      '/todos',
      '/habits',
      '/day-planner/today',
      '/habit-occurrences/today',
      '/auth/me',
    ])
      await request(server).get(path).expect(401);
    const cookie = await verified();
    await authed(cookie)
      .post('/todos', { title: 'spoof', userId: 'other-user' })
      .expect(400);
  });
  it('registers normalized email, hashes secrets, blocks unverified login and consumes verification once', async () => {
    await register(' A@EXAMPLE.TEST ');
    const user = await db
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .getOneOrFail();
    expect(user.email).toBe('a@example.test');
    expect(user.passwordHash).not.toBe(PASSWORD);
    expect(user.verifiedAt).toBeNull();
    const raw = latest('a@example.test', 'verify');
    const saved = await db
      .getRepository(AuthTokenEntity)
      .findOneByOrFail({ hash: tokenHash(raw) });
    expect(saved.hash).not.toBe(raw);
    expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      23 * 3600_000,
    );
    await post('/auth/login', { email: user.email, password: PASSWORD }).expect(
      401,
    );
    await post('/auth/verify-email', { token: raw }).expect(204);
    await post('/auth/verify-email', { token: raw }).expect(400);
    const response = await post('/auth/login', {
      email: user.email,
      password: PASSWORD,
    }).expect(200);
    expect(response.body).toEqual({ id: user.id, email: user.email });
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const session = await db
      .getRepository(SessionEntity)
      .findOneByOrFail({ userId: user.id });
    expect(session.hash).toBe(tokenHash(cookie.split(';')[0].split('=')[1]));
  });
  it('returns the same registration response for duplicates, including concurrent registration', async () => {
    const responses = await Promise.all([
      post('/auth/register', { email: 'a@example.test', password: PASSWORD }),
      post('/auth/register', { email: 'a@example.test', password: PASSWORD }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([202, 202]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(await db.getRepository(UserEntity).count()).toBe(1);
    expect(messages).toHaveLength(1);
  });
  it('rejects expired and wrong-purpose tokens', async () => {
    await register();
    const raw = latest('a@example.test', 'verify');
    await post('/auth/reset-password', {
      token: raw,
      password: 'a-new-valid-password',
    }).expect(400);
    await db
      .getRepository(AuthTokenEntity)
      .update(
        { hash: tokenHash(raw) },
        { expiresAt: new Date(Date.now() - 1) },
      );
    await post('/auth/verify-email', { token: raw }).expect(400);
  });
  it('resend invalidates an old link and uses generic responses for missing accounts', async () => {
    await register();
    const old = latest('a@example.test', 'verify');
    const a = await post('/auth/resend-verification', {
      email: 'a@example.test',
    }).expect(202);
    const b = await post('/auth/resend-verification', {
      email: 'missing@example.test',
    }).expect(202);
    expect(a.body).toEqual(b.body);
    await post('/auth/verify-email', { token: old }).expect(400);
    await post('/auth/verify-email', {
      token: latest('a@example.test', 'verify'),
    }).expect(204);
  });
  it('allows exactly one concurrent consumption of a verification token', async () => {
    await register();
    const raw = latest('a@example.test', 'verify');
    const results = await Promise.all([
      post('/auth/verify-email', { token: raw }),
      post('/auth/verify-email', { token: raw }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
  });
  it('resets a password once, rejects expired resets and revokes every device session', async () => {
    const first = await verified();
    const second = await login();
    const known = await post('/auth/forgot-password', {
      email: 'a@example.test',
    }).expect(202);
    const unknown = await post('/auth/forgot-password', {
      email: 'missing@example.test',
    }).expect(202);
    expect(known.body).toEqual(unknown.body);
    const old = latest('a@example.test', 'reset');
    const token = await db
      .getRepository(AuthTokenEntity)
      .findOneByOrFail({ hash: tokenHash(old) });
    expect(token.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      30 * 60_000,
    );
    await db
      .getRepository(AuthTokenEntity)
      .update({ hash: token.hash }, { expiresAt: new Date(Date.now() - 1) });
    await post('/auth/reset-password', {
      token: old,
      password: 'new-password-at-least-12',
    }).expect(400);
    await post('/auth/forgot-password', { email: 'a@example.test' }).expect(
      202,
    );
    const raw = latest('a@example.test', 'reset');
    await post('/auth/reset-password', {
      token: raw,
      password: 'new-password-at-least-12',
    }).expect(204);
    await post('/auth/reset-password', {
      token: raw,
      password: 'another-valid-password',
    }).expect(400);
    await authed(first).get('/auth/me').expect(401);
    await authed(second).get('/auth/me').expect(401);
    await post('/auth/login', {
      email: 'a@example.test',
      password: PASSWORD,
    }).expect(401);
    await login('a@example.test', 'new-password-at-least-12');
  });
  it('preserves the previous reset link and generic responses during SMTP failure', async () => {
    await verified();
    await post('/auth/forgot-password', { email: 'a@example.test' }).expect(
      202,
    );
    const old = latest('a@example.test', 'reset');
    mailer.send.mockRejectedValueOnce(new Error('test SMTP unavailable'));
    const known = await post('/auth/forgot-password', {
      email: 'a@example.test',
    }).expect(202);
    const unknown = await post('/auth/forgot-password', {
      email: 'missing@example.test',
    }).expect(202);
    expect(known.body).toEqual(unknown.body);
    expect(
      await db
        .getRepository(AuthTokenEntity)
        .findOneBy({ hash: tokenHash(old) }),
    ).not.toBeNull();
  });
  it('allows only one concurrent reset with the same token', async () => {
    const cookie = await verified();
    await post('/auth/forgot-password', { email: 'a@example.test' }).expect(
      202,
    );
    const raw = latest('a@example.test', 'reset');
    const results = await Promise.all([
      post('/auth/reset-password', {
        token: raw,
        password: 'first-new-long-password',
      }),
      post('/auth/reset-password', {
        token: raw,
        password: 'second-new-long-password',
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
    await authed(cookie).get('/auth/me').expect(401);
  });
  it('logs out only the current device and rejects expired sessions', async () => {
    const one = await verified();
    const two = await login();
    await authed(one).post('/auth/logout', {}).expect(204);
    await authed(one).get('/auth/me').expect(401);
    await authed(two).get('/auth/me').expect(200);
    await db
      .getRepository(SessionEntity)
      .update(
        { hash: tokenHash(two.split('=')[1]) },
        { expiresAt: new Date(Date.now() - 1) },
      );
    await authed(two).get('/todos').expect(401);
  });
  it('blocks cross-origin writes, missing origins and non-JSON content', async () => {
    const cookie = await verified();
    await request(server)
      .post('/todos')
      .set('Cookie', cookie)
      .send({ title: 'x' })
      .expect(403);
    await request(server)
      .post('/todos')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ title: 'x' })
      .expect(403);
    await request(server)
      .post('/auth/login')
      .set('Origin', process.env.FRONTEND_URL!)
      .type('form')
      .send({ email: 'a@example.test', password: PASSWORD })
      .expect(403);
  });
  it('throttles repeated failed login and mail requests', async () => {
    for (let i = 0; i < 10; i++)
      await post('/auth/login', {
        email: 'missing@example.test',
        password: PASSWORD,
      }).expect(401);
    await post('/auth/login', {
      email: 'missing@example.test',
      password: PASSWORD,
    }).expect(429);
    for (let i = 0; i < 3; i++)
      await post('/auth/forgot-password', { email: 'a@example.test' }).expect(
        202,
      );
    await post('/auth/forgot-password', { email: 'a@example.test' }).expect(
      429,
    );
  });
  it('isolates Todos, Habits, schedule versions, occurrences and planner for A and B', async () => {
    const a = authed(await verified('a@example.test'));
    const b = authed(await verified('b@example.test'));
    const todo = await a
      .post('/todos', {
        title: 'Private todo',
        scheduledAt: new Date().toISOString(),
      })
      .expect(201);
    const habit = await a
      .post('/habits', {
        title: 'Private habit',
        schedule: { type: 'interval', intervalDays: 1 },
      })
      .expect(201);
    await b.get('/day-planner/today').expect(200);
    const counts: { count: string }[] = await db.query(
      'SELECT count(*) FROM habit_occurrences',
    );
    expect(counts[0].count).toBe('0');
    const planner = await a.get('/day-planner/today').expect(200);
    const occurrence = (
      planner.body as { items: { type: string; occurrenceId: number }[] }
    ).items.find((i) => i.type === 'habit')!;
    expect((await b.get('/todos').expect(200)).body).toEqual([]);
    expect((await b.get('/habits').expect(200)).body).toEqual([]);
    expect(
      (
        (await b.get('/day-planner/today').expect(200)).body as {
          items: unknown[];
        }
      ).items,
    ).toEqual([]);
    expect((await b.get('/habit-occurrences/today').expect(200)).body).toEqual(
      [],
    );
    const tid = (todo.body as { id: number }).id;
    const hid = (habit.body as { id: number }).id;
    for (const path of [
      `/todos/${tid}`,
      `/habits/${hid}`,
      `/habits/${hid}/schedule-versions`,
      `/habits/${hid}/occurrences`,
    ])
      await b.get(path).expect(404);
    await b.patch(`/todos/${tid}`, { title: 'stolen' }).expect(404);
    await b.delete(`/todos/${tid}`).expect(404);
    await b.patch(`/habits/${hid}`, { isActive: false }).expect(404);
    await b.delete(`/habits/${hid}`).expect(404);
    await b
      .post(`/habits/${hid}/schedule-changes`, {
        schedule: { type: 'weekly_target', weeklyTarget: 2 },
      })
      .expect(404);
    await b
      .patch(`/habit-occurrences/${occurrence.occurrenceId}/status`, {
        status: 'completed',
      })
      .expect(404);
    expect(
      ((await a.get(`/todos/${tid}`).expect(200)).body as { title: string })
        .title,
    ).toBe('Private todo');
    expect(
      (
        (await a.get(`/habits/${hid}`).expect(200)).body as {
          isActive: boolean;
        }
      ).isActive,
    ).toBe(true);
    await a
      .patch(`/habit-occurrences/${occurrence.occurrenceId}/status`, {
        status: 'completed',
      })
      .expect(200);
    await a.delete(`/habits/${hid}`).expect(204);
    await a
      .patch(`/habit-occurrences/${occurrence.occurrenceId}/status`, {
        status: 'pending',
      })
      .expect(404);
  });
});
