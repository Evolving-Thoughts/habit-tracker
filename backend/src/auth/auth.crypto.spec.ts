import {
  checkPassword,
  hashPassword,
  randomToken,
  tokenHash,
} from './auth.crypto';
describe('auth secrets', () => {
  it('salts password hashes and verifies only the matching password', async () => {
    const one = await hashPassword('a-long-test-password');
    const two = await hashPassword('a-long-test-password');
    expect(one).not.toBe(two);
    expect(await checkPassword('a-long-test-password', one)).toBe(true);
    expect(await checkPassword('wrong-password', one)).toBe(false);
    expect(await checkPassword('x', 'invalid')).toBe(false);
  });
  it('creates random URL-safe tokens and deterministic non-plaintext digests', () => {
    const raw = randomToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(raw);
    expect(tokenHash(raw)).toHaveLength(64);
    expect(tokenHash(raw)).not.toBe(raw);
  });
});
