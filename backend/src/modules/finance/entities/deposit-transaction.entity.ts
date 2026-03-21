import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm'
import { DepositTransactionType } from '../../../common/constants/enums'
import { DepositAccount } from './deposit-account.entity'
import { Invoice } from './invoice.entity'

@Entity('deposit_transactions')
export class DepositTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid' })
  depositAccountId: string

  @Column({ type: 'varchar', length: 30 })
  transactionType: DepositTransactionType

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balanceAfter: number

  @Column({ type: 'uuid', nullable: true })
  relatedInvoiceId: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null

  @ManyToOne(() => DepositAccount, (da) => da.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deposit_account_id' })
  depositAccount: DepositAccount

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'related_invoice_id' })
  relatedInvoice: Invoice | null
}
