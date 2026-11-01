import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.options';

/** The Nest app loads its config itself; the migration CLI starts here. */
try {
  process.loadEnvFile('.env');
} catch {
  // Containers pass the variables directly.
}

export const ENTITY_FILES = join(
  __dirname,
  '..',
  '**',
  '*.entit{y,ies}.{ts,js}',
);

export default new DataSource({
  ...databaseOptions((key) => process.env[key]),
  entities: [ENTITY_FILES],
});
