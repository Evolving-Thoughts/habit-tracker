const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const {
  browserEnvironment,
  assertBrowserEnvironment,
  DATABASE,
} = require('./environment.cjs');
test('uses dedicated values instead of inherited development database settings', () => {
  const env = browserEnvironment({
    DB_NAME: 'habit_tracker',
    NODE_ENV: 'production',
    PORT: '3000',
  });
  assert.equal(env.DB_NAME, DATABASE);
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env.PORT, '4310');
});
test('allows explicit local test database connection settings', () => {
  const env = browserEnvironment({
    E2E_DB_PORT: '55433',
    E2E_DB_USER: 'test_user',
  });
  assert.equal(env.DB_PORT, '55433');
  assert.equal(env.DB_USER, 'test_user');
});
for (const patch of [
  { DB_NAME: 'habit_tracker' },
  { NODE_ENV: 'production' },
  { BROWSER_E2E: '0' },
  { DB_HOST: 'db.example.com' },
  { DB_PORT: '0' },
  { DB_PORT: '65536' },
  { PORT: '3000' },
  { FRONTEND_URL: 'https://example.com' },
]) {
  test(`rejects unsafe environment ${JSON.stringify(patch)}`, () => {
    assert.throws(() =>
      assertBrowserEnvironment({ ...browserEnvironment({}), ...patch }),
    );
  });
}
for (const script of ['reset.cjs', 'server.cjs']) {
  test(`${script} fails before DB access when pointed at a development database`, () => {
    const result = spawnSync(process.execPath, [join(__dirname, script)], {
      env: {
        ...process.env,
        ...browserEnvironment({}),
        DB_NAME: 'habit_tracker',
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Browser E2E requires/);
  });
}

test('uses fresh test Push keys and disables outgoing jobs instead of inherited credentials', () => {
  const env = browserEnvironment({
    VAPID_PUBLIC_KEY: 'inherited-key',
    VAPID_PRIVATE_KEY: 'inherited-secret',
    PUSH_WORKER_ENABLED: 'true',
  });
  assert.notEqual(env.VAPID_PUBLIC_KEY, 'inherited-key');
  assert.notEqual(env.VAPID_PRIVATE_KEY, 'inherited-secret');
  assert.equal(env.PUSH_WORKER_ENABLED, 'false');
});
