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

import { FileEntity } from '../../file/entities/file.entity';
import { TaxPeriod } from './tax-period.entity';

/**
 * 记录月次期间所需资料的接收状态、附件绑定与备注信息。
 */
@Entity('tax_monthly_documents')
export class TaxMonthlyDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  taxPeriodId: string;

  @Column({ type: 'uuid', nullable: true })
  fileId: string | null;

  @Column({ type: 'varchar', length: 200 })
  documentName: string;

  @Column({ type: 'boolean', default: false })
  received: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => TaxPeriod, (tp) => tp.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tax_period_id' })
  taxPeriod: TaxPeriod;

  @ManyToOne(() => FileEntity, { nullable: true })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity | null;
}
