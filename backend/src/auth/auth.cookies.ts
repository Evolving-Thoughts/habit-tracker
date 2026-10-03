import type { CookieOptions } from 'express';

// The public origin may be HTTPS even when Nest runs locally in development.
// Do not trust client-supplied proxy headers to decide cookie security.
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      process.env.FRONTEND_URL?.startsWith('https://') === true,
    sameSite: 'strict',
    path: '/',
  };
}
