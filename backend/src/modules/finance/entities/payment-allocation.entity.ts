import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';

/**
 * 映射收款分摊记录，描述单笔收款被分配到各账单的核销金额。
 */
@Entity('payment_allocations')
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  paymentId: string;

  @Index()
  @Column({ type: 'uuid' })
  invoiceId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  allocatedAmount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => Payment, (payment) => payment.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @ManyToOne(() => Invoice, (invoice) => invoice.paymentAllocations)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
