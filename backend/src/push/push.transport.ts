import { BadRequestException, Injectable } from '@nestjs/common';
import { createECDH } from 'node:crypto';
import * as webpush from 'web-push';
import type { SubscribeDto } from './push.dto';
export const DELIVERY_WINDOW_MS = 30_000;
export function validSubscription(value: SubscribeDto): void {
  let url: URL;
  try {
    url = new URL(value.endpoint);
  } catch {
    throw new BadRequestException('Ungültiges Push-Abonnement.');
  }
  // Browser-provided endpoints are untrusted input. No arbitrary URL/localhost/redirect destination.
  const allowed =
    (url.hostname === 'fcm.googleapis.com' &&
      (url.pathname.startsWith('/fcm/send/') ||
        url.pathname.startsWith('/wp/'))) ||
    (url.hostname === 'updates.push.services.mozilla.com' &&
      url.pathname.startsWith('/wpush/v2/'));
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new BadRequestException(
      'Dieser Push-Anbieter wird nicht unterstützt. Nutze Chrome oder Firefox.',
    );
  for (const [key, length] of [
    [value.keys?.p256dh, 65],
    [value.keys?.auth, 16],
  ] as [string | undefined, number][]) {
    if (
      !key ||
      !/^[A-Za-z0-9_-]+={0,2}$/.test(key) ||
      (key.includes('=') && key.length % 4 !== 0) ||
      Buffer.from(key, 'base64url').length !== length ||
      Buffer.from(key, 'base64url').toString('base64url') !==
        key.replace(/=+$/, '')
    )
      throw new BadRequestException('Ungültige Push-Schlüssel.');
  }
  value.endpoint = url.href;
  value.keys.p256dh = value.keys.p256dh.replace(/=+$/, '');
  value.keys.auth = value.keys.auth.replace(/=+$/, '');
  try {
    const curve = createECDH('prime256v1');
    curve.generateKeys();
    curve.computeSecret(Buffer.from(value.keys.p256dh, 'base64url'));
  } catch {
    throw new BadRequestException('Ungültiger Push-Schlüssel.');
  }
}
export type SendResult = 'sent' | 'gone' | 'retry' | 'failed';
@Injectable()
export class PushTransport {
  readonly publicKey: string | null;
  private readonly privateKey: string;
  private readonly subject: string;
  constructor() {
    this.publicKey = process.env.VAPID_PUBLIC_KEY || null;
    this.privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
    this.subject = process.env.VAPID_SUBJECT || process.env.FRONTEND_URL || '';
    if (!!this.publicKey !== !!this.privateKey)
      throw new Error('Configure both VAPID keys, or leave both empty.');
    if (this.publicKey) {
      try {
        const curve = createECDH('prime256v1');
        const secret = Buffer.from(this.privateKey, 'base64url');
        if (
          secret.length !== 32 ||
          secret.toString('base64url') !== this.privateKey
        )
          throw new Error();
        curve.setPrivateKey(secret);
        if (curve.getPublicKey().toString('base64url') !== this.publicKey)
          throw new Error();
        const subject = new URL(this.subject);
        if (
          !['https:', 'mailto:'].includes(subject.protocol) ||
          subject.username ||
          subject.password
        )
          throw new Error();
      } catch {
        throw new Error(
          'Invalid VAPID key pair or subject. No key contents were logged.',
        );
      }
    }
  }
  async send(
    subscription: SubscribeDto,
    payload: object,
    ttl: number,
  ): Promise<SendResult> {
    if (!this.publicKey) return 'failed';
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: ttl,
        urgency: 'high',
        timeout: 2000,
        vapidDetails: {
          subject: this.subject,
          publicKey: this.publicKey,
          privateKey: this.privateKey,
        },
      });
      return 'sent';
    } catch (error: unknown) {
      const status =
        error && typeof error === 'object' && 'statusCode' in error
          ? error.statusCode
          : null;
      if (status === 404 || status === 410) return 'gone';
      if (
        typeof status === 'number' &&
        status >= 400 &&
        status < 500 &&
        status !== 429
      )
        return 'failed';
      return 'retry';
    }
  }
}
