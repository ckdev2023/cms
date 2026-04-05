import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 记录已成功提交的「行政案件 → 签证案件」补录批次，以所选案件 ID 集合的 SHA-256 去重。
 */
@Entity('admin_case_visa_supplement_batches')
export class AdminCaseVisaSupplementBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  contentSha256: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  summary: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
