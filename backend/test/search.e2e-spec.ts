import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { dayOf, weekRange } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { HabitOccurrenceResponseDto } from '../src/habit-occurrences/dto/habit-occurrence-response.dto';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import type { SearchResponse } from '../src/search/search.dto';
import { shortDate, weekSpan } from '../src/search/search-text';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OTHER_USER = '44444444-4444-4444-8444-444444444444';

const paragraph = (...content: object[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: object[]) =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value };
const doc = (...content: object[]) => ({ type: 'doc', content });

describe('Search (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());

  const search = async (q: string): Promise<SearchResponse> =>
    (
      await request(server)
        .get(`/search?q=${encodeURIComponent(q)}`)
        .expect(200)
    ).body as SearchResponse;
  const todo = async (body: object): Promise<number> =>
    (
      (await request(server).post('/todos').send(body).expect(201)).body as {
        id: number;
      }
    ).id;
  const habit = async (body: object): Promise<number> =>
    (
      (
        await request(server)
          .post('/habits')
          .send({
            schedule: { type: HabitScheduleType.INTERVAL, intervalDays: 1 },
            ...body,
          })
          .expect(201)
      ).body as { id: number }
    ).id;

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
      email: 'search-other@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(() =>
    db.query(
      'TRUNCATE week_reviews, reflections, work_logs, timers, habit_occurrences, habit_schedule_versions, habits, todos CASCADE',
    ),
  );
  afterAll(() => app.close());

  it('finds campaigns, quests and dailies by title, without case or accents', async () => {
    const book = await todo({ title: 'Buch schreiben', color: 'navy' });
    const chapter = await todo({
      title: 'Kapitel 2 überarbeiten',
      parentId: book,
    });
    const reading = await habit({ title: 'Kapitel lesen', campaignId: book });

    const found = await search('KAPITEL');
    expect(found.titles.map(({ kind, id }) => [kind, id])).toEqual([
      ['quest', chapter],
      ['daily', reading],
    ]);
    const campaign = {
      id: book,
      title: 'Buch schreiben',
      color: 'navy',
      icon: null,
    };
    expect(found.titles[0]).toMatchObject({
      title: 'Kapitel 2 überarbeiten',
      highlight: { start: 0, end: 7 },
      done: false,
      campaign,
    });
    expect(found.titles[1].campaign).toMatchObject(campaign);

    const accent = await search('uberarbeiten');
    expect(accent.titles).toHaveLength(1);
    expect(accent.titles[0].highlight).toEqual({ start: 10, end: 22 });

    const byCampaign = await search('buch');
    expect(byCampaign.titles).toEqual([
      expect.objectContaining({ kind: 'campaign', id: book, campaign }),
    ]);
  });

  it('keeps recently done quests, drops old ones and deleted entries', async () => {
    const recent = await todo({ title: 'Steuer erledigt' });
    const old = await todo({ title: 'Steuer alt' });
    const gone = await todo({ title: 'Steuer gelöscht' });
    const lostDaily = await habit({ title: 'Steuer üben' });
    await db.query(
      `UPDATE todos SET completed = true, "completedAt" = now() WHERE id = $1`,
      [recent],
    );
    await db.query(
      `UPDATE todos SET completed = true,
         "completedAt" = now() - interval '40 days' WHERE id = $1`,
      [old],
    );
    await db.query(`UPDATE todos SET "deletedAt" = now() WHERE id = $1`, [
      gone,
    ]);
    await db.query(`UPDATE habits SET "deletedAt" = now() WHERE id = $1`, [
      lostDaily,
    ]);

    const found = await search('steuer');
    expect(found.titles.map(({ id, done }) => [id, done])).toEqual([
      [recent, true],
    ]);
  });

  it('finds the plain text of notes, reflections and weekly reviews with a snippet', async () => {
    const chapter = await todo({ title: 'Kapitel 2 überarbeiten' });
    await request(server)
      .put(`/todos/${chapter}/notes`)
      .send({
        notes: doc(
          paragraph(text('Die ')),
          paragraph(text('Dra', [{ type: 'bold' }]), text('chenszene kürzen')),
        ),
      })
      .expect(200);
    const running = await habit({ title: 'Laufen' });
    const [run] = (
      await request(server).get('/habit-occurrences/today').expect(200)
    ).body as HabitOccurrenceResponseDto[];
    await request(server)
      .put(`/habit-occurrences/${run.id}/notes`)
      .send({ notes: doc(paragraph(text('Am Fluss einen Drachen gesehen'))) })
      .expect(200);
    await request(server)
      .put(`/reflections/${today}`)
      .send({ text: 'Viel über Drachen gelesen.' })
      .expect(200);
    const week = weekRange(today);
    await request(server)
      .put(`/week-review/${week.startDate}`)
      .send({ wentWell: 'Ruhig', changeNext: 'Weniger Drachen, mehr Schlaf' })
      .expect(200);

    const found = await search('drachen');
    expect(found.titles).toEqual([]);
    const byKind = Object.fromEntries(
      found.texts.map((hit) => [hit.kind, hit]),
    );
    expect(Object.keys(byKind).sort()).toEqual([
      'quest-notes',
      'reflection',
      'run-notes',
      'week-review',
    ]);
    expect(byKind['quest-notes']).toMatchObject({
      id: chapter,
      label: 'Notiz zu Kapitel 2 überarbeiten',
      snippet: 'Die Drachenszene kürzen',
      highlight: { start: 4, end: 11 },
    });
    expect(byKind['run-notes']).toMatchObject({
      id: run.id,
      habitId: running,
      date: today,
      label: `Notiz zu Laufen am ${shortDate(today, today)}`,
    });
    expect(byKind['reflection']).toMatchObject({
      date: today,
      label: `Reflexion vom ${shortDate(today, today)}`,
      snippet: 'Viel über Drachen gelesen.',
      highlight: { start: 10, end: 17 },
    });
    expect(byKind['week-review']).toMatchObject({
      date: week.startDate,
      label: `Wochenrückblick ${weekSpan(week.startDate, week.endDate, today)} · Was ändere ich?`,
      snippet: 'Weniger Drachen, mehr Schlaf',
    });
    // The JSON of a document is not its text.
    expect((await search('paragraph')).texts).toEqual([]);
  });

  it("never shows another person's entries", async () => {
    await db.query(
      `INSERT INTO todos ("userId", title, notes) VALUES ($1, 'Geheimplan', $2)`,
      [OTHER_USER, JSON.stringify(doc(paragraph(text('Geheimplan'))))],
    );
    await db.query(
      `INSERT INTO reflections ("userId", date, text) VALUES ($1, $2, 'Geheimplan')`,
      [OTHER_USER, today],
    );
    const found = await search('geheimplan');
    expect(found).toEqual({ query: 'geheimplan', titles: [], texts: [] });
  });

  it('takes wildcards literally and checks the length of the query', async () => {
    await todo({ title: 'Rabatt 100 Euro' });
    expect((await search('10%')).titles).toEqual([]);
    expect((await search('  100  ')).query).toBe('100');

    await request(server).get('/search').expect(400);
    await request(server).get('/search?q=%20a%20').expect(400);
    await request(server)
      .get(`/search?q=${'x'.repeat(101)}`)
      .expect(400);
  });
});
