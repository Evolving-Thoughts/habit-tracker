import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { lockUser } from '../common/user-unit-of-work';
import { AuthTokenEntity, SessionEntity, UserEntity } from './auth.entities';
import { AuthMailer } from './auth.mailer';
import { AuthUser, CredentialsDto } from './auth.dto';
import {
  DUMMY_PASSWORD_HASH,
  checkPassword,
  hashPassword,
  randomToken,
  tokenHash,
} from './auth.crypto';
export const GENERIC_MAIL_MESSAGE =
  'Falls eine passende Registrierung vorliegt, wurde eine E-Mail versendet.';
export const SESSION_DAYS = 30;
@Injectable()
export class AuthService {
  constructor(
    private readonly db: DataSource,
    private readonly mailer: AuthMailer,
  ) {}
  async limit(action: string, ip: string, email?: string): Promise<void> {
    // Persistent atomic counters; IP comes from the socket, not an untrusted proxy header.
    for (const [value, max] of [
      [`ip:${ip}`, 30],
      ...(email ? [[`email:${email}`, action === 'login' ? 10 : 3]] : []),
    ] as [string, number][]) {
      const rows: { count: number }[] = await this.db.query(
        `INSERT INTO auth_rate_limits (key, count, "expiresAt") VALUES ($1, 1, NOW() + INTERVAL '15 minutes') ON CONFLICT (key) DO UPDATE SET count = CASE WHEN auth_rate_limits."expiresAt" <= NOW() THEN 1 ELSE auth_rate_limits.count + 1 END, "expiresAt" = CASE WHEN auth_rate_limits."expiresAt" <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE auth_rate_limits."expiresAt" END RETURNING count`,
        [tokenHash(`${action}:${value}`)],
      );
      if (rows[0].count > max)
        throw new HttpException(
          'Zu viele Versuche. Bitte später erneut versuchen.',
          429,
        );
    }
  }
  /**
   * Stores `token` as the user's link of this kind; it replaces the one
   * before (one link per kind).
   */
  private async storeLink(
    manager: EntityManager,
    userId: string,
    kind: 'verify' | 'reset',
    token: string,
  ): Promise<void> {
    await manager.delete(AuthTokenEntity, { userId, kind });
    await manager.save(AuthTokenEntity, {
      hash: tokenHash(token),
      userId,
      kind,
      expiresAt: new Date(
        Date.now() + (kind === 'verify' ? 24 * 60 : 30) * 60_000,
      ),
    });
  }
  /** Sends the link; a failed send answers 503. */
  private async send(
    email: string,
    kind: 'verify' | 'reset',
    token: string,
  ): Promise<void> {
    try {
      await this.mailer.send(email, kind, token);
    } catch {
      throw new ServiceUnavailableException(
        'E-Mail-Versand momentan nicht verfügbar. Bitte später erneut versuchen.',
      );
    }
  }
  async register(dto: CredentialsDto): Promise<void> {
    const passwordHash = await hashPassword(dto.password);
    // Serialize registration of the same normalized email (including concurrent requests).
    await this.db.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [dto.email],
      );
      if (await manager.findOneBy(UserEntity, { email: dto.email })) return;
      const user = await manager.save(
        UserEntity,
        manager.create(UserEntity, {
          email: dto.email,
          passwordHash,
          verifiedAt: null,
        }),
      );
      // The new row is seen by no one before commit, so no user lock waits
      // on the send; a failed send rolls the account back (503).
      const token = randomToken();
      await this.storeLink(manager, user.id, 'verify', token);
      await this.send(user.email, 'verify', token);
    });
  }
  /**
   * Resend and forgot. No lock is held while the mail goes out: the link is
   * stored only once the mail server took it, in a short transaction under
   * the user lock that checks again whether the account still wants it.
   * A failed send stores nothing, so the previous link stays valid, and the
   * answer is the same generic one as for an unknown address.
   */
  async requestMail(email: string, kind: 'verify' | 'reset'): Promise<void> {
    const wants = (user: UserEntity) =>
      kind === 'verify' ? !user.verifiedAt : !!user.verifiedAt;
    const user = await this.db.getRepository(UserEntity).findOneBy({ email });
    if (!user || !wants(user)) return;
    const token = randomToken();
    try {
      await this.send(user.email, kind, token);
    } catch (error) {
      // Retry/resend after restoring SMTP.
      if (!(error instanceof ServiceUnavailableException)) throw error;
      new Logger('AuthMail').warn('Authentication email delivery unavailable');
      return;
    }
    await this.db.transaction(async (manager) => {
      if (wants(await lockUser(manager, user.id)))
        await this.storeLink(manager, user.id, kind, token);
    });
  }
  private async consume(
    raw: string,
    kind: 'verify' | 'reset',
    operation: (manager: EntityManager, user: UserEntity) => Promise<void>,
  ): Promise<void> {
    await this.db.transaction(async (manager) => {
      const first = await manager.findOneBy(AuthTokenEntity, {
        hash: tokenHash(raw),
        kind,
      });
      if (!first)
        throw new BadRequestException(
          'Link ungültig oder abgelaufen. Bitte einen neuen Link anfordern.',
        );
      const user = await lockUser(manager, first.userId);
      const token = await manager.findOneBy(AuthTokenEntity, {
        hash: first.hash,
        kind,
        expiresAt: MoreThan(new Date()),
      });
      if (!token)
        throw new BadRequestException(
          'Link ungültig oder abgelaufen. Bitte einen neuen Link anfordern.',
        );
      await operation(manager, user);
      await manager.delete(AuthTokenEntity, { hash: token.hash });
    });
  }
  verify(raw: string): Promise<void> {
    return this.consume(raw, 'verify', async (manager, user) => {
      user.verifiedAt ??= new Date();
      await manager.save(user);
    });
  }
  async reset(raw: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.consume(raw, 'reset', async (manager, user) => {
      user.passwordHash = passwordHash;
      await manager.save(user);
      await manager.delete(SessionEntity, { userId: user.id });
    });
  }
  async login(dto: CredentialsDto): Promise<{ token: string; user: AuthUser }> {
    const candidate = await this.db
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();
    // Run the password KDF even for unknown accounts.
    const stored = candidate?.passwordHash ?? DUMMY_PASSWORD_HASH;
    if (!(await checkPassword(dto.password, stored)) || !candidate)
      throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    return this.db.transaction(async (manager) => {
      await lockUser(manager, candidate.id);
      const user = await manager.findOne(UserEntity, {
        where: { id: candidate.id },
        select: { id: true, email: true, passwordHash: true, verifiedAt: true },
      });
      // Reset and login serialize on the user, preventing an old-password login race.
      if (!user || user.passwordHash !== candidate.passwordHash)
        throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
      if (!user.verifiedAt)
        // The code lets the app offer to resend the link only in this case.
        throw new UnauthorizedException({
          message: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
          code: 'EMAIL_UNVERIFIED',
        });
      const token = randomToken();
      await manager.save(SessionEntity, {
        hash: tokenHash(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
      });
      return { token, user: { id: user.id, email: user.email } };
    });
  }
  async authenticate(raw: string | undefined): Promise<AuthUser | null> {
    if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
    const session = await this.db.getRepository(SessionEntity).findOne({
      where: { hash: tokenHash(raw), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    return session?.user.verifiedAt
      ? { id: session.user.id, email: session.user.email }
      : null;
  }
  async logout(raw: string | undefined): Promise<void> {
    if (!raw) return;
    const hash = tokenHash(raw);
    const session = await this.db
      .getRepository(SessionEntity)
      .findOneBy({ hash });
    if (!session) return;
    // Serialize revocation with Push dispatch and timer transitions; the session FK
    // removes this device's subscriptions/deliveries in the same transaction.
    await this.db.transaction(async (manager) => {
      await lockUser(manager, session.userId);
      await manager.delete(SessionEntity, { hash });
    });
  }
}
