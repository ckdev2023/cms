import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import {
  BusinessType,
  InvoiceStatus,
  InvoiceType,
} from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { InvoiceItem } from './invoice-item.entity';
import { PaymentAllocation } from './payment-allocation.entity';

/**
 * 映射账单主表，维护客户应收、业务关联与作废状态等核心结算字段。
 */
@Entity('invoices')
export class Invoice extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  invoiceNo: string;

  @Column({ type: 'varchar', length: 30 })
  invoiceType: InvoiceType;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 10, default: 'JPY' })
  currency: string;

  @Index()
  @Column({ type: 'varchar', length: 30, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Index()
  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'date', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  relatedId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  relatedType: BusinessType | null;

  @Column({ type: 'text', nullable: true })
  remark: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  voidReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  voidedBy: string | null;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => PaymentAllocation, (allocation) => allocation.invoice)
  paymentAllocations: PaymentAllocation[];
}
