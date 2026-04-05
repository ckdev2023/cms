import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 签证 CSV 导入成功批次登记表，与 `docs/23` §6.4、`audit_logs`（IMPORT / VISA_CASE_IMPORT）及 API `importBatchId` 字段语义一致。
 *
 * - `id`：批次主键，即冻结文档中的 `import_batch_id`。
 * - `contentSha256`：整文件字节 SHA-256，唯一约束支撑 §4.4 同内容重复提交拒绝。
 * - `createdBy`：操作者用户 UUID，与审计日志 `user_id` 对齐。
 * - `createdAt`：批次落库时间，与对应审计行 `occurred_at` 可对账。
 * - `summary`：文件名与各类 outcome 计数等，与 `createAuditLog` 的 `afterValue` 汇总一致。
 */
@Entity('visa_case_import_batches')
@Index('IDX_visa_case_import_batches_created_at', ['createdAt'])
export class VisaCaseImportBatch {
  /** 批次 UUID，API 与 JSON 报告中为 `importBatchId`，并写入 `audit_logs.target_id`。 */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** CSV 原始内容的 SHA-256（64 字符十六进制），全表唯一。 */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  contentSha256: string;

  /** 提交操作者用户 ID，与 `audit_logs.user_id` 一致。 */
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  /** 批次汇总 JSON（如 `fileName`、`rowCount`、各写入结果计数），与审计 `afterValue` 对齐。 */
  @Column({ type: 'jsonb', nullable: true })
  summary: Record<string, unknown> | null;

  /** 批次记录创建时间（`timestamptz`）。 */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
