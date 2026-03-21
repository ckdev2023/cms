import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Customer } from './customer.entity'

@Entity('company_info')
export class CompanyInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid', unique: true })
  customerId: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  corporationNumber: string | null

  @Column({ type: 'smallint', nullable: true })
  fiscalMonth: number | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  representativeName: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date

  @OneToOne(() => Customer, (customer) => customer.companyInfo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer
}
