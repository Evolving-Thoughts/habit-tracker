import { DataSource, MigrationInterface } from 'typeorm';
import { ENTITY_FILES } from '../src/database/data-source';
import { databaseOptions } from '../src/database/database.options';
import { Baseline1793522450873 } from '../src/database/migrations/1793522450873-Baseline';

const MIGRATION_DB = 'habit_tracker_migration_test';

describe('Migrations (e2e)', () => {
  const options = databaseOptions((key) => process.env[key]);
  const allMigrations = options.migrations as (new () => MigrationInterface)[];
  const admin = new DataSource(options);
  const target = (): DataSource =>
    new DataSource({
      ...options,
      database: MIGRATION_DB,
      entities: [ENTITY_FILES],
    });
  let db: DataSource;

  beforeAll(async () => {
    await admin.initialize();
  });
  beforeEach(async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${MIGRATION_DB}`);
    await admin.query(`CREATE DATABASE ${MIGRATION_DB}`);
    db = target();
    await db.initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });
  afterAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${MIGRATION_DB}`);
    await admin.destroy();
  });

  const remainingChanges = async (): Promise<string[]> =>
    (await db.driver.createSchemaBuilder().log()).upQueries.map(
      ({ query }) => query,
    );

  it('builds the full schema on an empty database', async () => {
    await db.runMigrations();
    expect(await remainingChanges()).toEqual([]);
  });

  it('moves the overall weekly goal into its history', async () => {
    // The schema just before the history: the goal is a column on users.
    const before = new DataSource({
      ...options,
      database: MIGRATION_DB,
      migrations: allMigrations.slice(0, -1),
    });
    await before.initialize();
    await before.runMigrations();
    const [{ id: withGoal }] = await before.query<{ id: string }[]>(
      `INSERT INTO users (email, "passwordHash", "weeklyQuestTargetMinutes")
       VALUES ('ziel@example.test', 'x', 1200) RETURNING id`,
    );
    await before.query(
      `INSERT INTO users (email, "passwordHash") VALUES ('ohne@example.test', 'x')`,
    );
    await before.destroy();

    expect(await db.runMigrations()).toHaveLength(1);
    expect(await remainingChanges()).toEqual([]);
    // One row from long ago carries the goal; no goal needs no row.
    expect(
      await db.query(
        `SELECT "userId", "validFrom"::text AS "validFrom", minutes
         FROM weekly_quest_targets`,
      ),
    ).toEqual([{ userId: withGoal, validFrom: '2000-01-03', minutes: 1200 }]);
  });

  it('adopts a database from before migrations and converts its data', async () => {
    // Such a database has the baseline schema but no record of a migration.
    const before = new DataSource({
      ...options,
      database: MIGRATION_DB,
      migrations: [Baseline1793522450873],
    });
    await before.initialize();
    await before.runMigrations();
    await before.query('DELETE FROM migrations');
    await before.destroy();

    const [{ id }] = await db.query<{ id: string }[]>(
      `INSERT INTO users (email, "passwordHash") VALUES ('a@example.test', 'x')
       RETURNING id`,
    );
    const [{ id: root }] = await db.query<{ id: number }[]>(
      `INSERT INTO todos ("userId", title, "scheduledAt", "isFixed")
       VALUES ($1, 'Termin', '2026-03-10T09:30:00Z', true) RETURNING id`,
      [id],
    );
    await db.query(
      `INSERT INTO todos ("userId", title, "parentId", "scheduledAt")
       VALUES ($1, 'Spät am Abend', $2, '2026-03-10T23:30:00Z'),
              ($1, 'Ohne Tag', $2, NULL)`,
      [id, root],
    );

    // One timer of each kind the countdown model knew.
    await db.query(
      `INSERT INTO timers
         ("userId", "todoId", title, state, "durationMinutes",
          "remainingMilliseconds", "endsAt", "segmentStartedAt", "finishedAt")
       VALUES
         ($1, $2, 'Pausiert', 'paused', 30, 600000, NULL, NULL, NULL),
         ($1, $2, 'Abgelaufen', 'finished', 10, 0, NULL, NULL, '2026-03-10T09:00:00Z'),
         ($1, $2, 'Gestoppt', 'stopped', 5, 240000, NULL, NULL, NULL)`,
      [id, root],
    );

    // A snapshot that still counted the campaign itself.
    await db.query(
      `INSERT INTO goal_snapshots
         ("userId", "rootTodoId", date, "doneCount", "totalCount",
          "doneMinutes", "totalMinutes")
       VALUES ($1, $2, '2026-03-09', 1, 3, 0, 0)`,
      [id, root],
    );

    const applied = await db.runMigrations();

    expect(applied).toHaveLength(allMigrations.length);
    expect(await remainingChanges()).toEqual([]);
    // Progress no longer counts the campaign: the old rows are gone.
    expect(await db.query('SELECT id FROM goal_snapshots')).toEqual([]);

    expect(
      await db.query(
        `SELECT title, state, "targetMinutes", "elapsedMilliseconds",
                "targetReachedAt" IS NOT NULL AS reached
         FROM timers ORDER BY "createdAt", title`,
      ),
    ).toEqual(
      expect.arrayContaining([
        // A paused countdown stays paused with the time already worked.
        {
          title: 'Pausiert',
          state: 'paused',
          targetMinutes: 30,
          elapsedMilliseconds: 1200000,
          reached: false,
        },
        {
          title: 'Abgelaufen',
          state: 'stopped',
          targetMinutes: 10,
          elapsedMilliseconds: 600000,
          reached: true,
        },
        {
          title: 'Gestoppt',
          state: 'stopped',
          targetMinutes: 5,
          elapsedMilliseconds: 60000,
          reached: false,
        },
      ]),
    );
    expect(
      await db.query(
        `SELECT title, "parentId", "scheduledDate"::text, "timeOfDay", "dayPosition"
         FROM todos ORDER BY id`,
      ),
    ).toEqual([
      // An appointment keeps its Berlin wall clock.
      {
        title: 'Termin',
        parentId: null,
        scheduledDate: '2026-03-10',
        timeOfDay: '10:30',
        dayPosition: null,
      },
      // A flexible todo keeps only its Berlin day.
      {
        title: 'Spät am Abend',
        parentId: root,
        scheduledDate: '2026-03-11',
        timeOfDay: null,
        dayPosition: null,
      },
      {
        title: 'Ohne Tag',
        parentId: root,
        scheduledDate: null,
        timeOfDay: null,
        dayPosition: null,
      },
    ]);
  });
});
