import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
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
  private async issue(
    manager: EntityManager,
    user: UserEntity,
    kind: 'verify' | 'reset',
  ): Promise<void> {
    const token = randomToken();
    await manager.delete(AuthTokenEntity, { userId: user.id, kind });
    await manager.save(AuthTokenEntity, {
      hash: tokenHash(token),
      userId: user.id,
      kind,
      expiresAt: new Date(
        Date.now() + (kind === 'verify' ? 24 * 60 : 30) * 60_000,
      ),
    });
    try {
      await this.mailer.send(user.email, kind, token);
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
      await this.issue(manager, user, 'verify');
    });
  }
  async requestMail(email: string, kind: 'verify' | 'reset'): Promise<void> {
    try {
      await this.db.transaction(async (manager) => {
        const user = await manager.findOne(UserEntity, {
          where: { email },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user || (kind === 'verify' ? !!user.verifiedAt : !user.verifiedAt))
          return;
        await this.issue(manager, user, kind);
      });
    } catch (error) {
      // Preserve generic responses even during SMTP outages; the transaction rolled back.
      // The existing link remains valid. Retry/resend after restoring SMTP.
      if (!(error instanceof ServiceUnavailableException)) throw error;
      new Logger('AuthMail').warn('Authentication email delivery unavailable');
    }
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
      const user = await manager.findOneOrFail(UserEntity, {
        where: { id: first.userId },
        lock: { mode: 'pessimistic_write' },
      });
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
      const user = await manager.findOne(UserEntity, {
        where: { id: candidate.id },
        select: { id: true, email: true, passwordHash: true, verifiedAt: true },
        lock: { mode: 'pessimistic_write' },
      });
      // Reset and login serialize on the user, preventing an old-password login race.
      if (!user || user.passwordHash !== candidate.passwordHash)
        throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
      if (!user.verifiedAt)
        throw new UnauthorizedException(
          'Bitte bestätige zuerst deine E-Mail-Adresse.',
        );
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
      await manager.findOne(UserEntity, {
        where: { id: session.userId },
        lock: { mode: 'pessimistic_write' },
      });
      await manager.delete(SessionEntity, { hash });
    });
  }
}
