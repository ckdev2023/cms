import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../auth/entities/user.entity';
import { TaxPeriod } from './tax-period.entity';

/**
 * 记录月次期间的作业清单、完成状态、责任人及排序信息。
 */
@Entity('tax_monthly_work_items')
export class TaxMonthlyWorkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  taxPeriodId: string;

  @Column({ type: 'varchar', length: 200 })
  itemName: string;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  completedBy: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => TaxPeriod, (tp) => tp.workItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tax_period_id' })
  taxPeriod: TaxPeriod;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by' })
  completedByUser: User | null;
}
