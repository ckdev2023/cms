import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import {
  BillingCycle,
  TaxContractStatus,
} from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { TaxPeriod } from './tax-period.entity';

/**
 * 定义税务合同主档，并维护客户、负责人及月次期间的聚合关系。
 */
@Entity('tax_contracts')
export class TaxContract extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 200 })
  contractName: string;

  @Index()
  @Column({ type: 'varchar', length: 30, default: TaxContractStatus.ACTIVE })
  contractStatus: TaxContractStatus;

  @Column({ type: 'varchar', length: 20, default: BillingCycle.MONTHLY })
  billingCycle: BillingCycle;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  monthlyFee: number;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @OneToMany(() => TaxPeriod, (tp) => tp.taxContract)
  periods: TaxPeriod[];
}
