import {
  Check,
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

  /** The token lacks a newer permission; only the main calendar is read. */
  @Column({ type: 'boolean', default: false })
  needsConsent!: boolean;
}

/** A Google calendar the app only reads, with the user's setting for it. */
@Entity('external_calendars')
export class ExternalCalendarEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @PrimaryColumn({ type: 'varchar', length: 300 })
  calendarId!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'boolean', default: false })
  primary!: boolean;
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

/**
 * Ties a todo, a habit run or a work log to its event in the app's calendar.
 * Todos and runs are exchanged both ways; a work log is only ever written.
 */
@Entity('calendar_links')
@Index(['userId', 'eventId'], { unique: true })
@Check(
  'CHK_calendar_link_target',
  'num_nonnulls("todoId", "occurrenceId", "workLogId") = 1',
)
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

  @Column({ type: 'integer', nullable: true })
  workLogId!: number | null;

  @Column({ type: 'varchar', length: 1100 })
  eventId!: string;

  /** Google's `updated` of the event as last seen. */
  @Column({ type: 'timestamptz' })
  remoteUpdatedAt!: Date;

  /** Local `updatedAt` at the last exchange; newer means changed here. */
  @Column({ type: 'timestamptz' })
  syncedAt!: Date;

  /** Deleted in Google: the habit run or work log stays and is not written again. */
  @Column({ type: 'boolean', default: false })
  suppressed!: boolean;
}

/**
 * Copy of the read calendars' events, one row per Google event (its
 * calendar and its id there). A sync updates the row in place while the
 * event exists, so its id, its place and its tick stay; it deletes the row
 * once the sync no longer reads the event (see `externalChanges`). Rows from
 * before event ids (empty `eventId`) stay out of the unique index; the next
 * sync of their user deletes them.
 */
@Entity('external_events')
@Index(['userId', 'start'])
@Index('UQ_external_events_event', ['userId', 'calendarId', 'eventId'], {
  unique: true,
  where: `"eventId" <> ''`,
})
export class ExternalEventEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 300, default: '' })
  calendarId!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'timestamptz' })
  start!: Date;

  @Column({ type: 'timestamptz' })
  end!: Date;

  /** The event's id in its Google calendar; empty for rows from before. */
  @Column({ type: 'varchar', length: 1024, default: '' })
  eventId!: string;

  /**
   * Where the user sorted it among the day's quests and dailies; null until
   * then. A sync never writes it.
   */
  @Column({ type: 'integer', nullable: true })
  dayPosition!: number | null;

  /**
   * When the user ticked it off in a day's list; null while open. Only the
   * app knows it, never Google; a sync never writes it.
   */
  @Column({ type: 'timestamptz', nullable: true })
  doneAt!: Date | null;
}
