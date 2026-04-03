import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { MaterialStatus, MonthlyStatus } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { TaxContract } from './tax-contract.entity';
import { TaxMonthlyDocument } from './tax-monthly-document.entity';
import { TaxMonthlyWorkItem } from './tax-monthly-work-item.entity';

/**
 * 表示税务合同下某一申报月份的执行周期及资料/作业进度快照。
 */
@Entity('tax_periods')
export class TaxPeriod extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  taxContractId: string;

  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 7 })
  periodYm: string;

  @Column({ type: 'date', nullable: true })
  declarationDeadline: Date | null;

  @Index()
  @Column({ type: 'varchar', length: 30, default: MonthlyStatus.NOT_STARTED })
  monthlyStatus: MonthlyStatus;

  @Column({ type: 'varchar', length: 30, default: MaterialStatus.NOT_RECEIVED })
  materialStatus: MaterialStatus;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => TaxContract, (tc) => tc.periods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tax_contract_id' })
  taxContract: TaxContract;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => TaxMonthlyDocument, (d) => d.taxPeriod)
  documents: TaxMonthlyDocument[];

  @OneToMany(() => TaxMonthlyWorkItem, (w) => w.taxPeriod)
  workItems: TaxMonthlyWorkItem[];
}
