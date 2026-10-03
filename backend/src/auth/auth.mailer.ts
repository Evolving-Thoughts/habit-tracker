import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
@Injectable()
export class AuthMailer implements OnModuleDestroy {
  private readonly transport: Transporter;
  private readonly frontend: string;
  private readonly from: string;
  constructor(config: ConfigService) {
    this.frontend = config.getOrThrow<string>('FRONTEND_URL');
    const url = new URL(this.frontend);
    if (
      url.origin !== this.frontend ||
      (url.protocol !== 'http:' && url.protocol !== 'https:')
    )
      throw new Error(
        'FRONTEND_URL must be an origin without a trailing slash',
      );
    const production = config.get<string>('NODE_ENV') === 'production';
    if (production && url.protocol !== 'https:')
      throw new Error('Production requires HTTPS');
    this.from =
      config.get<string>('MAIL_FROM') ??
      'Habit Tracker <noreply@habit-tracker.local>';
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    if (production && !config.get<string>('SMTP_HOST'))
      throw new Error('Configure production SMTP');
    this.transport = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST') ?? '127.0.0.1',
      port: Number(config.get<string>('SMTP_PORT') ?? 1025),
      secure: config.get<string>('SMTP_SECURE') === 'true',
      requireTLS: production,
      ...(user && password ? { auth: { user, pass: password } } : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      logger: false,
      debug: false,
    });
  }
  async send(
    email: string,
    kind: 'verify' | 'reset',
    token: string,
  ): Promise<void> {
    // Fragment is never sent to the frontend HTTP server, unlike query parameters.
    const link = `${this.frontend}/#${kind}=${encodeURIComponent(token)}`;
    await this.transport.sendMail({
      from: this.from,
      to: email,
      subject:
        kind === 'verify'
          ? 'E-Mail-Adresse bestätigen'
          : 'Passwort zurücksetzen',
      text:
        kind === 'verify'
          ? `Bestätige deine E-Mail-Adresse: ${link}\n\nDer Link gilt 24 Stunden und kann nur einmal verwendet werden. Falls du dich nicht registriert hast, ignoriere diese E-Mail.`
          : `Setze dein Passwort zurück: ${link}\n\nDer Link gilt 30 Minuten und kann nur einmal verwendet werden. Falls du das nicht angefordert hast, ignoriere diese E-Mail.`,
    });
  }
  onModuleDestroy(): void {
    this.transport.close();
  }
}
