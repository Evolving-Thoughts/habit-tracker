import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/**
 * The one database configuration, shared by the Nest app and the migration
 * runner (scripts/migrate.cjs). Every compiled file in src/migrations is
 * picked up automatically; the runner never synchronizes or drops tables.
 */
export function databaseOptions(
  read: (key: string) => string | undefined,
): PostgresOptions {
  const required = (key: string): string => {
    const value = read(key);
    if (!value) throw new Error(`Missing ${key}`);
    return value;
  };
  return {
    type: 'postgres',
    uuidExtension: 'pgcrypto',
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    username: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    migrations: [join(__dirname, '..', 'migrations', '*.js')],
    migrationsTableName: 'app_migrations',
  };
}
