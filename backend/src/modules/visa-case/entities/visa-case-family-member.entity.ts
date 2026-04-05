import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { VisaCaseMemberRole } from '../../../common/constants/enums';
import { Customer } from '../../customer/entities/customer.entity';
import { VisaCase } from './visa-case.entity';

/**
 * 签证案件级家属关联表，记录一个案件内主申请人与各家属成员的角色关系。
 *
 * 约束：一个案件只允许一个 `is_primary = true` 的主申请人（由部分唯一索引保证）；
 * 同一客户在同一案件中不得重复挂载（由联合唯一索引保证）；
 * 家属解绑不等于删除客户主档。
 */
@Entity('visa_case_family_members')
export class VisaCaseFamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  visaCaseId: string;

  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 30 })
  memberRole: VisaCaseMemberRole;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'varchar', length: 200 })
  displayNameSnapshot: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => VisaCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visa_case_id' })
  visaCase: VisaCase;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
