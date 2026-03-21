import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { BaseEntity } from '../../../common/entities/base.entity'
import { TaskStatus } from '../../../common/constants/enums'
import { AdminCase } from './admin-case.entity'
import { User } from '../../auth/entities/user.entity'

@Entity('admin_case_tasks')
export class AdminCaseTask extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  adminCaseId: string

  @Column({ type: 'varchar', length: 200 })
  taskName: string

  @Column({ type: 'varchar', length: 30, default: TaskStatus.TODO })
  status: TaskStatus

  @Column({ type: 'uuid', nullable: true })
  assigneeId: string | null

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null

  @ManyToOne(() => AdminCase, (ac) => ac.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_case_id' })
  adminCase: AdminCase

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null
}
