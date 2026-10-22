// Build first. Uses explicit DB settings; never synchronizes or resets tables.
const { existsSync } = require('node:fs');
if (existsSync('.env')) process.loadEnvFile('.env');
const { DataSource } = require('typeorm');
const {
  TodoHierarchy1792620000000,
} = require('../dist/migrations/1792620000000-TodoHierarchy');
(async () => {
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'])
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  const db = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    migrations: [TodoHierarchy1792620000000],
    migrationsTableName: 'app_migrations',
  });
  try {
    await db.initialize();
    console.log(await db.runMigrations());
  } finally {
    if (db.isInitialized) await db.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
