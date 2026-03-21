import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm'
import { Payment } from './payment.entity'
import { Invoice } from './invoice.entity'

@Entity('payment_allocations')
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  paymentId: string

  @Index()
  @Column({ type: 'uuid' })
  invoiceId: string

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  allocatedAmount: number

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null

  @ManyToOne(() => Payment, (p) => p.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment

  @ManyToOne(() => Invoice, (i) => i.paymentAllocations)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice
}
