// Build first (npm run migration:run does). Runs every pending migration in
// dist/migrations with the app's own DB settings; never synchronizes or resets tables.
const { existsSync } = require('node:fs');
if (existsSync('.env')) process.loadEnvFile('.env');
const { DataSource } = require('typeorm');
const { databaseOptions } = require('../dist/database/database.options');

(async () => {
  const db = new DataSource({
    ...databaseOptions((key) => process.env[key]),
    synchronize: false,
  });
  try {
    await db.initialize();
    const applied = await db.runMigrations({ transaction: 'each' });
    console.log(
      applied.length
        ? `Applied: ${applied.map((m) => m.name).join(', ')}`
        : 'No pending migrations.',
    );
  } finally {
    if (db.isInitialized) await db.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
