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
import { Invoice } from './invoice.entity'

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  invoiceId: string

  @Column({ type: 'varchar', length: 500 })
  description: string

  @Column({ type: 'int', default: 1 })
  quantity: number

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  unitPrice: number

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  amount: number

  @Column({ type: 'int', default: 0 })
  sortOrder: number

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice
}
