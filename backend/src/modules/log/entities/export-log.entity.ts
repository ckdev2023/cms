import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { OperationResult } from '../../../common/constants/enums'
import { User } from '../../auth/entities/user.entity'

@Entity('export_logs')
export class ExportLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 50 })
  exportType: string

  @Column({ type: 'jsonb', nullable: true })
  exportParams: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null

  @Column({ type: 'varchar', length: 20 })
  status: OperationResult

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  occurredAt: Date

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User
}
