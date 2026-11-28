const { assertBrowserEnvironment, DATABASE } = require('./environment.cjs');
const DEADLOCK_DETECTED = '40P01';
const ATTEMPTS = 5;
// TypeORM's default; src/database sets no other name.
const MIGRATIONS_TABLE = 'migrations';
/**
 * One statement that empties every given table except the migrations table,
 * so a new table needs no list here. All FK-related tables go together;
 * deliberately no CASCADE and no public reset endpoint.
 */
function truncateStatement(tables) {
  const names = tables.filter(name => name !== MIGRATIONS_TABLE);
  if (!names.length) throw new Error('No tables to reset; is the schema migrated?');
  const quoted = names.map(name => `"${name.replace(/"/g, '""')}"`);
  return `TRUNCATE TABLE ${quoted.join(', ')} RESTART IDENTITY`;
}
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
    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const truncate = truncateStatement(tables.rows.map(row => row.tablename));
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
if (require.main === module)
  reset().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { truncateStatement };
