import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';

/** The answers of a weekly review; a week without any answer has no row. */
@Entity({ name: 'week_reviews' })
@Unique('UQ_week_reviews_user_week', ['userId', 'week'])
export class WeekReviewEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  /** The Monday the week starts on. */
  @Column({ type: 'date' })
  week!: string;

  @Column({ type: 'varchar', length: 10000, nullable: true })
  wentWell!: string | null;

  @Column({ type: 'varchar', length: 10000, nullable: true })
  wentBadly!: string | null;

  @Column({ type: 'varchar', length: 10000, nullable: true })
  changeNext!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
