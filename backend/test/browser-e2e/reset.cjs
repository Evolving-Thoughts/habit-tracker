const { assertBrowserEnvironment, DATABASE } = require('./environment.cjs');
async function reset() {
  assertBrowserEnvironment(process.env);
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const { rows } = await client.query('SELECT current_database() AS name');
    if (rows[0]?.name !== DATABASE) throw new Error('Refusing to reset an unexpected database');
    // All FK-related tables together; deliberately no CASCADE and no public reset endpoint.
    await client.query('TRUNCATE TABLE "habit_occurrences", "habit_schedule_versions", "habits", "todos" RESTART IDENTITY');
  } finally { await client.end(); }
}
reset().catch(error => { console.error(error.message); process.exitCode = 1; });
