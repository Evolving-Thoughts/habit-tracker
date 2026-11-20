import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';

/**
 * The overall weekly goal over time: each row holds from the week starting
 * on `validFrom` (a Monday) until the next row. Null means no goal from
 * then on. A week's goal is the latest row that began on or before it.
 */
@Entity('weekly_quest_targets')
@Check(
  'CHK_weekly_quest_targets_minutes',
  '"minutes" IS NULL OR "minutes" BETWEEN 1 AND 6000',
)
@Check(
  'CHK_weekly_quest_targets_monday',
  'EXTRACT(ISODOW FROM "validFrom") = 1',
)
export class WeeklyQuestTargetEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  /** The Monday from which this goal holds. */
  @PrimaryColumn({ type: 'date' })
  validFrom!: string;

  /** Minutes of quest time to reach each week; null for no goal. */
  @Column({ type: 'integer', nullable: true })
  minutes!: number | null;
}
