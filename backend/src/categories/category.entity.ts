import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';
import type { CampaignColor } from '../todos/campaign-style';

@Entity({ name: 'categories' })
export class CategoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  /** Wanted completions per week; a Perfect Week reaches all of them. */
  @Column({ type: 'integer', nullable: true })
  weeklyTarget!: number | null;

  /** One of the campaign colours; null lets the name pick one. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  color!: CampaignColor | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
