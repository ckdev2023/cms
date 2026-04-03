import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { AdminCase } from './admin-case.entity';

/**
 * 映射行政案件面谈记录，持久化面谈日期、地点、内容与参与客户信息。
 */
@Entity('admin_case_interviews')
export class AdminCaseInterview extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  adminCaseId: string;

  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'date' })
  interviewDate: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  interviewLocation: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => AdminCase, (ac) => ac.interviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_case_id' })
  adminCase: AdminCase;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
