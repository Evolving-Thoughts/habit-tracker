const { assertBrowserEnvironment, DATABASE } = require('./environment.cjs');
const DEADLOCK_DETECTED = '40P01';
const ATTEMPTS = 5;
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
    const truncate = 'TRUNCATE TABLE external_calendars, calendar_links, calendar_connections, calendar_oauth_states, external_events, push_deliveries, push_subscriptions, timers, "habit_occurrences", "habit_schedule_versions", "habits", "todos", "categories", "reflections", "work_logs", "goal_snapshots", "auth_tokens", "auth_sessions", "auth_rate_limits", "users" RESTART IDENTITY';
    // A request of the test before may still read these tables in another
    // order. Postgres then ends one side; when it is the reset, it tries again.
    for (let attempt = 1; ; attempt += 1) {
      try {
        await client.query(truncate);
        break;
      } catch (error) {
        if (error.code !== DEADLOCK_DETECTED || attempt === ATTEMPTS) throw error;
      }
    }
  } finally { await client.end(); }
}
reset().catch(error => { console.error(error.message); process.exitCode = 1; });
