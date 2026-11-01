import { DataSource } from 'typeorm';
import { ENTITY_FILES } from '../src/database/data-source';
import { databaseOptions } from '../src/database/database.options';

const MIGRATION_DB = 'habit_tracker_migration_test';

describe('Migrations (e2e)', () => {
  const options = databaseOptions((key) => process.env[key]);
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

  it('adopts a synchronized database and keeps its data', async () => {
    await db.synchronize();
    const [{ id }] = await db.query<{ id: string }[]>(
      `INSERT INTO users (email, "passwordHash") VALUES ('a@example.test', 'x')
       RETURNING id`,
    );
    const [{ id: root }] = await db.query<{ id: number }[]>(
      `INSERT INTO todos ("userId", title) VALUES ($1, 'Wurzel') RETURNING id`,
      [id],
    );
    await db.query(
      `INSERT INTO todos ("userId", title, "parentId") VALUES ($1, 'Kind', $2)`,
      [id, root],
    );

    const applied = await db.runMigrations();

    expect(applied).toHaveLength(2);
    expect(await remainingChanges()).toEqual([]);
    expect(
      await db.query<{ title: string; parentId: number | null }[]>(
        `SELECT title, "parentId" FROM todos ORDER BY id`,
      ),
    ).toEqual([
      { title: 'Wurzel', parentId: null },
      { title: 'Kind', parentId: root },
    ]);
  });
});
