import type { DataSource } from 'typeorm';

/**
 * Empties every table the app's entities map, so a new entity needs no list
 * here. The migrations table has no entity and is never touched.
 */
export async function resetDatabase(
  db: DataSource,
  { keep = [] }: { keep?: readonly string[] } = {},
): Promise<void> {
  if (db.options.database !== 'habit_tracker_test')
    throw new Error('Test DB required');
  const tables = new Set(
    db.entityMetadatas
      .filter((entity) => entity.tableType !== 'view')
      .map((entity) => entity.tableName),
  );
  for (const table of keep)
    if (!tables.delete(table)) throw new Error(`Unknown table: ${table}`);
  // One statement covers every foreign key between the tables. No CASCADE:
  // a kept table that points at an emptied one fails instead of emptying too.
  await db.query(
    `TRUNCATE TABLE ${[...tables].map((t) => `"${t}"`).join(', ')} RESTART IDENTITY`,
  );
}
