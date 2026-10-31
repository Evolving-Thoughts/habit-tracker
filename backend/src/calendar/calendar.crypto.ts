import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const key = (): Buffer | null => {
  const value = Buffer.from(process.env.GOOGLE_TOKEN_KEY ?? '', 'base64');
  return value.length === 32 ? value : null;
};

export const hasTokenKey = (): boolean => key() !== null;

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key()!, iv);
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString('base64'))
    .join('.');
}

export function decryptToken(stored: string): string {
  const [iv, tag, body] = stored
    .split('.')
    .map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key()!, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    'utf8',
  );
}
