import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../auth/entities/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  actionType: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  targetType: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  beforeValue: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  afterValue: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  result: string | null;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  occurredAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
