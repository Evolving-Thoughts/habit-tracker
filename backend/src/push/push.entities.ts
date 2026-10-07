import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SessionEntity, UserEntity } from '../auth/auth.entities';
import { TimerEntity } from '../timers/timer.entity';

@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;
  @Column({ type: 'varchar', length: 64 }) sessionHash!: string;
  @ManyToOne(() => SessionEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'sessionHash', referencedColumnName: 'hash' })
  session?: SessionEntity;
  @Index({ unique: true }) @Column({ length: 64 }) endpointHash!: string;
  @Column({ type: 'text', select: false }) endpoint!: string;
  @Column({ type: 'text', select: false }) p256dh!: string;
  @Column({ type: 'text', select: false }) auth!: string;
}
@Entity('push_deliveries')
@Check(
  'CHK_push_delivery_state',
  "\"state\" IN ('pending', 'sent', 'cancelled', 'failed')",
)
@Check('CHK_push_delivery_attempts', '"attempts" BETWEEN 0 AND 3')
@Index(['timerId', 'subscriptionId'], { unique: true })
export class PushDeliveryEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;
  @Column({ type: 'uuid' }) timerId!: string;
  @ManyToOne(() => TimerEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'timerId' })
  timer?: TimerEntity;
  @Column({ type: 'uuid' }) subscriptionId!: string;
  @ManyToOne(() => PushSubscriptionEntity, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: PushSubscriptionEntity;
  @Column({ type: 'varchar', length: 16 }) state!:
    'pending' | 'sent' | 'cancelled' | 'failed';
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Index() @Column({ type: 'timestamptz' }) retryAt!: Date;
}
