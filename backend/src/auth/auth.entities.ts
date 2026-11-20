import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 254, unique: true }) email!: string;
  @Column({ type: 'text', select: false }) passwordHash!: string;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
@Entity('auth_sessions')
export class SessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 }) hash!: string;
  @Index() @Column({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
}
@Entity('auth_tokens')
@Index(['userId', 'kind'], { unique: true })
export class AuthTokenEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 }) hash!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
  @Column({ type: 'varchar', length: 16 }) kind!: 'verify' | 'reset';
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
}
@Entity('auth_rate_limits')
export class RateLimitEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 }) key!: string;
  @Column({ type: 'integer' }) count!: number;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
}
