import { sessionCookieOptions } from './auth.cookies';

describe('Session cookie options', () => {
  const previous = { ...process.env };
  afterEach(() => {
    process.env = { ...previous };
  });
  it.each([
    ['development', 'http://localhost:5173', false],
    ['development', 'https://example.trycloudflare.com', true],
    ['test', 'http://127.0.0.1:4173', false],
    ['production', 'http://localhost:5173', true],
    ['production', 'https://habit.example', true],
  ])('uses secure cookies for %s at %s', (mode, origin, secure) => {
    process.env.NODE_ENV = mode;
    process.env.FRONTEND_URL = origin;
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
    });
  });
});
