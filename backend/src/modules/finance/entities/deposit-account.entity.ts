import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Customer } from '../../customer/entities/customer.entity';
import { DepositTransaction } from './deposit-transaction.entity';

/**
 * 映射客户押金账户主表，维护唯一客户账户与当前可用押金余额的持久化状态。
 */
@Entity('deposit_accounts')
export class DepositAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(
    () => DepositTransaction,
    (transaction) => transaction.depositAccount,
  )
  transactions: DepositTransaction[];
}
