import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TaxPeriod } from './tax-period.entity'
import { User } from '../../auth/entities/user.entity'

@Entity('tax_monthly_work_items')
export class TaxMonthlyWorkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  taxPeriodId: string

  @Column({ type: 'varchar', length: 200 })
  itemName: string

  @Column({ type: 'boolean', default: false })
  completed: boolean

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  completedBy: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null

  @Column({ type: 'int', default: 0 })
  sortOrder: number

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date

  @ManyToOne(() => TaxPeriod, (tp) => tp.workItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tax_period_id' })
  taxPeriod: TaxPeriod

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by' })
  completedByUser: User | null
}
