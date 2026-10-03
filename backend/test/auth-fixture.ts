import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SessionEntity, UserEntity } from '../src/auth/auth.entities';
import { hashPassword, tokenHash } from '../src/auth/auth.crypto';
export const TEST_USER = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'a'.repeat(43);
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
    hash: tokenHash(TOKEN),
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
      .set('Cookie', `habit_session=${TOKEN}`);
  return {
    get: (p: string) => headers(client.get(p)),
    post: (p: string) => headers(client.post(p)),
    patch: (p: string) => headers(client.patch(p)),
    delete: (p: string) => headers(client.delete(p)),
  };
}
