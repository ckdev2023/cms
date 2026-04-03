import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DepositTransactionType } from '../../../common/constants/enums';
import { DepositAccount } from './deposit-account.entity';
import { Invoice } from './invoice.entity';

/**
 * 映射押金流水明细，记录充值、抵扣与调整后的余额快照及关联单据。
 */
@Entity('deposit_transactions')
export class DepositTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  depositAccountId: string;

  @Column({ type: 'varchar', length: 30 })
  transactionType: DepositTransactionType;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balanceAfter: number;

  @Column({ type: 'uuid', nullable: true })
  relatedInvoiceId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(
    () => DepositAccount,
    (depositAccount) => depositAccount.transactions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'deposit_account_id' })
  depositAccount: DepositAccount;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'related_invoice_id' })
  relatedInvoice: Invoice | null;
}
