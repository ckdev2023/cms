import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { NoteType, VisaCaseLogType } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { VisaCase } from '../../visa-case/entities/visa-case.entity';
import { Customer } from './customer.entity';

/**
 * 统一承载客户备注与签证案件日志的持久化实体。
 *
 * 区分规则：`visaCaseId IS NULL` 为客户备注，沿用 `noteType`；
 * `visaCaseId IS NOT NULL` 为案件日志，`logType` 必填。
 * 历史数据不回填 `logType`，两类记录接口分离、展示分离。
 */
@Entity('notes')
export class Note extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 30, default: NoteType.GENERAL })
  noteType: NoteType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  visaCaseId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  logType: VisaCaseLogType | null;

  @Column({ type: 'text', nullable: true })
  submittedItems: string | null;

  @Column({ type: 'text', nullable: true })
  missingItems: string | null;

  @Column({ type: 'text', nullable: true })
  nextAction: string | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  nextFollowUpAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => Customer, (customer) => customer.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => VisaCase, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'visa_case_id' })
  visaCase: VisaCase | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
