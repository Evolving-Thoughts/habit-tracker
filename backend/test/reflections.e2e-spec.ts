import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { addDays, dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { ReflectionEntity } from '../src/reflections/reflection.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OTHER_USER = '33333333-3333-4333-8333-333333333333';

describe('Daily reflections (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());
  const save = (date: string, text: string) =>
    request(server).put(`/reflections/${date}`).send({ text });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
    await db.getRepository(UserEntity).save({
      id: OTHER_USER,
      email: 'reflect@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(() => db.query('TRUNCATE reflections'));
  afterAll(() => app.close());

  it('reads an empty day, then stores and replaces one text', async () => {
    const empty = await request(server)
      .get(`/reflections/${today}`)
      .expect(200);
    expect(empty.body).toEqual({ date: today, text: '' });

    await save(today, ' Gut gelaufen ').expect(200);
    await save(today, 'Noch besser').expect(200);

    const reread = await request(server)
      .get(`/reflections/${today}`)
      .expect(200);
    expect(reread.body).toEqual({ date: today, text: 'Noch besser' });
    expect(await db.getRepository(ReflectionEntity).count()).toBe(1);
  });

  it('removes the row when the text is emptied', async () => {
    await save(today, 'Text').expect(200);
    await save(today, '   ').expect(200);
    expect(await db.getRepository(ReflectionEntity).count()).toBe(0);
  });

  it('accepts past days and rejects future and invalid ones', async () => {
    await save(addDays(today, -3), 'Nachtrag').expect(200);
    await save(addDays(today, 1), 'Zu früh').expect(400);
    await save('2026-13-45', 'Unsinn').expect(400);
    await request(server).get('/reflections/bald').expect(400);
    await save(today, 'x'.repeat(10001)).expect(400);
  });

  it("keeps another user's day separate", async () => {
    await db
      .getRepository(ReflectionEntity)
      .save({ userId: OTHER_USER, date: today, text: 'Geheim' });
    const read = await request(server).get(`/reflections/${today}`).expect(200);
    expect(read.body).toEqual({ date: today, text: '' });
    await save(today, 'Meins').expect(200);
    expect(await db.getRepository(ReflectionEntity).count()).toBe(2);
  });
});
