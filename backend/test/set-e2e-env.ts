process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'habit_tracker_test';

process.env.FRONTEND_URL = 'http://localhost:5173';

// Never inherit real push credentials or run background sends during API tests.
process.env.PUSH_WORKER_ENABLED = 'false';
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';
process.env.VAPID_SUBJECT = 'https://example.invalid';
