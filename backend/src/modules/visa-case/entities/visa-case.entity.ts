import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import {
  FamilyLinkMode,
  FamilyRelation,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseStatus,
} from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { VisaCaseFamilyMember } from './visa-case-family-member.entity';

/**
 * 签证案件主表，承载案件归属客户、案件类型、状态、家族签模式、负责人、到期/跟进与摘要字段。
 *
 * `customer_id` 统一表示案件归属的系统内客户上下文（客户详情挂载对象）。
 * `INTERNAL` 模式下 `internal_primary_customer_id` 指向系统内主申请人；
 * `EXTERNAL` 模式下保存外部主申请人快照字段，不创建外部客户主档；
 * `externalPrimaryRelationToApplicant` 表示外部主申与本案系统内申请人的家属关系口径（与 `FamilyRelation` 一致）。
 * `expire_date` 是新签证提醒的计算基准；`material_status` 在 P0 先按手工维护的摘要字段使用。
 */
@Entity('visa_cases')
export class VisaCase extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  caseType: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: VisaCaseStatus.DRAFT,
  })
  caseStatus: VisaCaseStatus;

  @Column({ type: 'boolean', default: false })
  isFamilyCase: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  familyLinkMode: FamilyLinkMode | null;

  @Column({ type: 'uuid', nullable: true })
  internalPrimaryCustomerId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  externalPrimaryName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalPrimaryCaseType: string | null;

  @Column({ type: 'date', nullable: true })
  externalPrimaryExpireDate: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  externalPrimaryRelationToApplicant: FamilyRelation | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Index()
  @Column({ type: 'date', nullable: true })
  expireDate: Date | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  nextFollowUpAt: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  materialStatus: MaterialStatus | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  feeStatus: VisaCaseFeeStatus | null;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  /**
   * 历史一括取込用の冪等キー（CSV `legacy_case_ref` に対応）。非空時は顧客単位で一意。
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  importReference: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'internal_primary_customer_id' })
  internalPrimaryCustomer: Customer | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @OneToMany('VisaCaseFamilyMember', 'visaCase', { cascade: true })
  familyMembers: VisaCaseFamilyMember[];
}
