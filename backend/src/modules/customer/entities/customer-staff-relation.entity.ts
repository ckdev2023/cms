import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm'
import { StaffRelationType } from '../../../common/constants/enums'
import { Customer } from './customer.entity'
import { User } from '../../auth/entities/user.entity'

@Entity('customer_staff_relations')
@Index(['customerId', 'userId'], { unique: true })
export class CustomerStaffRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  customerId: string

  @Index()
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 30, default: StaffRelationType.PRIMARY })
  relationType: StaffRelationType

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @ManyToOne(() => Customer, (customer) => customer.staffRelations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User
}
