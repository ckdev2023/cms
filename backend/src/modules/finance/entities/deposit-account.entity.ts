import {
  Entity,
  Column,
  Index,
  OneToOne,
  OneToMany,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Customer } from '../../customer/entities/customer.entity'
import { DepositTransaction } from './deposit-transaction.entity'

@Entity('deposit_accounts')
export class DepositAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  customerId: string

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance: number

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date

  @OneToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer

  @OneToMany(() => DepositTransaction, (dt) => dt.depositAccount)
  transactions: DepositTransaction[]
}
