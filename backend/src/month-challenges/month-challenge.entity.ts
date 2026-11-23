import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';
import { HabitEntity } from '../habits/entities/habit.entity';

/** Where the daily reminder stands without a choice of one's own: 19:00. */
export const DEFAULT_REMINDER_MINUTES = 19 * 60;

/**
 * A Monats-Challenge: one Daily held for one calendar month, at most one
 * per person and month (see docs/challenges.md). It counts the Daily's own
 * due runs from `startDate` to the month's end.
 *
 * `title` keeps the Daily's title, so a challenge whose Daily was deleted
 * still reads in the history. Once the month is over, the challenge was
 * ended early or its Daily was deleted, the result is frozen in `doneCount`
 * and `dueCount` and never counted again.
 */
@Entity('month_challenges')
@Unique('UQ_month_challenges_user_month', ['userId', 'month'])
@Check(
  'CHK_month_challenges_reminder_minutes',
  '"reminderMinutes" BETWEEN 0 AND 1439',
)
@Check(
  'CHK_month_challenges_result',
  '("doneCount" IS NULL AND "dueCount" IS NULL) OR ("doneCount" >= 0 AND "doneCount" <= "dueCount")',
)
export class MonthChallengeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_month_challenges_user',
  })
  user?: UserEntity;

  /** The Daily; null once it was deleted (Dailies go softly, so set here). */
  @Index('IDX_month_challenges_habitId')
  @Column({ type: 'integer', nullable: true })
  habitId!: number | null;

  @ManyToOne(() => HabitEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'habitId',
    foreignKeyConstraintName: 'FK_month_challenges_habit',
  })
  habit?: HabitEntity | null;

  /** The first day of the month. */
  @Column({ type: 'date' })
  month!: string;

  /** The first counted day: the month's first, or the day it began. */
  @Column({ type: 'date' })
  startDate!: string;

  /** The Daily's title, kept for a challenge whose Daily is gone. */
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Minutes after midnight (Berlin) of the daily reminder; null for none. */
  @Column({ type: 'smallint', nullable: true })
  reminderMinutes!: number | null;

  /** The Berlin day the reminder was last handled: at most once a day. */
  @Column({ type: 'date', nullable: true })
  remindedOn!: string | null;

  /** The frozen result: done runs ... */
  @Column({ type: 'integer', nullable: true })
  doneCount!: number | null;

  /** ... of this many due ones. */
  @Column({ type: 'integer', nullable: true })
  dueCount!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** When it was ended before the month was over (by hand or by deletion). */
  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
}
