import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SessionEntity, UserEntity } from '../src/auth/auth.entities';
import { hashPassword, tokenHash } from '../src/auth/auth.crypto';
export const TEST_USER = '11111111-1111-4111-8111-111111111111';
/** What seedAuth fills, for suites that seed once and reset per test. */
export const SEEDED_AUTH_TABLES = ['users', 'auth_sessions'];
/** The session `seedAuth` stores; `authenticatedRequest` sends it. */
export const TEST_SESSION_TOKEN = 'a'.repeat(43);
export async function seedAuth(app: INestApplication): Promise<void> {
  const db = app.get(DataSource);
  if (db.options.database !== 'habit_tracker_test')
    throw new Error('Test DB required');
  await db.getRepository(UserEntity).save({
    id: TEST_USER,
    email: 'test@example.test',
    passwordHash: await hashPassword('only-for-tests-password'),
    verifiedAt: new Date(),
  });
  await db.getRepository(SessionEntity).save({
    hash: tokenHash(TEST_SESSION_TOKEN),
    userId: TEST_USER,
    expiresAt: new Date(Date.now() + 3600_000),
  });
}
export function authenticatedRequest(server: Server) {
  const client = request(server);
  const headers = (test: request.Test) =>
    test
      .set('Origin', process.env.FRONTEND_URL!)
      .set('Content-Type', 'application/json')
      .set('Cookie', `habit_session=${TEST_SESSION_TOKEN}`);
  return {
    get: (p: string) => headers(client.get(p)),
    post: (p: string) => headers(client.post(p)),
    patch: (p: string) => headers(client.patch(p)),
    put: (p: string) => headers(client.put(p)),
    delete: (p: string) => headers(client.delete(p)),
  };
}
