import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import anonymous from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { addDays, dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import type {
  DayBestMonthsResponse,
  DayBestRangeResponse,
} from '../src/day-bests/day-best.dto';
import { DayBestEntity } from '../src/day-bests/day-best.entities';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OTHER_USER = '55555555-5555-4555-8555-555555555555';

describe('Das Beste des Tages (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());
  const save = (date: string, text: string) =>
    request(server).put(`/day-bests/${date}`).send({ text });

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
      email: 'best-other@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(() => db.query('TRUNCATE day_bests, day_best_settings'));
  afterAll(() => app.close());

  it('needs a session', async () => {
    await anonymous(server).get(`/day-bests/${today}`).expect(401);
    await anonymous(server).get('/day-best-settings').expect(401);
  });

  it('reads an empty day, stores one trimmed line and replaces it', async () => {
    const empty = await request(server).get(`/day-bests/${today}`).expect(200);
    expect(empty.body).toEqual({ date: today, text: '' });

    const saved = await save(today, '  Kaffee \n auf dem Balkon ').expect(200);
    expect(saved.body).toEqual({ date: today, text: 'Kaffee auf dem Balkon' });
    await save(today, 'Sonnenuntergang').expect(200);

    const reread = await request(server).get(`/day-bests/${today}`).expect(200);
    expect(reread.body).toEqual({ date: today, text: 'Sonnenuntergang' });
    expect(await db.getRepository(DayBestEntity).count()).toBe(1);
  });

  it('removes the line when emptied or deleted', async () => {
    await save(today, 'Text').expect(200);
    await save(today, '   ').expect(200);
    expect(await db.getRepository(DayBestEntity).count()).toBe(0);
    await save(today, 'Wieder da').expect(200);
    await request(server).delete(`/day-bests/${today}`).expect(204);
    await request(server).delete(`/day-bests/${today}`).expect(204);
    expect(await db.getRepository(DayBestEntity).count()).toBe(0);
  });

  it('takes past days, refuses future ones, bad dates and long lines', async () => {
    await save(addDays(today, -400), 'Lange her').expect(200);
    const future = await save(addDays(today, 1), 'Zu früh').expect(400);
    expect((future.body as { message: string }).message).toBe(
      'Das Beste des Tages gibt es nur für heute und vergangene Tage.',
    );
    await save('2026-02-30', 'Unsinn').expect(400);
    await request(server).get('/day-bests/bald').expect(400);
    await save(today, 'x'.repeat(281)).expect(400);
    // 280 after trimming is fine.
    await save(today, ` ${'x'.repeat(280)} `).expect(200);
    await request(server)
      .put(`/day-bests/${today}`)
      .send({ text: 'a', extra: true })
      .expect(400);
  });

  it('reads a range newest first and counts the months', async () => {
    const days = [0, -1, -5, -40].map((offset) => addDays(today, offset));
    for (const [index, date] of days.entries())
      await save(date, `Eintrag ${index}`).expect(200);
    await db
      .getRepository(DayBestEntity)
      .save({ userId: OTHER_USER, date: today, text: 'Fremd' });

    const range = (
      await request(server)
        .get(`/day-bests?from=${addDays(today, -5)}&to=${today}`)
        .expect(200)
    ).body as DayBestRangeResponse;
    expect(range.entries).toEqual([
      { date: days[0], text: 'Eintrag 0' },
      { date: days[1], text: 'Eintrag 1' },
      { date: days[2], text: 'Eintrag 2' },
    ]);

    const months = (await request(server).get('/day-bests/months').expect(200))
      .body as DayBestMonthsResponse;
    expect(months.today).toBe(today);
    const expected = new Map<string, number>();
    for (const date of days)
      expected.set(date.slice(0, 7), (expected.get(date.slice(0, 7)) ?? 0) + 1);
    expect(months.months).toEqual(
      [...expected.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, count]) => ({ month, count })),
    );

    await request(server)
      .get(`/day-bests?from=${today}&to=${addDays(today, -1)}`)
      .expect(400);
    await request(server)
      .get(`/day-bests?from=${addDays(today, -400)}&to=${today}`)
      .expect(400);
    await request(server).get(`/day-bests?from=${today}`).expect(400);
  });

  it("keeps another person's lines apart", async () => {
    await db
      .getRepository(DayBestEntity)
      .save({ userId: OTHER_USER, date: today, text: 'Geheim' });
    const read = await request(server).get(`/day-bests/${today}`).expect(200);
    expect(read.body).toEqual({ date: today, text: '' });
    await save(today, 'Meins').expect(200);
    await request(server).delete(`/day-bests/${today}`).expect(204);
    expect(
      await db.getRepository(DayBestEntity).findOneBy({ userId: OTHER_USER }),
    ).toMatchObject({ text: 'Geheim' });
  });

  it('keeps the card time and the reminder per person, with defaults', async () => {
    const initial = await request(server).get('/day-best-settings').expect(200);
    expect(initial.body).toEqual({ cardTime: '20:00', reminderEnabled: true });

    const changed = await request(server)
      .put('/day-best-settings')
      .send({ cardTime: '21:30' })
      .expect(200);
    expect(changed.body).toEqual({ cardTime: '21:30', reminderEnabled: true });
    await request(server)
      .put('/day-best-settings')
      .send({ reminderEnabled: false })
      .expect(200);
    const reread = await request(server).get('/day-best-settings').expect(200);
    expect(reread.body).toEqual({ cardTime: '21:30', reminderEnabled: false });

    await request(server)
      .put('/day-best-settings')
      .send({ cardTime: '24:00' })
      .expect(400);
    await request(server)
      .put('/day-best-settings')
      .send({ reminderEnabled: 'ja' })
      .expect(400);
  });
});
