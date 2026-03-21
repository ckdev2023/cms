import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { LoginType, OperationResult } from '../../../common/constants/enums'
import { User } from '../../auth/entities/user.entity'

@Entity('login_logs')
export class LoginLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null

  @Column({ type: 'varchar', length: 50 })
  username: string

  @Column({ type: 'varchar', length: 20 })
  loginType: LoginType

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo: string | null

  @Column({ type: 'varchar', length: 20 })
  result: OperationResult

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason: string | null

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  occurredAt: Date

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null
}
