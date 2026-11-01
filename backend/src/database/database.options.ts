import type { DataSourceOptions } from 'typeorm';
import { Baseline1793522450873 } from './migrations/1793522450873-Baseline';

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/** The one database configuration of the Nest app. */
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
    migrations: [Baseline1793522450873],
  };
}
