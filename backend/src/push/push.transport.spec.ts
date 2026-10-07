import { createECDH, randomBytes } from 'node:crypto';
import * as webpush from 'web-push';
import { PushTransport, validSubscription } from './push.transport';
import type { SubscribeDto } from './push.dto';
jest.mock('web-push', () => ({ sendNotification: jest.fn() }));
function subscription(): SubscribeDto {
  const curve = createECDH('prime256v1');
  curve.generateKeys();
  return {
    endpoint: 'https://fcm.googleapis.com/wp/test-device',
    keys: {
      p256dh: curve.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
}
describe('Push input and transport', () => {
  const previous = { ...process.env };
  beforeEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    jest.clearAllMocks();
  });
  afterEach(() => {
    process.env = { ...previous };
  });
  it.each([
    'https://fcm.googleapis.com/wp/test-device',
    'https://fcm.googleapis.com/fcm/send/test-device',
    'https://updates.push.services.mozilla.com/wpush/v2/test-device',
  ])('accepts provider %s with valid keys', (endpoint) => {
    expect(() =>
      validSubscription({ ...subscription(), endpoint }),
    ).not.toThrow();
  });
  it.each([
    'http://fcm.googleapis.com/wp/test',
    'https://127.0.0.1/wp/test',
    'https://localhost/wp/test',
    'https://evil.example/wp/test',
    'https://fcm.googleapis.com.evil.example/wp/test',
    'https://user:pass@fcm.googleapis.com/wp/test',
    'https://fcm.googleapis.com:444/wp/test',
    'https://fcm.googleapis.com/wp/test?secret=x',
    'https://fcm.googleapis.com/wp/test#hash',
  ])('rejects unsafe endpoint %s', (endpoint) => {
    expect(() => validSubscription({ ...subscription(), endpoint })).toThrow();
  });
  it('normalizes equivalent provider URLs and correctly padded native keys', () => {
    const dto = subscription();
    dto.endpoint = 'https://FCM.GOOGLEAPIS.COM:443/wp/test-device';
    dto.keys.p256dh += '=';
    dto.keys.auth += '==';
    validSubscription(dto);
    expect(dto.endpoint).toBe('https://fcm.googleapis.com/wp/test-device');
    expect(dto.keys.auth).not.toContain('=');
    expect(dto.keys.p256dh).not.toContain('=');
  });
  it('rejects invalid curve points and noncanonical/wrong-size keys', () => {
    const good = subscription();
    for (const keys of [
      { ...good.keys, p256dh: Buffer.alloc(65).toString('base64url') },
      { ...good.keys, auth: 'short' },
      { ...good.keys, auth: good.keys.auth + '=' },
    ])
      expect(() => validSubscription({ ...good, keys })).toThrow();
  });
  function configured() {
    const curve = createECDH('prime256v1');
    curve.generateKeys();
    process.env.VAPID_PUBLIC_KEY = curve.getPublicKey().toString('base64url');
    process.env.VAPID_PRIVATE_KEY = curve.getPrivateKey().toString('base64url');
    process.env.VAPID_SUBJECT = 'https://example.invalid';
    return new PushTransport();
  }
  it('can be left unconfigured without disabling normal app use', () => {
    expect(new PushTransport().publicKey).toBeNull();
  });
  it('uses the HTTPS frontend when the optional subject is left blank', () => {
    configured();
    process.env.VAPID_SUBJECT = '';
    process.env.FRONTEND_URL = 'https://example.invalid';
    expect(new PushTransport().publicKey).toBe(process.env.VAPID_PUBLIC_KEY);
  });
  it('fails fast on partial/mismatched configuration without including secrets', () => {
    process.env.VAPID_PUBLIC_KEY = 'never-log-this';
    expect(() => new PushTransport()).toThrow('Configure both');
    process.env.VAPID_PRIVATE_KEY = 'never-log-this-either';
    expect(() => new PushTransport()).toThrow('Invalid VAPID');
  });
  it('uses bounded high-urgency encrypted Web Push without title leakage', async () => {
    const transport = configured();
    jest
      .mocked(webpush.sendNotification)
      .mockResolvedValue({ statusCode: 201, headers: {}, body: '' });
    expect(
      await transport.send(subscription(), { type: 'timer-finished' }, 12),
    ).toBe('sent');
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.anything(),
      '{"type":"timer-finished"}',
      expect.objectContaining({ TTL: 12, timeout: 2000, urgency: 'high' }),
    );
  });
  it.each([
    [404, 'gone'],
    [410, 'gone'],
    [400, 'failed'],
    [401, 'failed'],
    [403, 'failed'],
    [429, 'retry'],
    [500, 'retry'],
    [null, 'retry'],
  ])('classifies failure %s safely', async (statusCode, result) => {
    const transport = configured();
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValue({ statusCode, body: 'untrusted-private-endpoint' });
    expect(await transport.send(subscription(), {}, 1)).toBe(result);
  });
});
