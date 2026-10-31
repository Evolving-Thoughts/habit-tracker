import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';

@Entity('calendar_connections')
export class CalendarConnectionEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  /** Encrypted at rest; see calendar.crypto.ts. */
  @Column({ type: 'text' })
  refreshToken!: string;

  /** The app's own calendar; the main calendar is only ever read. */
  @Column({ type: 'varchar', length: 300 })
  calendarId!: string;

  /** Google no longer accepts the token; the user has to connect again. */
  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  lastError!: string | null;
}

@Entity('calendar_oauth_states')
export class CalendarOAuthStateEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}

/** Ties a todo or a habit run to its event in the app's calendar. */
@Entity('calendar_links')
@Index(['userId', 'eventId'], { unique: true })
export class CalendarLinkEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'integer', nullable: true })
  todoId!: number | null;

  @Column({ type: 'integer', nullable: true })
  occurrenceId!: number | null;

  @Column({ type: 'varchar', length: 1100 })
  eventId!: string;

  /** Google's `updated` of the event as last seen. */
  @Column({ type: 'timestamptz' })
  remoteUpdatedAt!: Date;

  /** Local `updatedAt` at the last exchange; newer means changed here. */
  @Column({ type: 'timestamptz' })
  syncedAt!: Date;

  /** Deleted in Google: the habit run stays and is not written again. */
  @Column({ type: 'boolean', default: false })
  suppressed!: boolean;
}

/** Copy of the main calendar's upcoming events, replaced on every sync. */
@Entity('external_events')
@Index(['userId', 'start'])
export class ExternalEventEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'timestamptz' })
  start!: Date;

  @Column({ type: 'timestamptz' })
  end!: Date;

  /** False for events marked as free in Google; those never block planning. */
  @Column({ type: 'boolean', default: true })
  busy!: boolean;
}
