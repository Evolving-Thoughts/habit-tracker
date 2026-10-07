const { createECDH } = require('node:crypto');
const DATABASE = 'habit_tracker_browser_e2e';
const API_PORT = '4310';
const FRONTEND_URL = 'http://127.0.0.1:4173';
function browserEnvironment(source = process.env) {
  const curve = createECDH('prime256v1');
  curve.generateKeys();
  const env = {
    NODE_ENV: 'test',
    BROWSER_E2E: '1',
    VAPID_PUBLIC_KEY: curve.getPublicKey().toString('base64url'),
    VAPID_PRIVATE_KEY: curve.getPrivateKey().toString('base64url'),
    VAPID_SUBJECT: 'https://example.invalid',
    PUSH_WORKER_ENABLED: 'false',
    DB_HOST: source.E2E_DB_HOST ?? '127.0.0.1',
    DB_PORT: source.E2E_DB_PORT ?? '55432',
    DB_USER: source.E2E_DB_USER ?? 'habit_tracker_e2e',
    DB_PASSWORD: source.E2E_DB_PASSWORD ?? 'e2e_local_only',
    DB_NAME: DATABASE,
    PORT: API_PORT,
    FRONTEND_URL,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '11025',
    SMTP_SECURE: 'false',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    MAIL_FROM: 'Habit Tracker <noreply@habit-tracker.local>',
  };
  assertBrowserEnvironment(env);
  return env;
}
function assertBrowserEnvironment(env) {
  if (
    env.NODE_ENV !== 'test' ||
    env.BROWSER_E2E !== '1' ||
    env.DB_NAME !== DATABASE
  ) {
    throw new Error(
      `Browser E2E requires NODE_ENV=test, BROWSER_E2E=1 and DB_NAME=${DATABASE}`,
    );
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(env.DB_HOST)) {
    throw new Error('Browser E2E refuses a non-loopback database host');
  }
  if (
    !/^\d+$/.test(env.DB_PORT ?? '') ||
    Number(env.DB_PORT) < 1 ||
    Number(env.DB_PORT) > 65535
  ) {
    throw new Error('Invalid browser E2E database port');
  }
  if (env.PORT !== API_PORT || env.FRONTEND_URL !== FRONTEND_URL) {
    throw new Error('Browser E2E requires its dedicated API/frontend ports');
  }
}
module.exports = { browserEnvironment, assertBrowserEnvironment, DATABASE };
