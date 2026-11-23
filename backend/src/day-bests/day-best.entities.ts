import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';

/** The longest line a day's best may be, in characters. */
export const DAY_BEST_MAX_LENGTH = 280;
/** Where the card in Heute begins without a setting of one's own: 20:00. */
export const DEFAULT_CARD_MINUTES = 20 * 60;

/**
 * "Das Beste des Tages": one short line per person and Berlin day. A day
 * without a line has no row; emptying the line removes it.
 */
@Entity('day_bests')
@Unique('UQ_day_bests_user_date', ['userId', 'date'])
@Check('CHK_day_bests_text', `"text" <> ''`)
export class DayBestEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: DAY_BEST_MAX_LENGTH })
  text!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * A person's settings for the day's best. Without a row the defaults hold
 * (card from 20:00, evening reminder on). `remindedOn` is the Berlin day the
 * evening reminder was last handled, so it comes at most once a day.
 */
@Entity('day_best_settings')
@Check('CHK_day_best_settings_card_minutes', '"cardMinutes" BETWEEN 0 AND 1439')
export class DayBestSettingsEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  /** Minutes after midnight (Berlin) from which Heute asks for the line. */
  @Column({ type: 'smallint', default: DEFAULT_CARD_MINUTES })
  cardMinutes!: number;

  @Column({ type: 'boolean', default: true })
  reminderEnabled!: boolean;

  @Column({ type: 'date', nullable: true })
  remindedOn!: string | null;
}
