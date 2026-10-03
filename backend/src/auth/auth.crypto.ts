import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
// Explicit, memory-hard parameters, rather than relying on Node's lower default cost.
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
export const tokenHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
export const randomToken = (): string => randomBytes(32).toString('base64url');
export const DUMMY_PASSWORD_HASH = `scrypt:32768:8:3:${'0'.repeat(32)}:${'0'.repeat(128)}`;
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt:32768:8:3:${salt}:${key.toString('hex')}`;
}
export async function checkPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, n, r, p, salt, hex] = stored.split(':');
  if (
    algorithm !== 'scrypt' ||
    n !== '32768' ||
    r !== '8' ||
    p !== '3' ||
    !salt ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !hex ||
    !/^[a-f0-9]{128}$/.test(hex)
  )
    return false;
  const key = await derive(password, salt);
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
