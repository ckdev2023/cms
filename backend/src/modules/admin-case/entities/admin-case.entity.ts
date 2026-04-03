import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { AdminCaseStatus } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { AdminCaseDocument } from './admin-case-document.entity';
import { AdminCaseInterview } from './admin-case-interview.entity';
import { AdminCaseTask } from './admin-case-task.entity';

/**
 * 映射行政案件主表，维护案件负责人、办理状态与客户归属等核心持久化字段。
 */
@Entity('admin_cases')
export class AdminCase extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 200 })
  caseName: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  applicantName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  residenceStatus: string | null;

  @Index()
  @Column({ type: 'varchar', length: 30, default: AdminCaseStatus.DRAFT })
  status: AdminCaseStatus;

  @Index()
  @Column({ type: 'date', nullable: true })
  expireDate: Date | null;

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

  @OneToMany(() => AdminCaseInterview, (i) => i.adminCase)
  interviews: AdminCaseInterview[];

  @OneToMany(() => AdminCaseDocument, (d) => d.adminCase)
  documents: AdminCaseDocument[];

  @OneToMany(() => AdminCaseTask, (t) => t.adminCase)
  tasks: AdminCaseTask[];
}
