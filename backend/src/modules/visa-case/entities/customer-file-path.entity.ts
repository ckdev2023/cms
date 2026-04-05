import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { FilePathType } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { VisaCase } from './visa-case.entity';

/**
 * 客户/案件维度的服务器路径台账，记录资料在文件服务器上的存放位置。
 *
 * 与 `files`（上传附件）互为补充：本表只记录路径与元信息，不承载实际文件上传功能。
 * `customer_id` 必填，`visa_case_id` 可选——为空时属客户级路径，非空时属案件级路径。
 */
@Entity('customer_file_paths')
export class CustomerFilePath extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  visaCaseId: string | null;

  @Column({ type: 'varchar', length: 30, default: FilePathType.OTHER })
  pathType: FilePathType;

  @Column({ type: 'text' })
  filePath: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  displayName: string | null;

  @Column({ type: 'text', nullable: true })
  remark: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => VisaCase, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'visa_case_id' })
  visaCase: VisaCase | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
