import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm'
import { BaseEntity } from '../../../common/entities/base.entity'
import {
  PaymentStatus,
  PaymentMethod,
} from '../../../common/constants/enums'
import { Customer } from '../../customer/entities/customer.entity'
import { PaymentAllocation } from './payment-allocation.entity'

@Entity('payments')
export class Payment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  paymentNo: string

  @Column({ type: 'date' })
  paymentDate: Date

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  paymentAmount: number

  @Column({ type: 'varchar', length: 30 })
  paymentMethod: PaymentMethod

  @Index()
  @Column({ type: 'varchar', length: 30, default: PaymentStatus.REGISTERED })
  status: PaymentStatus

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null

  @Column({ type: 'timestamptz', nullable: true })
  reversedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  reversedBy: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  reversalReason: string | null

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer

  @OneToMany(() => PaymentAllocation, (pa) => pa.payment, { cascade: true })
  allocations: PaymentAllocation[]
}
